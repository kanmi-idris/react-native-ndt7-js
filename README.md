# @_molaidrislabs/react-native-ndt7-js

JavaScript-first NDT7 client for React Native and React Native Web.

## Features

- API parity with `react-native-ndt7`
- no native code or platform setup
- event-driven API only
- works in React Native and React Native Web environments with `fetch`, `URL`, and `WebSocket`
- lightweight package shape with a soft-cancel v1 controller

## Installation

```bash
npm install @_molaidrislabs/react-native-ndt7-js
```

```bash
yarn add @_molaidrislabs/react-native-ndt7-js
```

This package currently pins `@m-lab/ndt7` to the tested upstream version to avoid behavior drift.

## API

```ts
import { Ndt7 } from '@_molaidrislabs/react-native-ndt7-js';

const progressSub = Ndt7.addListener('progress', event => {
  console.log(event.phase, event.speedMbps);
});

const completeSub = Ndt7.addListener('complete', result => {
  console.log(result.downloadMbps, result.uploadMbps);
});

await Ndt7.startSpeedTest({ userAcceptedDataPolicy: true });
await Ndt7.stopSpeedTest();
const state = await Ndt7.getState();

progressSub.remove();
completeSub.remove();
```

### Methods

- `startSpeedTest(options?) => Promise<{ state, alreadyRunning }>`
- `stopSpeedTest() => Promise<void>`
- `getState() => Promise<SpeedTestState>`
- `addListener(event, listener) => EventSubscription`

### State lifecycle

- `idle`
- `starting`
- `running`
- `stopping`
- `completed` then auto-resets to `idle`
- `failed` then auto-resets to `idle`

If a test is already active, `startSpeedTest()` returns the current state with `alreadyRunning: true`.

## Runtime flow

```text
+----------------+     schedules      +----------------+
| Ndt7Controller | -----------------> | runSpeedTest   |
| state + events |                    | one run        |
+----------------+                    +----------------+
        ^                                      |
        | progress + terminal events           | creates
        |                                      v
        |                              +----------------+
        |                              | Ndt7Protocol   |
        |                              | endpoint keys  |
        |                              | timing + Mbps  |
        |                              +----------------+
        |                                      |
        |                                      | shared rules
        |                                      v
        |                              +-----------------------+
        |                              | resolveNdt7ServerURLs |
        |                              | direct or M-Lab locate |
        |                              +-----------------------+
        |                                      |
        |                                      | download/upload URLs
        |                                      v
        |              +----------------+     then      +---------------+
        |              | runDownloadTest| ------------> | runUploadTest |
        |              | count received |               | send payloads |
        |              | bytes          |               | measure drain |
        |              +----------------+               +---------------+
        |                       |                               |
        |                       | uses                          | uses
        |                       v                               v
        |              +-----------------------------------------------+
        |              | runNdt7WebSocketPhase                         |
        |              | open socket, handle close/error, settle once   |
        |              +-----------------------------------------------+
        |                                      |
        +--------------------------------------+
```

## Usage scenarios

### 1. Minimal fire-and-forget test

```ts
import { Ndt7 } from '@_molaidrislabs/react-native-ndt7-js';

await Ndt7.startSpeedTest({
  userAcceptedDataPolicy: true,
});
```

### 2. Subscribe to progress and completion

```ts
import { Ndt7 } from '@_molaidrislabs/react-native-ndt7-js';

const subscriptions = [
  Ndt7.addListener('stateChange', event => {
    console.log('state', event.state);
  }),
  Ndt7.addListener('progress', event => {
    console.log(`${event.phase}: ${event.speedMbps.toFixed(2)} Mbps`);
  }),
  Ndt7.addListener('complete', event => {
    console.log('done', event.downloadMbps, event.uploadMbps);
  }),
  Ndt7.addListener('error', event => {
    console.warn(event.code, event.message);
  }),
];

await Ndt7.startSpeedTest({ userAcceptedDataPolicy: true });

// Later
subscriptions.forEach(subscription => subscription.remove());
```

### 3. Best-effort cancellation

```ts
import { Ndt7 } from '@_molaidrislabs/react-native-ndt7-js';

await Ndt7.startSpeedTest({ userAcceptedDataPolicy: true });

setTimeout(() => {
  void Ndt7.stopSpeedTest();
}, 2_000);
```

`stopSpeedTest()` is a soft cancel in v1. The controller invalidates the active run and returns state to `idle`, but underlying WebSocket shutdown is still best-effort.

### 4. Target a specific server or load balancer

```ts
import { Ndt7 } from '@_molaidrislabs/react-native-ndt7-js';

await Ndt7.startSpeedTest({
  userAcceptedDataPolicy: true,
  protocol: 'wss',
  server: 'ndt.example.net',
  metadata: {
    client_name: 'my-app',
    client_version: '1.2.3',
  },
});
```

Or use a custom locate service:

```ts
await Ndt7.startSpeedTest({
  userAcceptedDataPolicy: true,
  loadbalancer: 'https://locate.example.net/v2/nearest/ndt/ndt7',
});
```
