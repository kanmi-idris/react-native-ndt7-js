# Contributing

This package is a JavaScript-first NDT7 client for React Native and React Native Web. Contributions should keep the public API small, event-driven, and portable across runtimes that provide `fetch`, `URL`, and `WebSocket`.

## Prerequisites

- Node.js 18 or newer
- Yarn 1.x
- npm authentication only when publishing

Install dependencies with:

```bash
yarn install
```

## Useful commands

```bash
yarn test
yarn typecheck
yarn build
yarn release:check
```

- `yarn test` runs the Vitest suite in `tests`.
- `yarn typecheck` runs `tsc --noEmit`.
- `yarn build` compiles `src` into `lib` with React Native Builder Bob.
- `yarn release:check` runs tests, typechecking, and an npm dry-run pack.

## Project boundaries

- `src/index.ts` is the public facade. Keep exports intentional and stable.
- `src/controller.ts` owns the public lifecycle, event listeners, state, and one-active-run rule.
- `src/speedTestRun.ts` owns a single accepted run from start through terminal event.
- `src/ndt7Protocol.ts` owns protocol constants, URL rules, metadata, timing, byte sizing, and Mbps calculation.
- `src/discoverServer.ts` owns direct-server and M-Lab locate discovery behavior.
- `src/ndt7WebSocketPhase.ts` owns shared WebSocket phase settlement rules.
- `src/downloadTest.ts` owns download transfer measurement.
- `src/uploadTest.ts` owns upload transfer pacing and measurement.
- `src/types.ts` owns public TypeScript contracts.

Avoid generic `utils` or `shared` modules. If behavior needs a home, name the module after the domain concept it owns.

## Development guidelines

- Keep runtime code platform-neutral. Do not add native React Native dependencies unless the package goal changes.
- Keep cancellation best-effort unless the controller and phase APIs are changed together.
- Keep JSDoc focused on decisions that are not obvious from the code. Avoid restating function names or parameter types.
- Prefer adding focused tests when changing protocol rules, lifecycle transitions, discovery behavior, or transfer measurement.
- Keep generated `lib` output out of normal source edits unless you are building for a publish check.

## Before opening a pull request

Run:

```bash
yarn test
yarn typecheck
yarn build
```

For publish-related changes, also run:

```bash
yarn release:check
```

Check that the npm tarball contains only the package files expected by `package.json`.

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
