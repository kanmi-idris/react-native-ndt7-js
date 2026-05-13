import type { Ndt7Protocol, Ndt7ServerURLs } from "./ndt7Protocol";
import { runNdt7WebSocketPhase } from "./ndt7WebSocketPhase";
import type { Ndt7ProgressEvent } from "./types";

type UploadCallbacks = {
  onProgress: (event: Ndt7ProgressEvent) => void;
};

class UploadTestRunner {
  private readonly currentTime = () => this.ndt7Protocol.now();
  private readonly maxMessageSize = 8 * 1024 * 1024; // 8MiB
  private latestSpeed = 0;
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
    return { speedMbps: this.latestSpeed };
  }

  /**
   * Attaches the upload test runner to a WebSocket connection.
   */
  attach(socket: WebSocket, isSettled: () => boolean) {
    this.socket = socket;
    this.isSettled = isSettled;
    this.socket.onmessage = () => {
      // Upstream worker forwards server messages, but controller currently
      // exposes only normalized progress events, so no action is needed here.
    };
    this.socket.onopen = () => {
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

    const numBytes = this.total - this.socket.bufferedAmount;
    const elapsedMs = this.currentTime() - this.start;
    this.latestSpeed = this.ndt7Protocol.calculateMbps(numBytes, elapsedMs);
    this.callbacks.onProgress({
      phase: "upload",
      speedMbps: this.latestSpeed,
      elapsedMs,
      bytesTransferred: numBytes,
    });
  }

  /**
   * Payload size grows only after the socket drains enough data; this keeps
   * the sender aggressive without letting bufferedAmount explode.
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

    /** Grow payloads only after enough bytes have drained to avoid runaway buffering. */
    const nextSizeIncrement =
      this.data.length >= this.maxMessageSize
        ? Infinity
        : 16 * this.data.length;
    if (this.total - this.socket.bufferedAmount >= nextSizeIncrement) {
      this.data = new Uint8Array(
        Math.min(this.data.length * 2, this.maxMessageSize),
      );
    }

    /** Keep the socket fed, but cap queued data so progress still reflects network drain. */
    const desiredBuffer = 7 * this.data.length;
    if (this.socket.bufferedAmount < desiredBuffer) {
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
    run: ({ socket, isSettled }) => {
      runner.attach(socket, isSettled);
    },
  });
}
