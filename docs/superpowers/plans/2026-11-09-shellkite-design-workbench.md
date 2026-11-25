# Shellkite Design Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task inline. One fresh final reviewer; no implementer subagents.

**Goal:** Open a browser-based development workbench showing real Shellkite screens on Mac, desktop browser, mobile browser and iOS web-clip surfaces.

**Architecture:** Adapt Xpromptvs's development routing, surface geometry/emulation and frame chrome. A new display-only mock host/world and local native/dashboard adapters drive real Shellkite components. The production feature profile and connection/security behavior remain unchanged.

**Tech Stack:** TypeScript, Vite, shared Shellkite DOM/CSS components, Playwright Chromium/WebKit.

**Spec:** `docs/superpowers/specs/2026-11-09-shellkite-design-workbench-design.md`

## Global Constraints

- Browser-based `/design.html`, development only; no native rebuild/restart, service deployment or GitHub push.
- Real product markup/styles/modules; mocks own external adapters, fixture data and emulated OS/browser framing only.
- No terminal, agent, individual-window, simulator or glasses functionality or feature overrides.
- Mock network/clipboard/passkeys/native actions stay local; actual identities/settings remain untouched.
- No new dependencies. Source reference is the committed Xpromptvs workbench; do not modify the user's active rdev checkout.

## Review Focus

1. Reload/surface switches must retain the world while preventing stale frames/listeners or disconnected transports from changing it.
2. Mock sign-in/sharing/permissions/copy actions must never invoke live credentials, network APIs, OS actions or real clipboard.
3. Mac dashboard connects through real renderer adapters; browser/mobile use the real dashboard and client, including the embedded transport seam rather than a dead global hook.
4. Vite routes must reject untrusted hosts/traversal/private-file access; build outputs must omit all workbench pages and mocks.
5. Phone orientation/keyboard/background changes must update existing frames and their real UI, preserve chosen mock state and keep disabled feature affordances absent.

## File map

- `web/vite-design-plugin.ts`: development-only virtual frame/app routes and bounded synthetic identity endpoint, with pure rewrite helpers for testing.
- `web/src/design/{surfaces,emulate}.ts`: adapted existing geometry/media/storage emulation.
- `web/src/design/{fixtures,mock-host,world}.ts`: typed display-only fixtures, real protocol channel-shaped mock transport and shared mock world.
- `web/src/design/{boot,mock-app,workbench}.ts`: real UI mounting, mock native renderer bridge, surface/window/toolbar controls.
- `web/design.html`, `web/src/design/workbench.css`: workbench chrome and device framing only.
- `web/test/design-{server,host,surfaces,boot}.test.ts`, `e2e/shellkite-design-check.mjs`: focused invariants and actual browser checks.
- `web/package.json`, `web/vite.config.ts`, `docs/design-workbench.md`: entry command/plugin and usage.

### Task 1: Development routes and isolated surface primitives

**Interfaces:** export `designWorkbench(): Plugin` (serve-only); serve `/design/frame.html` from actual web index and `/design/app.html` from actual native-dashboard HTML with boot inserted first. Adapt `SurfaceId`, `phoneLayout`, `emulationFor`, `installEmulation` and `isolateStorage` from Xpromptvs. Synthetic identities are local-origin fixtures only.

- [ ] Write `design-server.test.ts`: actual HTML rewriting preserves product styles, installs boot before renderer, refuses unknown markup; trusted loopback hosts only, no arbitrary paths/origins; plugin is `apply:serve` and build inputs omit design.
- [ ] Write `design-surfaces.test.ts`: four surfaces, phone portrait/landscape/keyboard geometry, CSS media/safe-area rewriting and storage namespaces cannot expose ordinary keys. Run focused tests: expected RED before modules exist.
- [ ] Implement the dev plugin and adapted surface primitives; register plugin without adding build entries. Add `npm --prefix web run design` using loopback and strict port 5190. Run focused tests/typecheck: expected GREEN.
- [ ] Commit route/primitives deliverable.

### Task 2: Display-only mock host and shared fixture world

**Interfaces:** `DesktopMockHost` exposes fixture-driven state, subscription notifications and `transport(): Transport`; `WorkbenchWorld` owns mock Macs, current fixture, safe clipboard, native state and subscribers. Fixtures cover signed-out, available/connected/connecting/reconnecting/passive, multi-display, asleep/no display and permissions. No simulated terminal wire or agent runtime.

- [ ] Write `design-host.test.ts`: canonical dsp-only lists/view/control, ignored excluded messages, close/minimize/focus/restore, takeover, reconnect and sleeping/no-display snapshots. Test detached transports cannot send and stale updates do not mutate a reset world; state survives new viewer mounts. Expected RED.
- [ ] Implement fixtures/host/world using production `Transport`/channels and codec, with illustrated desktop media tracks or an equivalent supported mock media sink. Bound all event/timer/media lifetimes to connections. No real WebSocket or credentials.
- [ ] Run host tests and product session tests; expected GREEN. Commit mock-world deliverable.

### Task 3: Real screens, native dashboard adapter and workbench controls

**Interfaces:** each frame boots emulation/storage/mocks before importing actual product modules. Client mounting uses `mountClient` with `{kind:transport}` or the supported embedded controller adapter. Browser dashboard uses actual `mountWelcome` with fixture identity/list/watch dependencies. Native dashboard imports actual desktop renderer after `rdevApp` bridge installation. Frames share world through a same-origin parent capability and dispose registrations on unload.

- [ ] Write `design-boot.test.ts`: real dashboard/model dependencies, local-only credential/network/clipboard behavior, native bridge snapshot/actions and cleanup, disabled surfaces absent. Expected RED.
- [ ] Implement boot/native bridge and frame contract. Keep settings/sharing/permissions/identity dialogs interactive with explicit mock outcomes; synthetic identity persistence uses isolated memory/storage only.
- [ ] Build `/design.html` and workbench chrome: four surfaces, dashboard/session start, fixture selector, orientation/keyboard, zoom, mock-host controls, live background tokens, production loading-indicator inspection. Frame/OS chrome may adapt existing CSS; do not copy/restyle production screens. Keep toolbar settings in Shellkite-owned development storage/hash.
- [ ] Verify focused tests and typecheck; expected GREEN. Commit usable workbench.

### Task 4: Browser acceptance, production exclusion and delivery

**Interfaces:** `e2e/shellkite-design-check.mjs` runs against the isolated design server and uses only synthetic data. Usage documents controls, safe mock boundaries and product-edit workflow.

- [ ] Add browser assertions that fail on incomplete surfaces: Chromium/WebKit on all four surfaces; actual Mac renderer and browser dashboard; connect to desktop; palette contains displays only; close/minimize/takeover/recovery; empty/sleep/permission states; phone orientation/keyboard; live colors; frame reload/storage isolation. Monitor page errors and fail unexpected live network/credentials/clipboard calls.
- [ ] Fix integration gaps and run focused tests, full web suite, renderer typecheck and production web build. Expected GREEN. Assert production dist has no design HTML, source mocks, fixture endpoints or workbench globals/startup; product flags remain immutable desktop-only.
- [ ] Document `npm --prefix web run design` and developer controls. Commit verified delivery.
- [ ] Obtain one fresh final review over the branch, resolve material findings in one RED/GREEN fix pass, retain audit/rulings, open `/design.html` in the user's browser and provide its URL. Keep the feature branch/local checkout available; no push or app replacement.
