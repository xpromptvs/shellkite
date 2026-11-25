import XCTest
@testable import ShellstormCore
final class AppDistributionTests: XCTestCase {
    func testOfficialPublicStorageAndIdentityBelongToShellkite() throws {
        guard AppDistribution.official else { throw XCTSkip("Official distribution only") }
        let support = URL(fileURLWithPath: "/support")
        let p = AppProfile.resolve(env: [:], appSupport: support)!
        XCTAssertEqual(p.directory.path, "/support/ai.xpromptvs.shellkite")
        XCTAssertEqual(p.identityStoreName,"ai.xpromptvs.shellkite/HostIdentity")
        XCTAssertEqual(p.name, "default")
        let staging = AppProfile.resolve(env: [:], appSupport: support, channel: "staging")!
        XCTAssertEqual(staging.directory.path, "/support/ai.xpromptvs.shellkite/channels/staging")
        XCTAssertEqual(staging.identityStoreName, "ai.xpromptvs.shellkite/channels/staging/HostIdentity")
        let named = AppProfile.resolve(env: ["RDEV_APP_PROFILE":"work"], appSupport: support)!
        XCTAssertEqual(named.directory.path, "/support/ai.xpromptvs.shellkite/profiles/work")
        XCTAssertEqual(named.identityStoreName,"ai.xpromptvs.shellkite/profiles/work/HostIdentity")
        XCTAssertNotEqual(p.dataStoreID, staging.dataStoreID)
        XCTAssertNotEqual(p.dataStoreID, named.dataStoreID)
    }
    func testTheSelectedDistributionKeepsTheMatchingIdentity() {
        XCTAssertEqual(AppProfile.folder, AppDistribution.official ? "ai.xpromptvs.shellkite" : "com.xpromptvs.shellkite.development")
        let p = AppProfile.resolve(env: [:], appSupport: URL(fileURLWithPath: "/support"))!
        XCTAssertEqual(p.identityStoreName, "\(AppProfile.folder)/HostIdentity")
    }
}
