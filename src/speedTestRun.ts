import { resolveNdt7ServerURLs } from './discoverServer';
import { runDownloadTest } from './downloadTest';
import type { Ndt7ServerMetrics } from './ndt7Protocol';
import { Ndt7Protocol } from './ndt7Protocol';
import { runUploadTest } from './uploadTest';
import type {
  Ndt7StartOptions,
  Ndt7CompleteEvent,
  Ndt7ErrorEvent,
  Ndt7ProgressEvent,
  SpeedTestState,
} from './types';

type SpeedTestRunLifecycle = {
  transition(state: SpeedTestState): void;
  emitProgress(event: Ndt7ProgressEvent): void;
  emitComplete(event: Ndt7CompleteEvent): void;
  emitError(event: Ndt7ErrorEvent): void;
};

type SpeedTestRunRequest = {
  options: Ndt7StartOptions;
  lifecycle: SpeedTestRunLifecycle;
  isCurrent(): boolean;
};

const MLAB_DATA_POLICY_ERROR =
  'The M-Lab data policy is applicable and the user has not explicitly accepted that data policy.';

/**
 * Owns one accepted speed-test run from discovery through terminal events.
 *
 * The controller owns whether this run is still current; this module owns what
 * a current run does and which events it emits while it remains current.
 */
export async function runSpeedTest({ options, lifecycle, isCurrent }: SpeedTestRunRequest) {
  try {
    enforceMlabDataPolicy(options);

    const ndt7Protocol = new Ndt7Protocol({
      protocol: options.protocol,
    });
    let selectedServer: unknown;

    const urls = await resolveNdt7ServerURLs(
      {
        server: options.server,
        protocol: options.protocol,
        loadbalancer: options.loadbalancer,
        clientRegistrationToken: options.clientRegistrationToken,
        metadata: options.metadata,
      },
      {
        onServerChosen: server => {
          selectedServer = server;
        },
      },
      ndt7Protocol
    );

    if (!isCurrent()) {
      return;
    }

    lifecycle.transition('running');

    const download = await runDownloadTest(
      urls,
      ndt7Protocol,
      {
        onProgress: event => {
          if (isCurrent() && options.emitProgress !== false) {
            lifecycle.emitProgress(event);
          }
        },
      }
    );

    if (!isCurrent()) {
      return;
    }

    const upload = await runUploadTest(
      urls,
      ndt7Protocol,
      {
        onProgress: event => {
          if (isCurrent() && options.emitProgress !== false) {
            lifecycle.emitProgress(event);
          }
        },
      }
    );

    if (!isCurrent()) {
      return;
    }

    lifecycle.transition('completed');
    const metrics = mergeMetrics(download.metrics, upload.metrics);
    const serverMetadata = getServerMetadata(selectedServer);
    lifecycle.emitComplete({
      downloadMbps: download.speedMbps,
      uploadMbps: upload.speedMbps,
      ...metrics,
      ...serverMetadata,
      timestamp: Date.now(),
    });
    lifecycle.transition('idle');
  } catch (error) {
    if (!isCurrent()) {
      return;
    }

    lifecycle.emitError({
      code: 'TEST_FAILED',
      message: error instanceof Error ? error.message : 'Speed test failed',
    });
    lifecycle.transition('failed');
    lifecycle.transition('idle');
  }
}

/** Match upstream ndt7-js: do not contact M-Lab until policy acceptance is explicit. */
function enforceMlabDataPolicy(options: Ndt7StartOptions) {
  if (
    options.userAcceptedDataPolicy === true ||
    options.mlabDataPolicyInapplicable === true
  ) {
    return;
  }

  throw new Error(MLAB_DATA_POLICY_ERROR);
}

/** Later phases refresh live RTT/jitter, while min RTT keeps the best observed floor. */
function mergeMetrics(
  ...metricSets: Array<Ndt7ServerMetrics | undefined>
): Ndt7ServerMetrics {
  const metrics: Ndt7ServerMetrics = {};

  for (const metricSet of metricSets) {
    if (!metricSet) {
      continue;
    }

    if (metricSet.latencyMs !== undefined) {
      metrics.latencyMs = metricSet.latencyMs;
    }

    if (metricSet.jitterMs !== undefined) {
      metrics.jitterMs = metricSet.jitterMs;
    }

    if (metricSet.minRttMs !== undefined) {
      metrics.minRttMs =
        metrics.minRttMs === undefined
          ? metricSet.minRttMs
          : Math.min(metrics.minRttMs, metricSet.minRttMs);
    }
  }

  return metrics;
}

/** Locate returns provider-specific payloads, so expose only stable display fields. */
function getServerMetadata(server: unknown) {
  if (!isRecord(server)) {
    return {};
  }

  const serverName =
    getString(server, 'machine') ??
    getString(server, 'hostname') ??
    getString(server, 'name');
  const location = getLocation(server);

  return {
    ...(serverName ? { serverName } : {}),
    ...(location ? { serverLocation: location } : {}),
  };
}

/** Location helps apps show which M-Lab site was used without exposing raw locate data. */
function getLocation(server: Record<string, unknown>) {
  const directLocation = getString(server, 'location');
  if (directLocation) {
    return directLocation;
  }

  const location = getRecord(server, 'location');
  const locationParts = location
    ? [
        getString(location, 'city'),
        getString(location, 'region'),
        getString(location, 'country'),
      ]
    : [
        getString(server, 'city'),
        getString(server, 'metro'),
        getString(server, 'country'),
      ];

  return locationParts.filter(Boolean).join(', ') || undefined;
}

function getString(source: Record<string, unknown>, key: string) {
  const value = source[key];

  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getRecord(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const value = source[key];

  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
