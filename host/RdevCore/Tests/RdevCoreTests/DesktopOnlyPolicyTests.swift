import XCTest
@testable import RdevCore
final class DesktopOnlyPolicyTests:XCTestCase {
 func testOnlyDisplaySourceIntentsAreAllowed() throws {
  for source in ["dsp:1","win:1","sim:A","apps:A","dsp:-1","dsp:4294967296","dsp:01"] {
   let allowed=source=="dsp:1"
   for message in [InboundMessage.subscribe(source:source,delivery:.rtp),.unsubscribe(source:source),.focusSource(source:source),.requestKeyframe(source:source),.setSourcePrefs(source:source,scale:nil,crop:nil),.renameTab(tab:source,name:"Monitor")] {
    XCTAssertEqual(DesktopOnlyPolicy.permits(message,focusedSource:"dsp:1"),allowed,source)
   }
  }
 }
 func testExcludedFunctionalityIsRefusedBeforeDispatch() throws {
  let agent=try XCTUnwrap(AgentCommand.parse(["v":1,"id":"r","op":"list"]))
  let messages:[InboundMessage]=[.openTerminal,.reopenTerminal,.listTerminals,.listTmux,.newTmux,.appsList,.appsRestoreAll,.simText("secret"),.agent(agent),.resize(cols:80,rows:24),.termWire,.terminalPause,.terminalResume,.key("secret",term:.pty(1)),.setView(surface:.terminal,fullscreen:nil),.sourceInput(.focus(source:"win:1",request:"r")),.sourceInput(.input(source:"dsp:1",lease:"l",event:.simText("x")))]
  for m in messages {XCTAssertFalse(DesktopOnlyPolicy.permits(m,focusedSource:"dsp:1"),String(describing:m))}
 }
 func testUnaddressedInputCannotFallThroughToAWindow() {
  let key=InboundMessage.winKey(down:true,code:"KeyA",key:"a",repeat:false,mods:.none)
  XCTAssertTrue(DesktopOnlyPolicy.permits(key,focusedSource:"dsp:1"))
  XCTAssertFalse(DesktopOnlyPolicy.permits(key,focusedSource:"win:1"))
  XCTAssertFalse(DesktopOnlyPolicy.permits(key,focusedSource:nil))
  XCTAssertTrue(DesktopOnlyPolicy.permits(.winKeysRelease,focusedSource:nil))
 }
 func testRestrictedViewAndTabOrderCannotNameOtherSources() {
  XCTAssertFalse(DesktopOnlyPolicy.permits(.setView(surface:.windows,fullscreen:.some("win:1")),focusedSource:nil))
  XCTAssertTrue(DesktopOnlyPolicy.permits(.setView(surface:.windows,fullscreen:.some("dsp:1")),focusedSource:nil))
  XCTAssertFalse(DesktopOnlyPolicy.permits(.moveTab(tab:"dsp:1",before:"pty:1"),focusedSource:nil))
  XCTAssertTrue(DesktopOnlyPolicy.permits(.moveTab(tab:"dsp:1",before:nil),focusedSource:nil))
 }
 func testAuthenticatedContextCannotBeWidenedByApplicationHello() {
  XCTAssertFalse(ConnectionScope.desktopOnly.acceptsApplicationHello(Array("{\"scope\":\"full\"}".utf8)))
  XCTAssertTrue(ConnectionScope.desktopOnly.acceptsApplicationHello([]))
  XCTAssertFalse(ConnectionScope.desktopOnly.acceptsApplicationHello(Array("{\"scope\":true}".utf8)))
 }
 func testRestrictedSettlementHasNoHiddenFocusWhenTheLastDisplayDisappears() {
  var state=SessionState();_ = state.open("dsp:1");_ = state.open("win:1")
  state.selectDesktopForDriver();XCTAssertEqual(state.focused,"dsp:1")
  _ = state.retain(onlyIn:["win:1"]);state.selectDesktopForDriver()
  XCTAssertNil(state.focused);XCTAssertEqual(state.windows.map(\.source),["win:1"])
  XCTAssertEqual(state.view.surface,.windows)
 }
}
