# Architecture and security

Shellkite is a Swift/AppKit app with a WKWebView dashboard and client, and an in-process Mac host. ScreenCaptureKit captures complete displays; the existing LLV/Pion engine sends media over WebRTC. Input, audio, clipboard delivery, ownership fencing and recovery use the existing protocol.

The shared service coordinates discovery, pairing and encrypted signaling. Endpoint device grants, root identities and revocations remain authoritative. Shellkite uses its own device keys and storage while joining the same account trust model.

Desktop-only scope is bound into the Noise handshake before an offer can carry state. Hosts attach the verified scope to the admitted connection generation and intersect it with their product limit. Excluded input is refused before dispatch; outbound snapshots, offers, inventories, previews and queues are projected. Capture is limited to displays. A full Xpromptvs host retains its mixed tabs through a restricted-driver handoff.

Every Shellkite build is a desktop-only host and viewer. Shared parsers and inactive source modules remain for protocol compatibility. No terminal, agent or simulator executor may start. Native source windows retain their source identity and admission/ownership fences, and the host's own windows remain excluded from capture.

Browser enrollment across the Shellkite viewer domain and the existing passkey domain requires explicit encrypted device adoption. Root and private keys remain on their original devices. A missing compatibility boundary must fail visibly rather than falling back to unrestricted state.
