import { resolveNdt7ServerURLs } from './discoverServer';
import { runDownloadTest } from './downloadTest';
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

/**
 * Owns one accepted speed-test run from discovery through terminal events.
 *
 * The controller owns whether this run is still current; this module owns what
 * a current run does and which events it emits while it remains current.
 */
export async function runSpeedTest({ options, lifecycle, isCurrent }: SpeedTestRunRequest) {
  try {
    const ndt7Protocol = new Ndt7Protocol({
      protocol: options.protocol,
    });

    const urls = await resolveNdt7ServerURLs(
      {
        server: options.server,
        protocol: options.protocol,
        loadbalancer: options.loadbalancer,
        clientRegistrationToken: options.clientRegistrationToken,
        metadata: options.metadata,
      },
      {},
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
    lifecycle.emitComplete({
      downloadMbps: download.speedMbps,
      uploadMbps: upload.speedMbps,
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
