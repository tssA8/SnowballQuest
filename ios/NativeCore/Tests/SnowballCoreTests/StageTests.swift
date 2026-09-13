import XCTest
@testable import SnowballCore

final class StageTests: XCTestCase {
    func testCampaignHasSevenDistinctBossesAndFiveElementTrials() {
        XCTAssertEqual(StageDefinition.all.map(\.id), StageID.allCases)
        XCTAssertEqual(StageDefinition.all.map(\.index), Array(1...7))
        XCTAssertEqual(Set(StageDefinition.all.map(\.bossKey)).count, 7)
        XCTAssertEqual(StageDefinition.all.compactMap(\.fruit), Fruit.allCases)
        XCTAssertEqual(Set(StageDefinition.all.flatMap(\.enemyKinds)).count, 8)
        for stage in StageDefinition.all {
            XCTAssertEqual(StageDefinition.find(stage.id), stage)
            XCTAssertFalse(stage.title.isEmpty)
            XCTAssertEqual(stage.intro.count, 2)
            XCTAssertEqual(stage.reconcile.count, 2)
            XCTAssertGreaterThanOrEqual(stage.bossHealth, 660)
            XCTAssertLessThanOrEqual(stage.bossHealth, 810)
        }
        XCTAssertNil(StageDefinition.find(.nightark).next)
        XCTAssertEqual(StageDefinition.find(.home).next, .rooftop)
    }
}
