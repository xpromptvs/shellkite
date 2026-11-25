import XCTest
@testable import RdevCore
final class DesktopStateProjectionTests:XCTestCase {
 private func project(_ o:[String:Any]) throws->[String:Any]? {
  let data=try JSONSerialization.data(withJSONObject:o)
  return try DesktopStateProjection.project(data).map {try XCTUnwrap(JSONSerialization.jsonObject(with:$0) as? [String:Any])}
 }
 func testWholeSnapshotRemovesEveryExcludedStatePath() throws {
  let full:[String:Any] = ["t":"view-set","subs":[["source":"win:1"],["source":"dsp:1","audioOwner":"win:1"]],"windows":[["source":"win:1","name":"secret"],["source":"dsp:1","minimized":false]],"agents":[["id":"a","cwd":"/secret"]],"selectedAgent":"a","tabOrder":["pty:1","win:1","agent:a","dsp:1"],"focused":"win:1","view":["surface":"agents","fullscreen":"win:1"],"version":42,"futureTerminalState":"secret"]
  let p=try XCTUnwrap(try project(full)), encoded=String(data:try JSONSerialization.data(withJSONObject:p),encoding:.utf8)!
  for excluded in ["win:1","pty:1","agent:a","/secret","futureTerminalState","secret"] {XCTAssertFalse(encoded.contains(excluded),encoded)}
  XCTAssertEqual(p["tabOrder"] as? [String],["dsp:1"])
  XCTAssertEqual((p["view"] as? [String:Any])?["surface"] as? String,"windows")
  XCTAssertEqual(p["version"] as? Int,42)
  XCTAssertEqual((full["tabOrder"] as? [String])?.count,4,"projection must not mutate host state")
 }
 func testExcludedMessagesAndUnknownFutureMessagesFailClosed() throws {
  for tag in ["term-list","term-screen","term-clipboard","term-bell","agent-event","tmux-list","file-begin","future-terminal-message","apps-state"] {XCTAssertNil(try project(["t":tag,"secret":"data"]))}
 }
 func testListsStatusesAndThumbnailsContainDisplaysOnly() throws {
  for (tag,key) in [("source-list","sources"),("source-status","statuses")] {
   let p=try XCTUnwrap(try project(["t":tag,key:[["id":"win:1","name":"secret"],["id":"dsp:1","kind":"display","name":"Monitor"]]]))
   XCTAssertEqual((p[key] as? [[String:Any]])?.count,1)
  }
  XCTAssertNil(try project(["t":"source-thumb","id":"win:1","data":"secret"]))
  XCTAssertNotNil(try project(["t":"source-thumb","id":"dsp:1","data":"display-image"]))
 }
 func testDesktopDriverFocusPreservesExcludedTabsAndUsesOnlyAnOpenDisplay() {
  var state=SessionState()
  _=state.open("dsp:1");_=state.open("win:1")
  let order=state.tabOrder
  state.selectDesktopForDriver()
  XCTAssertEqual(state.focused,"dsp:1")
  XCTAssertEqual(state.view.surface,.windows)
  XCTAssertEqual(state.tabOrder,order)
  _=state.minimize("dsp:1")
  _=state.focus("win:1")
  state.selectDesktopForDriver()
  XCTAssertNil(state.focused,"no eligible display means no input focus")
  XCTAssertEqual(state.tabOrder,order,"hidden membership and order survive")
  XCTAssertTrue(state.windows.first(where: {$0.source == "dsp:1"})!.minimized,"never restore a parked display")
 }
 func testControlStateAdvertisesTheDesktopBoundWithoutTerminalState() throws {
  let p=try XCTUnwrap(try project(["t":"control-state","active":true,"clients":2]))
  XCTAssertEqual(p["sourceKinds"] as? [String],["display"])
  XCTAssertEqual(p["accessScope"] as? String,"desktopOnly")
 }
}
