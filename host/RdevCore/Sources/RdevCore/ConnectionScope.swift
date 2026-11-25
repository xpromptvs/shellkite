import Foundation
/// Application access is independent of transport and driving ownership.
public enum ConnectionScope:String,Sendable,Codable {
 case full,desktopOnly
 public func handshakeMode(_ mode:E2EWire.Mode)->String {self == .desktopOnly ? "desktop-"+mode.rawValue:mode.rawValue}
 public static func parseHandshakeMode(_ raw:String)->(mode:E2EWire.Mode,scope:ConnectionScope)? {
  let desktop=raw.hasPrefix("desktop-")
  guard let mode=E2EWire.Mode(rawValue:desktop ? String(raw.dropFirst(8)):raw) else{return nil}
  return(mode,desktop ? .desktopOnly:.full)
 }
 public func prologue(mode:E2EWire.Mode,roomCode:String)->[UInt8]? {
  if self == .full{return E2EWire.prologue(mode:mode,roomCode:roomCode)}
  guard let room=E2EWire.lengthPrefixed(Array(roomCode.utf8)) else{return nil}
  return E2EWire.lengthPrefixed(Array("rdev-e2e/desktop/v1".utf8))! + E2EWire.lengthPrefixed(Array(mode.rawValue.utf8))! + room
 }
 public func acceptsApplicationHello(_ bytes:[UInt8])->Bool {
  guard let o=(try? JSONSerialization.jsonObject(with:Data(bytes))) as? [String:Any],let declared=o["scope"] else{return true}
  return (declared as? String)==rawValue
 }
 public func limited(by other:ConnectionScope)->ConnectionScope {self == .desktopOnly || other == .desktopOnly ? .desktopOnly:.full}
}
