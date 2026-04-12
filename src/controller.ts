import { discoverServerURLs } from './discoverServer';
import { Ndt7Emitter } from './emitter';
import { SpeedTestStateMachine } from './stateMachine';
import { runDownloadTest } from './downloadTest';
import { runUploadTest } from './uploadTest';
import type {
  EventSubscription,
  Ndt7EventMap,
  StartSpeedTestOptions,
  StartSpeedTestResult,
} from './types';

export class Ndt7Controller {
  private readonly emitter = new Ndt7Emitter();
  private readonly stateMachine = new SpeedTestStateMachine(this.emitter);
  private activeRunId: number | null = null;
  private nextRunId = 1;

  async startSpeedTest(options: StartSpeedTestOptions = {}): Promise<StartSpeedTestResult> {
    const currentState = this.stateMachine.getState();
    if (currentState === 'starting' || currentState === 'running' || currentState === 'stopping') {
      return { state: currentState, alreadyRunning: true };
    }

    const runId = this.nextRunId++;
    this.activeRunId = runId;
    this.stateMachine.transition('starting');

    queueMicrotask(async () => {
      try {
        const urls = await discoverServerURLs(
          {
            emitProgress: options.emitProgress,
            server: options.server,
            protocol: options.protocol,
            loadbalancer: options.loadbalancer,
            clientRegistrationToken: options.clientRegistrationToken,
            metadata: options.metadata,
            userAcceptedDataPolicy: options.userAcceptedDataPolicy ?? true,
            mlabDataPolicyInapplicable: options.mlabDataPolicyInapplicable,
          },
          {}
        );

        if (this.activeRunId !== runId) {
          return;
        }

        this.stateMachine.transition('running');

        const download = await runDownloadTest(urls, {
          onProgress: event => {
            if (this.activeRunId === runId && options.emitProgress !== false) {
              this.emitter.emit('progress', event);
            }
          },
        });

        if (this.activeRunId !== runId) {
          return;
        }

        const upload = await runUploadTest(urls, {
          onProgress: event => {
            if (this.activeRunId === runId && options.emitProgress !== false) {
              this.emitter.emit('progress', event);
            }
          },
        });

        if (this.activeRunId !== runId) {
          return;
        }

        this.stateMachine.transition('completed');
        this.emitter.emit('complete', {
          downloadMbps: download.speedMbps,
          uploadMbps: upload.speedMbps,
          timestamp: Date.now(),
        });
        this.activeRunId = null;
        this.stateMachine.transition('idle');
      } catch (error) {
        if (this.activeRunId !== runId) {
          return;
        }

        this.emitter.emit('error', {
          code: 'TEST_FAILED',
          message: error instanceof Error ? error.message : 'Speed test failed',
        });
        this.stateMachine.transition('failed');
        this.activeRunId = null;
        this.stateMachine.transition('idle');
      }
    });

    return {
      state: this.stateMachine.getState(),
      alreadyRunning: false,
    };
  }

  async stopSpeedTest(): Promise<void> {
    const currentState = this.stateMachine.getState();
    if (currentState === 'idle') {
      return;
    }

    this.activeRunId = null;
    this.stateMachine.transition('stopping');
    this.emitter.emit('error', {
      code: 'CANCELLED',
      message: 'Speed test cancelled',
    });
    this.stateMachine.transition('idle');
  }

  async getState() {
    return this.stateMachine.getState();
  }

  addListener<EventName extends keyof Ndt7EventMap>(
    event: EventName,
    listener: (payload: Ndt7EventMap[EventName]) => void
  ): EventSubscription {
    return this.emitter.addListener(event, listener);
  }
}
