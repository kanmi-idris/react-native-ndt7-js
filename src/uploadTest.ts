import type {
  Ndt7Protocol,
  Ndt7ServerMetrics,
  Ndt7ServerURLs,
} from "./ndt7Protocol";
import { runNdt7WebSocketPhase } from "./ndt7WebSocketPhase";
import type { Ndt7ProgressEvent } from "./types";

type UploadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

type UploadMeasurement = {
  speedMbps: number;
  elapsedMs: number;
  bytesTransferred: number;
  metrics?: Ndt7ServerMetrics;
};

class UploadTestRunner {
  private readonly currentTime = () => this.ndt7Protocol.now();
  private readonly maxMessageSize = 8 * 1024 * 1024; // 8MiB
  private readonly maxFallbackMessageSize = 256 * 1024; // 256KiB
  private readonly maxFallbackQueueSize = 64 * 1024 * 1024; // 64MiB
  private latestSpeed = 0;
  private latestServerMeasurement: UploadMeasurement | null = null;
  private latestMetrics: Ndt7ServerMetrics = {};
  private closed = false;
  private data = new Uint8Array(8192); // 8KiB
  private total = 0; // total bytes sent
  /** Timestamp when the upload measurement window begins. */
  private start = 0;
  /** Timestamp when the fixed upload measurement window should stop. */
  private end = 0;
  private previous = 0; // previous time
  private socket: WebSocket | null = null; // websocket connection
  private isSettled: (() => boolean) | null = null;

  constructor(
    private readonly ndt7Protocol: Ndt7Protocol,
    private readonly callbacks: UploadCallbacks,
  ) {}

  getResult() {
    return Object.keys(this.latestMetrics).length > 0
      ? { speedMbps: this.latestSpeed, metrics: this.latestMetrics }
      : { speedMbps: this.latestSpeed };
  }

  /**
   * Attaches the upload test runner to a WebSocket connection.
   */
  attach(socket: WebSocket, isSettled: () => boolean, markOpen: () => void) {
    this.socket = socket;
    this.isSettled = isSettled;
    this.socket.onmessage = (event) => {
      this.handleServerMessage(event.data);
    };
    this.socket.onopen = () => {
      markOpen();
      this.start = this.currentTime();
      /** Upload runs for a fixed measurement window. */
      this.end = this.start + 10000;
      this.previous = this.start;
      this.tick();
    };
  }

  /**
   * Measures uploaded bytes as attempted bytes minus the socket's unsent local buffer.
   */
  private emitUploadMeasurement() {
    if (!this.socket) {
      return;
    }

    this.emitMeasurement(this.getBestMeasurement());
  }

  /**
   * Payload size grows from the best available drain signal; browsers use
   * bufferedAmount, while React Native falls back to a bounded optimistic window.
   */
  private tick() {
    /** Stop scheduling work once the phase has ended or settled elsewhere. */
    if (!this.socket || !this.isSettled || this.closed || this.isSettled()) {
      return;
    }

    const timestamp = this.currentTime();
    if (timestamp >= this.end) {
      this.closed = true;
      this.emitUploadMeasurement();
      this.socket.close();
      return;
    }

    /** Grow payloads from observed drain, or from accepted sends when RN has no queue signal. */
    const bufferedAmount = this.getBufferedAmount();
    const drainedBytes = this.getDrainedBytes(bufferedAmount);
    const maxMessageSize = this.getMaxMessageSize(bufferedAmount);
    const nextSizeIncrement =
      this.data.length >= maxMessageSize
        ? Infinity
        : 16 * this.data.length;
    if (drainedBytes >= nextSizeIncrement) {
      this.data = new Uint8Array(
        Math.min(this.data.length * 2, maxMessageSize),
      );
    }

    /** Keep the socket fed; RN's no-bufferedAmount path uses a wider bounded window. */
    const desiredBuffer = this.getDesiredBuffer(bufferedAmount);
    if (this.getQueuedBytes(bufferedAmount) < desiredBuffer) {
      this.socket.send(this.data);
      this.total += this.data.length;
    }

    /** Emit progress on the protocol cadence instead of every scheduling tick. */
    if (timestamp >= this.previous + this.ndt7Protocol.progressIntervalMs) {
      this.emitUploadMeasurement();
      this.previous = timestamp;
    }

    /** Yield so socket buffering can advance before the next pacing pass. */
    setTimeout(() => this.tick(), 0);
  }

  /**
   * React Native may omit bufferedAmount, so callers must handle no queue signal.
   */
  private getBufferedAmount() {
    if (!this.socket || !Number.isFinite(this.socket.bufferedAmount)) {
      return null;
    }

    return Math.max(0, this.socket.bufferedAmount);
  }

  /**
   * Server AppInfo gives received-byte counts when React Native cannot expose bufferedAmount.
   */
  private handleServerMessage(data: unknown) {
    const serverMeasurement = this.ndt7Protocol.parseServerMeasurement(data);
    if (!serverMeasurement) {
      return;
    }

    this.latestMetrics = this.ndt7Protocol.getServerMetrics(serverMeasurement);
    const measurement = this.parseServerMeasurement(serverMeasurement);
    if (!measurement) {
      return;
    }

    this.latestServerMeasurement = measurement;
    this.emitMeasurement(measurement);
  }

  private parseServerMeasurement(message: Record<string, unknown>): UploadMeasurement | null {
    const appInfo = message.AppInfo;
    if (!UploadTestRunner.isRecord(appInfo)) {
      return null;
    }

    const bytesTransferred = appInfo.NumBytes;
    const elapsedMicroseconds = appInfo.ElapsedTime;
    if (
      !UploadTestRunner.isFiniteNumber(bytesTransferred) ||
      !UploadTestRunner.isFiniteNumber(elapsedMicroseconds) ||
      bytesTransferred < 0 ||
      elapsedMicroseconds <= 0
    ) {
      return null;
    }

    const elapsedMs = elapsedMicroseconds / 1000;
    return {
      speedMbps: this.ndt7Protocol.calculateMbps(bytesTransferred, elapsedMs),
      elapsedMs,
      bytesTransferred,
      metrics: this.latestMetrics,
    };
  }

  /**
   * Prefer server truth, then fall back to local accounting so completion never emits NaN.
   */
  private getBestMeasurement(): UploadMeasurement {
    if (this.latestServerMeasurement) {
      return this.latestServerMeasurement;
    }

    const bufferedAmount = this.getBufferedAmount();
    const bytesTransferred =
      bufferedAmount === null
        ? this.total
        : Math.max(0, Math.min(this.total, this.total - bufferedAmount));
    const elapsedMs = this.currentTime() - this.start;

    return {
      speedMbps: this.ndt7Protocol.calculateMbps(bytesTransferred, elapsedMs),
      elapsedMs,
      bytesTransferred,
      metrics: this.latestMetrics,
    };
  }

  private emitMeasurement(measurement: UploadMeasurement) {
    this.latestSpeed = measurement.speedMbps;
    this.callbacks.onProgress({
      phase: "upload",
      speedMbps: measurement.speedMbps,
      elapsedMs: measurement.elapsedMs,
      bytesTransferred: measurement.bytesTransferred,
      ...measurement.metrics,
    });
  }

  private getDrainedBytes(bufferedAmount: number | null) {
    if (bufferedAmount !== null) {
      return Math.max(0, Math.min(this.total, this.total - bufferedAmount));
    }

    return this.latestServerMeasurement?.bytesTransferred ?? this.total;
  }

  private getQueuedBytes(bufferedAmount: number | null) {
    if (bufferedAmount !== null) {
      return bufferedAmount;
    }

    return Math.max(
      0,
      this.total - (this.latestServerMeasurement?.bytesTransferred ?? 0),
    );
  }

  private getDesiredBuffer(bufferedAmount: number | null) {
    if (bufferedAmount !== null) {
      return 7 * this.data.length;
    }

    return this.maxFallbackQueueSize;
  }

  private getMaxMessageSize(bufferedAmount: number | null) {
    return bufferedAmount !== null
      ? this.maxMessageSize
      : this.maxFallbackMessageSize;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private static isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }
}

/**
 * Runs the upload phase by writing payloads to the NDT7 WebSocket.
 *
 * The phase owns socket lifecycle and upload pacing state; Ndt7Protocol
 * supplies the shared rules for URL lookup, subprotocol, timing, and Mbps math.
 */
export function runUploadTest(
  urls: Ndt7ServerURLs,
  ndt7Protocol: Ndt7Protocol,
  callbacks: UploadCallbacks,
) {
  const runner = new UploadTestRunner(ndt7Protocol, callbacks);

  return runNdt7WebSocketPhase({
    url: ndt7Protocol.getUploadURL(urls),
    websocketProtocol: ndt7Protocol.websocketProtocol,
    missingURLMessage: "Missing NDT7 upload URL",
    socketErrorMessage: "upload socket error",
    getResult: () => runner.getResult(),
    run: ({ socket, isSettled, markOpen }) => {
      runner.attach(socket, isSettled, markOpen);
    },
  });
}
