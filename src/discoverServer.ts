import { Ndt7Protocol, type Ndt7ServerURLs } from "./ndt7Protocol";
import type { Ndt7StartOptions } from "./types";

type DiscoverCallbacks = {
  onServerChosen?: (server: unknown) => void;
};

/** Allows tests or runtimes to provide a fetch implementation without hardcoding global fetch. */
type FetchAdapter = typeof fetch;

type LocateResult = {
  urls?: Record<string, string>;
  [key: string]: unknown;
};

type LocateResponse = {
  results?: LocateResult[];
};

type Ndt7ServerResolutionOptions = Pick<
  Ndt7StartOptions,
  | "server"
  | "protocol"
  | "loadbalancer"
  | "clientRegistrationToken"
  | "metadata"
>;

type Ndt7ServerURLResolverOptions = {
  options: Ndt7ServerResolutionOptions;
  ndt7Protocol: Ndt7Protocol;
  fetch?: FetchAdapter;
};

/**
 * Resolves the concrete NDT7 download and upload URLs for one speed-test run.
 *
 * It uses direct-server options when supplied; otherwise it calls M-Lab locate,
 * including priority locate auth when a client registration token is supplied.
 * Ndt7Protocol still owns endpoint and URL key rules.
 */
class Ndt7ServerURLResolver {
  private static readonly MLAB_NDT7_LOCATE_URL =
    "https://locate.measurementlab.net/v2/nearest/ndt/ndt7";
  private static readonly MLAB_NDT7_PRIORITY_LOCATE_URL =
    "https://locate.measurementlab.net/v2/priority/nearest/ndt/ndt7";
  private static readonly PACKAGE_NAME =
    "@_molaidrislabs/react-native-internet-speed-test";
  private static readonly PACKAGE_VERSION = "0.1.4";
  private readonly options: Ndt7ServerResolutionOptions;
  private readonly ndt7Protocol: Ndt7Protocol;
  private readonly fetch: FetchAdapter;

  constructor({
    options,
    ndt7Protocol,
    fetch: fetchAdapter = (input, init) => globalThis.fetch(input, init),
  }: Ndt7ServerURLResolverOptions) {
    this.options = options;
    this.ndt7Protocol = ndt7Protocol;
    this.fetch = fetchAdapter;
  }

  async resolve(callbacks: DiscoverCallbacks = {}): Promise<Ndt7ServerURLs> {
    if (this.options.server) {
      return this.buildDirectServerURLs(this.options.server);
    }

    const loadBalancerURL = this.buildLoadBalancerURL();
    const response = await this.fetch(loadBalancerURL.toString(), {
      headers: this.buildAuthorizationHeaders(),
    });

    const payload = (await response.json()) as LocateResponse;
    const choice = payload.results?.[0];

    if (!choice?.urls) {
      throw new Error(
        `Could not understand response from ${loadBalancerURL.toString()}`,
      );
    }

    if (typeof callbacks.onServerChosen === "function") {
      callbacks.onServerChosen(choice);
    }

    const downloadURL = this.ndt7Protocol.getLocateDownloadURL(choice.urls);
    const uploadURL = this.ndt7Protocol.getLocateUploadURL(choice.urls);

    if (!downloadURL || !uploadURL) {
      throw new Error("Locate service did not return both NDT7 URLs");
    }

    return this.ndt7Protocol.buildServerURLs(downloadURL, uploadURL);
  }

  private buildLoadBalancerURL() {
    const loadBalancerURL = this.options.loadbalancer
      ? new URL(this.options.loadbalancer)
      : new URL(
          this.options.clientRegistrationToken
            ? Ndt7ServerURLResolver.MLAB_NDT7_PRIORITY_LOCATE_URL
            : Ndt7ServerURLResolver.MLAB_NDT7_LOCATE_URL,
        );
    const query = this.buildQueryString();

    if (query) {
      loadBalancerURL.search = query;
    }

    return loadBalancerURL;
  }

  /**
   * URL objects keep query assignment string-based across React Native and web
   * runtimes, avoiding URLSearchParams object coercion differences.
   */
  private buildDirectServerURLs(server: string): Ndt7ServerURLs {
    const query = this.buildQueryString();
    const downloadURL = new URL(
      `${this.ndt7Protocol.networkProtocol}://${server}${this.ndt7Protocol.getEndpointPath(
        "download",
      )}`,
    );
    const uploadURL = new URL(
      `${this.ndt7Protocol.networkProtocol}://${server}${this.ndt7Protocol.getEndpointPath(
        "upload",
      )}`,
    );

    if (query) {
      downloadURL.search = query;
      uploadURL.search = query;
    }

    return this.ndt7Protocol.buildServerURLs(
      downloadURL.toString(),
      uploadURL.toString(),
    );
  }

  /**
   * Library metadata is applied last so caller metadata cannot accidentally
   * change the package identity sent to M-Lab.
   */
  private buildQueryString(): string {
    return new URLSearchParams({
      ...this.options.metadata,
      client_library_name: Ndt7ServerURLResolver.PACKAGE_NAME,
      client_library_version: Ndt7ServerURLResolver.PACKAGE_VERSION,
    }).toString();
  }

  private buildAuthorizationHeaders() {
    return this.options.clientRegistrationToken
      ? {
          Authorization: `Bearer ${this.options.clientRegistrationToken}`,
        }
      : undefined;
  }
}

export async function resolveNdt7ServerURLs(
  options: Ndt7ServerResolutionOptions,
  callbacks: DiscoverCallbacks = {},
  ndt7Protocol = new Ndt7Protocol({
    protocol: options.protocol,
  }),
): Promise<Ndt7ServerURLs> {
  return new Ndt7ServerURLResolver({ options, ndt7Protocol }).resolve(
    callbacks,
  );
}
