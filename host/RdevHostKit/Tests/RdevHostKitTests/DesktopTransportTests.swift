import Foundation
import XCTest
import RdevCore
@testable import RdevHostKit

final class DesktopTransportTests: XCTestCase {
    func testEveryOutboundChannelRejectsExcludedStateAndTerminalBytes() throws {
        let secret = Data(#"{"t":"term-list","tabs":[{"id":"pty:1","title":"private"}]}"#.utf8)
        for channel in [PionChannel.control, .input, .bulk, .terminal] {
            XCTAssertNil(scopedWireData(channel, secret, scope: .desktopOnly))
            XCTAssertNil(scopedWireData(channel, wrapMessage(secret), scope: .desktopOnly))
            XCTAssertEqual(scopedWireData(channel, secret, scope: .full), secret)
        }
        XCTAssertNil(scopedWireData(.terminal, Data([0, 1, 2]), scope: .desktopOnly))
        let display = Data(#"{"t":"source-thumb","id":"dsp:1","data":"pixels"}"#.utf8)
        for channel in [PionChannel.control, .bulk] {
            let plain = try XCTUnwrap(scopedWireData(channel, display, scope: .desktopOnly))
            let framed = try XCTUnwrap(scopedWireData(channel, wrapMessage(display), scope: .desktopOnly))
            XCTAssertEqual(unwrapMessage(framed), plain)
        }
    }

    func testDesktopFastCarrierCannotQueueOrReplayTerminalOutput() {
        let connection = FastClientConnection(clientId: "desktop", generation: Data(repeating: 3, count: 16), accessScope: .desktopOnly,
                                              onOpen: { _ in }, onMessage: { _, _ in }, onFailure: { XCTFail($0) })
        defer { connection.close() }
        connection.markReady()
        connection.send(.terminal, Data(repeating: 4, count: 4096))
        connection.send(.control, Data(#"{"t":"agent-event","text":"private"}"#.utf8))
        XCTAssertEqual(connection.bufferedAmount(.terminal), 0)
        XCTAssertEqual(connection.bufferedAmount(.control), 0)
        connection.resume(offsets: [0, 0, 0])
        XCTAssertEqual(connection.bufferedAmount(.terminal), 0)
    }
}
