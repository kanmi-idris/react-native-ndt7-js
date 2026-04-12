import { Ndt7Controller } from './controller';

const controller = new Ndt7Controller();

export const Ndt7 = {
  startSpeedTest: controller.startSpeedTest.bind(controller),
  stopSpeedTest: controller.stopSpeedTest.bind(controller),
  getState: controller.getState.bind(controller),
  addListener: controller.addListener.bind(controller),
};

export type {
  EventSubscription,
  Ndt7CompleteEvent,
  Ndt7ErrorEvent,
  Ndt7ProgressEvent,
  Ndt7StateChangeEvent,
  SpeedTestPhase,
  SpeedTestState,
  StartSpeedTestOptions,
  StartSpeedTestResult,
} from './types';
