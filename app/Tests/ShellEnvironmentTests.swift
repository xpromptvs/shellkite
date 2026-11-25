import XCTest
@testable import ShellstormCore

final class ShellEnvironmentTests: XCTestCase {
    func testDevelopmentDefaultsToStaging() {
        let e = ShellEnvironment(env: [:])
        XCTAssertEqual(e.signalingBase, "https://staging.xpromptvs.ai")
        XCTAssertEqual(e.e2eOrigin, e.signalingBase)
    }
    func testPublicIsExplicitAndKeepsItsOrigin() {
        XCTAssertEqual(ShellEnvironment(env: [:], channel: "public").signalingBase, "https://app.xpromptvs.ai")
    }
    func testTrailingSlashesAreStrippedAndTheOriginIsItsOwnVariable() {
        let e = ShellEnvironment(env: ["RDEV_SIGNALING": "http://127.0.0.1:8787//", "RDEV_E2E_ORIGIN": "http://localhost:5173/"])
        XCTAssertEqual(e.signalingBase, "http://127.0.0.1:8787")
        XCTAssertEqual(e.e2eOrigin, "http://localhost:5173")
    }
}

extension ShellEnvironmentTests {
    func testBrandedViewerURLDoesNotChangeTheServiceOrPasskeyOrigin() {
        let env=ShellEnvironment(env:[:],channel:"public")
        XCTAssertEqual(env.clientEntryURL,"https://shellkite.xpromptvs.com/app")
        XCTAssertEqual(env.signalingBase,"https://app.xpromptvs.ai")
        XCTAssertEqual(env.e2eOrigin,"https://app.xpromptvs.ai")
    }
}
