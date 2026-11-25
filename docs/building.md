# Building Shellkite

Use an Apple Silicon Mac running macOS 26+, Xcode command-line tools, Node.js 20.19+, npm, Bazelisk and CMake. Bazel is the only native build system. Dependency versions and codec submodules are pinned.

Run the README commands. The default output is `desktop/release-check/Shellkite Development.app`, with identity `com.xpromptvs.shellkite.development`. Choose a fresh `RDEV_APP_OUT` for another build; assembly refuses existing output. Automated checks must leave installed applications untouched.

`config/product.json` defines Shellkite's identity, client URL and service/RP separation. `config/product-features.json` keeps every profile desktop-only; development overrides do not enable terminals, agents, windows, simulators or glasses. Native application bundle metadata mirrors the canonical identity and is checked by product tests.

App data, cache, identity keys and WKWebView stores are isolated from Xpromptvs. Source builds have no official passkey entitlement. A source Mac can be added as a host by code from an authorized device. Its embedded viewer has no official native passkey entitlement; use a guest pairing link or the separately authorized browser viewer. Do not copy another app's identity directory. Sharing needs Screen Recording and Accessibility. Ad-hoc rebuilds can require granting these permissions again.

Official distribution uses `ai.xpromptvs.shellkite` and requires a matching `app/Shellkite.provisionprofile`, the service's associated-domain authorization, Developer ID signing and notarization under the publisher's own credentials. No Xpromptvs provisioning profile is included. `RDEV_APP_DISTRIBUTION=official` selects this path, which must fail until the matching prerequisites exist. Updates remain disabled pending distribution review; no Xpromptvs manifest is accepted.

Shellkite's client URL is separate from the authentication service. The RP remains `xpromptvs.ai`; changing the viewer domain does not authorize passkey ceremonies on that domain.
