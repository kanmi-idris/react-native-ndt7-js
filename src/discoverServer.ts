import type { StartSpeedTestOptions } from './types';

type DiscoverCallbacks = {
  onServerChosen?: (server: unknown) => void;
};

type LocateResult = {
  urls?: Record<string, string>;
  [key: string]: unknown;
};

type LocateResponse = {
  results?: LocateResult[];
};

const staticMetadata = {
  client_library_name: 'react-native-ndt7-js',
  client_library_version: '0.1.1',
};

function buildQueryString(metadata?: Record<string, string>) {
  return new URLSearchParams({
    ...metadata,
    ...staticMetadata,
  }).toString();
}

function buildDirectServerURLs(server: string, protocol: 'ws' | 'wss', query: string) {
  const downloadURL = new URL(`${protocol}://${server}/ndt/v7/download`);
  const uploadURL = new URL(`${protocol}://${server}/ndt/v7/upload`);

  if (query) {
    downloadURL.search = query;
    uploadURL.search = query;
  }

  return {
    '///ndt/v7/download': downloadURL.toString(),
    '///ndt/v7/upload': uploadURL.toString(),
  };
}

export async function discoverServerURLs(
  options: StartSpeedTestOptions,
  callbacks: DiscoverCallbacks = {}
) {
  const protocol = options.protocol ?? 'wss';
  const query = buildQueryString(options.metadata);

  if (options.server) {
    return buildDirectServerURLs(options.server, protocol, query);
  }

  const loadBalancerURL = options.loadbalancer
    ? new URL(options.loadbalancer)
    : new URL(
        options.clientRegistrationToken
          ? 'https://locate.measurementlab.net/v2/priority/nearest/ndt/ndt7'
          : 'https://locate.measurementlab.net/v2/nearest/ndt/ndt7'
      );

  if (query) {
    loadBalancerURL.search = query;
  }

  const response = await fetch(loadBalancerURL.toString(), {
    headers: options.clientRegistrationToken
      ? {
          Authorization: `Bearer ${options.clientRegistrationToken}`,
        }
      : undefined,
  });

  const payload = (await response.json()) as LocateResponse;
  const choice = payload.results?.[0];

  if (!choice?.urls) {
    throw new Error(`Could not understand response from ${loadBalancerURL.toString()}`);
  }

  if (typeof callbacks.onServerChosen === 'function') {
    callbacks.onServerChosen(choice);
  }

  const downloadURL = choice.urls[`${protocol}:///ndt/v7/download`];
  const uploadURL = choice.urls[`${protocol}:///ndt/v7/upload`];

  if (!downloadURL || !uploadURL) {
    throw new Error('Locate service did not return both NDT7 URLs');
  }

  return {
    '///ndt/v7/download': downloadURL,
    '///ndt/v7/upload': uploadURL,
  };
}
