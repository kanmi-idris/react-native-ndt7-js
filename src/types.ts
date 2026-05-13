export type SpeedTestState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'failed';

export type SpeedTestPhase = 'download' | 'upload';

export interface Ndt7StartOptions {
  emitProgress?: boolean;
  server?: string;
  protocol?: 'ws' | 'wss';
  loadbalancer?: string;
  clientRegistrationToken?: string;
  metadata?: Record<string, string>;
  userAcceptedDataPolicy?: boolean;
  mlabDataPolicyInapplicable?: boolean;
}

export interface StartSpeedTestResult {
  state: SpeedTestState;
  alreadyRunning: boolean;
}

export interface Ndt7ProgressEvent {
  phase: SpeedTestPhase;
  speedMbps: number;
  elapsedMs: number;
  bytesTransferred: number;
  latencyMs?: number;
  jitterMs?: number;
  minRttMs?: number;
}

export interface Ndt7StateChangeEvent {
  state: SpeedTestState;
}

export interface Ndt7CompleteEvent {
  downloadMbps: number;
  uploadMbps: number;
  latencyMs?: number;
  jitterMs?: number;
  minRttMs?: number;
  serverName?: string;
  serverLocation?: string;
  timestamp: number;
}

export interface Ndt7ErrorEvent {
  code:
    | 'START_FAILED'
    | 'TEST_FAILED'
    | 'STOP_FAILED'
    | 'CANCELLED'
    | 'INTERNAL_ERROR';
  message: string;
}

export type Ndt7EventMap = {
  progress: Ndt7ProgressEvent;
  stateChange: Ndt7StateChangeEvent;
  complete: Ndt7CompleteEvent;
  error: Ndt7ErrorEvent;
};

export interface EventSubscription {
  remove(): void;
}
