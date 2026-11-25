import XCTest
@testable import RdevCore
final class ConnectionScopeTests:XCTestCase {
 func testStrictModesAndUnchangedClassicPrologue() throws {
  for mode in E2EWire.Mode.allCases {
   XCTAssertEqual(ConnectionScope.full.handshakeMode(mode),mode.rawValue)
   let parsed=try XCTUnwrap(ConnectionScope.parseHandshakeMode("desktop-"+mode.rawValue))
   XCTAssertEqual(parsed.mode,mode);XCTAssertEqual(parsed.scope,.desktopOnly)
   XCTAssertEqual(ConnectionScope.full.prologue(mode:mode,roomCode:"room"),E2EWire.prologue(mode:mode,roomCode:"room"))
   XCTAssertNotEqual(ConnectionScope.desktopOnly.prologue(mode:mode,roomCode:"room"),E2EWire.prologue(mode:mode,roomCode:"room"))
  }
  for bad in ["desktop","desktop-auth-extra","desktop-desktop-auth","AUTH","desktop-unknown"] {XCTAssertNil(ConnectionScope.parseHandshakeMode(bad))}
 }
 func testIndependentVectors() throws {
  struct Row:Decodable{let mode:String;let scope:String;let room:String;let prologue:String;let tag:String}
  let root=URL(fileURLWithPath:#filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
  let rows=try JSONDecoder().decode([Row].self,from:Data(contentsOf:root.appendingPathComponent("protocol/fixtures/connection-scope.json")))
  XCTAssertEqual(rows.count,16)
  for r in rows {
   let mode=try XCTUnwrap(E2EWire.Mode(rawValue:r.mode)),scope=try XCTUnwrap(ConnectionScope(rawValue:r.scope))
   XCTAssertEqual(scope.handshakeMode(mode),r.tag)
   let bytes=try XCTUnwrap(scope.prologue(mode:mode,roomCode:r.room))
   XCTAssertEqual(bytes.map{String(format:"%02x",$0)}.joined(),r.prologue)
  }
 }
 func testOversizedRoomsAreRefused() {XCTAssertNil(ConnectionScope.desktopOnly.prologue(mode:.auth,roomCode:String(repeating:"x",count:65536)))}
 func testDesktopEnvelopePreservesItsScope() throws {
  let bytes=e2eJSON("YQ",peer:"p",mode:.auth,scope:.desktopOnly)
  guard case .desktopE2E(let ct,let peer,let mode)?=SignalingRouter.route(bytes) else{return XCTFail("lost desktop scope")}
  XCTAssertEqual(ct,"YQ");XCTAssertEqual(peer,"p");XCTAssertEqual(mode,.auth)
 }
}
