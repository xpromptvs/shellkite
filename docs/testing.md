# Testing Shellkite

Run `npm --prefix protocol test`, `npm --prefix web test`, `npm --prefix desktop test` and `node --test scripts/test/*.test.mjs`. Retained full-product UI tests explicitly mock feature flags; the real Shellkite profile is separately tested to refuse excluded surfaces and executors. No runtime override enables them.

Use Bazel for native tests: `bazelisk test //host/RdevCore:RdevCoreTests //host/RdevE2E:RdevE2ETests //app:ShellstormCoreTests`. Host policy and connection tests live in `//host/RdevHostKit:RdevHostKitTests`. Some retained terminal fixtures require their measured tmux/utf8proc versions; these are compatibility tests, not Shellkite functionality.

Run the browser checks from `e2e/` after installing its dependencies and Chromium/WebKit. `shellkite-desktop-check.mjs` tests desktop and phone layouts against a local Vite server. `shellkite-enrollment-check.mjs` uses fixture identities, actual encrypted gates and browser Web Locks; it never invokes a user's passkey.

Manual acceptance covers actual account authorization on app.xpromptvs.ai, desktop video/audio, mouse dragging, modifier clicks, clipboard, trackpad/touch scrolling, ownership handoff, reconnect, lock-screen capture/control and Screen Recording/Accessibility consent. Synthetic UI checks cannot prove physical gestures or platform permission behavior.

Builds must use fresh output directories and isolated profiles. Never replace or launch an installed work application as part of an automated check. Official signing requires Shellkite's own registered App ID, matching provisioning profile and associated-domain authorization; source builds do not establish that these are ready.
