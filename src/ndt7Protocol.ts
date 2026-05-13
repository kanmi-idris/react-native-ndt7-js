type Ndt7NetworkProtocol = "ws" | "wss";
type Ndt7Endpoint = "download" | "upload";
export type Ndt7ServerURLs = Record<string, string>;
type Clock = () => number;

type Ndt7ProtocolOptions = {
  protocol?: Ndt7NetworkProtocol;
  now?: Clock;
  progressIntervalMs?: number;
};

/**
 * Provides the NDT7 rules used by one speed-test run.
 *
 * This object does not open WebSockets or return test results. Discovery and
 * phase modules do that work; this class only keeps endpoint keys, timing,
 * byte sizing, and Mbps math consistent across those modules.
 */
export class Ndt7Protocol {
  private static readonly NDT7_WEBSOCKET_PROTOCOL = "net.measurementlab.ndt.v7";
  readonly networkProtocol: Ndt7NetworkProtocol;
  readonly progressIntervalMs: number;
  readonly websocketProtocol = Ndt7Protocol.NDT7_WEBSOCKET_PROTOCOL;
  private readonly clock: Clock;
  private static readonly endpointPaths = {
    download: "/ndt/v7/download",
    upload: "/ndt/v7/upload",
  } as const satisfies Record<Ndt7Endpoint, string>;

  /**
   * Prefer monotonic time when available because speed calculations should not
   * move backwards if the device clock changes during a test.
   */
  private static defaultClock(): Clock {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      return () => performance.now();
    }

    return () => Date.now();
  }

  constructor(options: Ndt7ProtocolOptions = {}) {
    this.networkProtocol = options.protocol ?? "wss";
    this.clock = options.now ?? Ndt7Protocol.defaultClock();
    this.progressIntervalMs = options.progressIntervalMs ?? 250;
  }

  now(): number {
    return this.clock();
  }

  getURLKey(endpoint: Ndt7Endpoint): string {
    return `//${Ndt7Protocol.endpointPaths[endpoint]}`;
  }

  getEndpointPath(endpoint: Ndt7Endpoint): string {
    return Ndt7Protocol.endpointPaths[endpoint];
  }

  getLocateURLKey(endpoint: Ndt7Endpoint): string {
    return `${this.networkProtocol}://${Ndt7Protocol.endpointPaths[endpoint]}`;
  }

  buildServerURLs(downloadURL: string, uploadURL: string): Ndt7ServerURLs {
    return {
      [this.getURLKey("download")]: downloadURL,
      [this.getURLKey("upload")]: uploadURL,
    };
  }

  getDownloadURL(urls: Ndt7ServerURLs): string | undefined {
    return urls[this.getURLKey("download")];
  }

  getUploadURL(urls: Ndt7ServerURLs): string | undefined {
    return urls[this.getURLKey("upload")];
  }

  getLocateDownloadURL(urls: Record<string, string>): string | undefined {
    return urls[this.getLocateURLKey("download")];
  }

  getLocateUploadURL(urls: Record<string, string>): string | undefined {
    return urls[this.getLocateURLKey("upload")];
  }

  /**
   * WebSocket payload shapes differ between React Native and web runtimes for
   * byte sizing
   */
  getMessageSize(data: string | Blob | ArrayBuffer): number {
    if (typeof data === "string") {
      return data.length;
    }

    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }

    if ("size" in data && typeof data.size === "number") {
      return data.size;
    }

    return 0;
  }

  /**
   * Calculate bits per second from bytes transferred and elapsed time in milliseconds
   * 8 bits per byte.
   * 1000000 bits per megabit.
   * 1000 milliseconds per second.
   * So Formula: (bytes * 8) / 1000000 / (elapsedMs / 1000)
   * Turns “bytes sent over time” into Mbps.
   */
  calculateMbps(bytes: number, elapsedMs: number): number {
    return elapsedMs > 0 ? (bytes * 8) / 1000000 / (elapsedMs / 1000) : 0;
  }
}
