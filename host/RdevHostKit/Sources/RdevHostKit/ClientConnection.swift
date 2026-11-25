import Foundation
import RdevCore

/// **A CLIENT'S CONNECTION TO THE HOST**: the protocol's three logical channels — `control`, `input`,
/// `terminal` (`PionChannel`) — over whatever carries them: a WebRTC peer's data channels, or one
/// message socket (`SocketConnection`). `ChannelHub` holds these, never a transport
/// (docs/sources-and-focus.md, "Window-less clients").
///
/// CLASS-BOUND ON PURPOSE: the hub compares connections by IDENTITY — `peers[id] === peer` is how it
/// tells a client's current connection from one a rebuild retired — and holds some weakly (`TermWire`).
public protocol ClientConnection: AnyObject {
    var clientId: String { get }
    var presentation: ClientPresentation { get }
    var accessScope: ConnectionScope { get }
    /// One message on one logical channel. Thread-safe; a no-op on a channel that is not open.
    func send(_ ch: PionChannel, _ data: Data)
    /// The WebRTC peer carrying this client's MEDIA — tracks, delivery, recovery, playout — or nil for a
    /// WINDOW-LESS client, which never gets a track or a capture. Typed as `PionPeer` because WebRTC is
    /// the only transport that carries media; a protocol for it would have exactly one conformer.
    var mediaPeer: PionPeer? { get }
    var mediaReady: Bool { get }
    /// The bytes `ch` holds unsent, for a sender of something LARGE to pace on (an image, `FileFetcher`), so what
    /// is queued behind it waits for little; nil when the channel is not open (the sender stops). A transport that
    /// holds nothing back says 0 — the default.
    func bufferedAmount(_ ch: PionChannel) -> Int?
}

extension ClientConnection {
    public var accessScope: ConnectionScope { .full }
    public var mediaReady: Bool { true }
    public var presentation: ClientPresentation { mediaPeer == nil ? .terminalOnly : .streamedSources }
    public func bufferedAmount(_ ch: PionChannel) -> Int? { 0 }
}

extension PionPeer: ClientConnection {
    public var mediaPeer: PionPeer? { self }
}

/// Last outbound boundary shared by real transports, including direct sends outside ChannelHub.
func scopedWireData(_ channel:PionChannel,_ data:Data,scope:ConnectionScope)->Data? {
    guard scope == .desktopOnly else{return data}
    guard channel != .terminal else{return nil}
    let unwrapped=unwrapMessage(data)
    guard let projected=DesktopStateProjection.project(unwrapped ?? data) else{return nil}
    return unwrapped == nil ? projected:wrapMessage(projected)
}
