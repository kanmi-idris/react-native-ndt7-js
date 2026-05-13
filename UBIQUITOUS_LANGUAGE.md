# Ubiquitous Language

## Package release

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Package** | The distributable npm library that provides the React Native NDT7 client. | Project, module, repo |
| **Scoped package** | The npm package published under the `_molaidrislabs` scope. | Org package, namespaced module |
| **Scope** | The npm namespace that owns the scoped package name. | Org, organization, namespace |
| **Public registry** | The npm registry where the package is published for public installation. | npm, registry |
| **Release check** | The maintainer command sequence that verifies tests, types, build output, and tarball contents before publishing. | Validation, publish check |
| **Dry run** | A simulated package or publish operation that verifies what would happen without changing the registry. | Preview, test publish |
| **Tarball** | The archive npm creates from the package files and uploads during publish. | Bundle, artifact |
| **Publish** | The npm operation that creates or updates a package version in the public registry. | Deploy, release |
| **One-time password** | The npm two-factor authentication code required to complete a publish. | OTP, auth code, 2FA code |

## Speed-test domain

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **NDT7 client** | The JavaScript-facing client used by an app to run NDT7 network speed tests. | Speed client, test module |
| **Speed test** | A single user-initiated measurement run that can include download and upload phases. | Network test, run |
| **Download test** | The speed-test phase that measures inbound throughput from the server to the app. | Downstream test |
| **Upload test** | The speed-test phase that measures outbound throughput from the app to the server. | Upstream test |
| **Locate service** | The service endpoint used to discover a suitable NDT7 server. | Locator, load balancer |
| **NDT7 server** | The remote server that participates in an NDT7 speed test. | Server, test server |
| **Data policy acceptance** | The user's confirmation that the app may run a network test that transfers data. | Consent, policy flag |
| **Test state** | The lifecycle value that describes the current status of a speed test. | Status, lifecycle |
| **Soft cancel** | A best-effort cancellation that invalidates the active run and returns state to idle. | Stop, abort, hard cancel |

## Events and subscriptions

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Progress event** | An event emitted during a speed test with the current phase and measured speed. | Progress update |
| **Completion event** | An event emitted when a speed test finishes successfully with final measured results. | Done event, result event |
| **Error event** | An event emitted when a speed test fails with an error code and message. | Failure event |
| **State-change event** | An event emitted when the speed test lifecycle state changes. | Status event |
| **Subscription** | The removable listener registration returned when a consumer subscribes to an event. | Listener, handler |

## People and systems

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Maintainer** | A person responsible for preparing, validating, and publishing the package. | Publisher, developer |
| **Package consumer** | An app or developer that installs and imports the published package. | User, client |
| **npm account** | The authenticated npm identity used to publish the package. | Account, user |
| **npm scope owner** | The npm account or organization authorized to publish under the package scope. | Org owner, scope admin |

## Relationships

- A **Scoped package** belongs to exactly one **Scope**.
- A **Package** version produces exactly one publishable **Tarball**.
- A **Publish** uploads one **Tarball** to the **Public registry**.
- A **Release check** should pass before every **Publish**.
- A **Publish** may require exactly one current **One-time password**.
- A **Package consumer** imports the **NDT7 client** from the **Scoped package**.
- A **Speed test** has one current **Test state**.
- A **Speed test** can include one **Download test** and one **Upload test**.
- A **Locate service** selects an **NDT7 server** for a **Speed test**.
- A **Subscription** listens for one event type and can be removed by the **Package consumer**.

## Example dialogue

> **Dev:** "Are we deploying the library to npm under `_molaidrislabs`?"
> **Domain expert:** "Use **Publish**, not deploy. We are publishing the **Scoped package** `@_molaidrislabs/react-native-ndt7-js` to the **Public registry**."
> **Dev:** "Should I run a **Dry run** first?"
> **Domain expert:** "Yes. The **Release check** must pass, then the publish **Dry run** confirms the **Tarball** and public access."
> **Dev:** "The publish failed after tests passed because npm asked for a code."
> **Domain expert:** "That means the **npm account** requires a **One-time password** before it can complete the **Publish**."

## Flagged ambiguities

- "deploy to npm" was used to mean **Publish**; use **Publish** for npm registry operations.
- "org" was used for `_molaidrislabs`, but in npm package naming this is a **Scope** unless the conversation is specifically about npm organization ownership.
- "client" can mean both **NDT7 client** and **Package consumer**; use **NDT7 client** for the library API and **Package consumer** for the app or developer using it.
- "server" can mean a local development server or an **NDT7 server**; use **NDT7 server** when discussing speed-test measurement.
- "stop" can imply a hard network shutdown, but the current package behavior is **Soft cancel**.
