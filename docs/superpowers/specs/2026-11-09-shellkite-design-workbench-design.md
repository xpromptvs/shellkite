# Shellkite browser design workbench

## Intent

Develop Shellkite's interface in a browser, using its real components with controllable mock data. The user selected a browser-based workbench like Xpromptvs. Keep the existing visual style; subsequent design changes should edit the product components and appear in the workbench immediately.

## Approach

Adapt Xpromptvs's established workbench structure: surface emulation, frame/window chrome and Vite development routing. Supply Shellkite-specific desktop fixtures and mock adapters. A separate component gallery would be smaller but would miss full-page navigation, responsive layouts and connection state. A native workbench entry would add app packaging and rebuild work; the user chose browser-based instead.

The builder's choice is to reuse suitable infrastructure rather than importing the full terminal/agent mock system. No terminal, graphical agent, individual-window, simulator or glasses controls belong in this workbench. Production feature flags remain authoritative and unchanged.

## Screens and controls

The four preview surfaces are the Mac app, desktop browser, mobile browser and iOS web clip. Mac preview means a simulated Mac environment containing the real native-dashboard renderer and Shellkite client views; it does not launch or control a real Mac application.

Preview the actual dashboard, device list, sharing/settings/permissions panels, desktop session, display picker, connection status/preferences and existing dialogs. Use fixtures for first run/signed out, available Macs, connecting/connected/reconnecting, passive control with takeover, multiple displays, sleeping/no available display and permission errors. Existing dialogs remain interactive where they have mockable adapters. Real passkey, OS permission, clipboard and physical capture behavior are represented by explicit mock outcomes, not invoked.

A toolbar selects surface, fixture and dashboard/session starting point. Phone previews support orientation and keyboard appearance; fit/actual-size controls and a mock-host panel follow the established workbench. Retain useful background-color controls that edit shared production tokens live. Do not add terminal gradient tuning or agent tooling. Keep the shared loading indicator available for design inspection.

Mock desktops show recognizable sample desktop content and pointer feedback, sufficient to judge source fitting, layout and interaction styling. They are illustrative pictures rather than a performance or native-input simulation. Fixture changes and controls can open/close displays, change availability, hand control to another mock viewer and interrupt/recover the mock connection.

## Architecture and isolation

Serve `/design.html` through Vite in development. Frame entries install surface emulation, isolated storage and mock network/native bridges before loading real product entry modules. Reuse the existing transport injection seam, including the embedded controller's supported transport dependency, so production sessions still use their real connection path. A mock host supplies only canonical `dsp:` inventory/state plus authenticated-capability-shaped desktop metadata; this is a UI fixture, not a replacement for encrypted admission tests.

Only external adapters and fixtures are mocked. No duplicate dashboard, source picker, settings or session markup; no workbench-only restyling of product components. Workbench chrome and emulated OS/browser framing may have their own styles. Production styling edits must remain in production files.

Mock requests and native bridge actions stay local to the workbench. Use isolated per-workbench/per-frame storage without reading or modifying a user's real identities, pairing tokens or app settings. Fixture identities, if needed by dashboard code, are synthetic and never signed in with real passkeys. The development server exposes only necessary source/assets and development fixture endpoints, not repository-wide files or credentials. Do not weaken existing origin checks to make mocks work.

The workbench is excluded from production Vite inputs and assembled app resources. Its fixture endpoints exist only in the development plugin. Built clients contain no workbench startup/global hook beyond code already eliminated by the development guard. Production feature flags cannot be overridden by a workbench URL or fixture.

## Delivery and verification

Provide a documented one-command development entry and open the browser workbench for manual use. Native app rebuilding, installation, restarting, service deployment and GitHub pushes are outside this task unless separately requested.

Verify fixture state and mock protocol restrictions with focused tests; verify actual dashboard/session rendering across all four surfaces in Chromium and WebKit. Check display selection, empty/error/control/reconnect states, phone orientation/keyboard layout, isolated storage and absence of excluded feature affordances. Confirm edits reuse production components and production builds exclude workbench pages, fixture endpoints and mock startup. These checks do not establish actual passkey consent, native gesture/capture fidelity or permission behavior.
