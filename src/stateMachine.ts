import type { Ndt7Emitter } from './emitter';
import type { SpeedTestState } from './types';

export class SpeedTestStateMachine {
  private state: SpeedTestState = 'idle';

  constructor(private readonly emitter: Ndt7Emitter) {}

  getState(): SpeedTestState {
    return this.state;
  }

  transition(next: SpeedTestState) {
    this.state = next;
    this.emitter.emit('stateChange', { state: next });
  }
}
