# React Native NDT7

This context describes the language for a JavaScript-first React Native package that runs NDT7 network speed tests.

## Language

**NDT7 protocol rules**:
The endpoint keys, WebSocket subprotocol, timing cadence, byte measurement, and throughput calculations required to run an NDT7 speed test correctly.
_Avoid_: Shared utilities, utils, helpers

**NDT7 protocol module**:
The source module that owns the **NDT7 protocol rules** for discovery, download, and upload code.
_Avoid_: Shared module, utils module, helpers module

**NDT7 protocol object**:
A configuration-stateful object that provides **NDT7 protocol rules** without owning active speed-test run state.
_Avoid_: Utility object, run controller, socket manager

**Discovery policy**:
The caller-provided server selection options used to choose an NDT7 server.
_Avoid_: Protocol rules, measurement rules

**NDT7 discovery policy**:
The module-owned policy object that applies **Discovery policy** for one speed-test run.
_Avoid_: Locate helper, server utility

**Package identity**:
The package name and version reported to external systems during an NDT7 speed test.
_Avoid_: Package metadata, npm fields

**Speed test run**:
One accepted speed-test execution from server discovery through terminal completion, failure, or cancellation.
_Avoid_: Phase sequence, test helper, controller internals

**Speed test run module**:
The source module that owns the **Speed test run** lifecycle.
_Avoid_: Orchestration helper, controller extraction

**Speed test phase lifecycle**:
The shared WebSocket phase behavior for resolving, rejecting, and reporting one download or upload phase exactly once.
_Avoid_: Generic WebSocket abstraction, transfer loop

**Speed test phase module**:
The source module that owns **Speed test phase lifecycle** behavior.
_Avoid_: WebSocket utilities, phase helper

## Relationships

- A **Speed test** follows the **NDT7 protocol rules** during discovery, download, and upload measurement.
- **NDT7 protocol rules** include both protocol constants and measurement primitives.
- The **NDT7 protocol module** owns the **NDT7 protocol rules**.
- An **NDT7 protocol object** owns configuration-level protocol behavior, while a **Speed test** owns per-run measurement state.
- A **Speed test** creates one **NDT7 protocol object** and passes it through discovery, download, and upload.
- **Discovery policy** selects where to run a **Speed test**; **NDT7 protocol rules** define how URLs and measurements are formed.
- **Discovery policy** owns direct-server bypass, locate service selection, fetch execution, authorization headers, locate response parsing, and server-choice callbacks.
- **NDT7 discovery policy** applies **Discovery policy** while delegating URL/key/query rules to the **NDT7 protocol object**.
- **Package identity** is defined in source for runtime use and checked against `package.json` in tests.
- A **Speed test run** owns the single-run lifecycle; the controller owns the public facade and one-active-run policy.
- A **Speed test run** observes cancellation through a controller-provided current-run check rather than owning active-run identity.
- A **Speed test run** reports state, progress, completion, and errors through a narrow lifecycle interface instead of raw event objects.
- The **Speed test run module** exposes the **Speed test run** lifecycle to the controller.
- **Speed test phase lifecycle** owns shared settlement rules; download and upload modules own their transfer loops.
- The **Speed test phase module** exposes **Speed test phase lifecycle** behavior to download and upload modules.
- The **Speed test phase module** creates the WebSocket and gives download/upload modules a socket plus settlement callbacks.
- In **Speed test phase lifecycle**, socket close means successful phase completion unless the phase already settled earlier.

## Example dialogue

> **Dev:** "Should we move these helpers into shared utils?"
> **Domain expert:** "No — they are **NDT7 protocol rules**, so put them behind a domain-named module."
> **Dev:** "Should that be a class?"
> **Domain expert:** "Yes, but the **NDT7 protocol object** should hold configuration, not socket lifecycle or per-run counters."

## Flagged ambiguities

- "shared module" was initially ambiguous between a generic utility bucket and a domain module; resolved: use a domain-named module for **NDT7 protocol rules**.
