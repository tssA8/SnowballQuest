import XCTest
@testable import SnowballCore

final class CombatRulesTests: XCTestCase {
    func testTapAndFullChargeHaveUsefulDistinctDamage() throws {
        let tap = try XCTUnwrap(ChargeProfile.make(held: 0.1, fire: true, energy: 100))
        XCTAssertEqual(tap.cost, 16)
        XCTAssertEqual(tap.damage, 32)
        XCTAssertFalse(tap.piercing)
        let fire = try XCTUnwrap(ChargeProfile.make(held: 1.2, fire: true, energy: 30))
        XCTAssertEqual(fire.ratio, 1, accuracy: 0.000_001)
        XCTAssertEqual(fire.cost, 30)
        XCTAssertEqual(fire.damage, 140)
        XCTAssertTrue(fire.piercing)
        let neutral = try XCTUnwrap(ChargeProfile.make(held: 4, fire: false, energy: 100))
        XCTAssertEqual(neutral.damage, 110)
        XCTAssertEqual(neutral.cost, 30)
        XCTAssertTrue(neutral.piercing)
    }

    func testUnderfundedFullChargeScalesWithoutSpendingMissingEnergy() throws {
        XCTAssertNil(ChargeProfile.make(held: 1.2, fire: true, energy: 15.99))
        let partial = try XCTUnwrap(ChargeProfile.make(held: 1.2, fire: true, energy: 23.99))
        XCTAssertEqual(partial.ratio, 0.5, accuracy: 0.000_001)
        XCTAssertEqual(partial.damage, 86)
        XCTAssertEqual(partial.cost, 23)
        XCTAssertFalse(partial.piercing)
        for energy in stride(from: 16.0, through: 31.0, by: 0.1) {
            let shot = try XCTUnwrap(ChargeProfile.make(held: 2, fire: false, energy: energy))
            XCTAssertLessThanOrEqual(shot.cost, energy)
        }
    }

    func testInvalidTimesCannotProduceInvalidProjectiles() throws {
        XCTAssertNil(ChargeProfile.make(held: .nan, fire: false, energy: 100))
        XCTAssertNil(ChargeProfile.make(held: 1, fire: false, energy: .infinity))
        let negativeTime = try XCTUnwrap(ChargeProfile.make(held: -1, fire: false, energy: 100))
        XCTAssertEqual(negativeTime.ratio, 0)
        XCTAssertEqual(negativeTime.damage, 24)
    }

    func testComboCooldownSequenceAndWrap() throws {
        var combo = ComboState()
        let first = try XCTUnwrap(combo.hit(now: 0, airborne: false))
        XCTAssertEqual(first.step, 1)
        XCTAssertEqual(first.damage, 10)
        XCTAssertNil(combo.hit(now: 0.259, airborne: false))
        XCTAssertEqual(combo.hit(now: 0.26, airborne: false)?.step, 2)
        XCTAssertNil(combo.hit(now: 0.549, airborne: false))
        XCTAssertEqual(combo.hit(now: 0.551, airborne: false)?.damage, 18)
        XCTAssertNil(combo.hit(now: 1, airborne: false))
        XCTAssertEqual(combo.hit(now: 1.002, airborne: false)?.step, 1)
    }

    func testComboExpiresAndAirAttackDoesNotAdvanceGroundCombo() throws {
        var combo = ComboState()
        _ = combo.hit(now: 0, airborne: false)
        XCTAssertEqual(combo.hit(now: 1, airborne: false)?.step, 1)
        let air = try XCTUnwrap(combo.hit(now: 1.3, airborne: true))
        XCTAssertTrue(air.airborne)
        XCTAssertEqual(air.damage, 14)
        XCTAssertEqual(combo.count, 0)
        XCTAssertNil(combo.hit(now: 1.659, airborne: false))
        XCTAssertEqual(combo.hit(now: 1.661, airborne: false)?.step, 1)
        combo.reset()
        XCTAssertEqual(combo.hit(now: 0, airborne: false)?.step, 1)
        XCTAssertNil(combo.hit(now: .nan, airborne: false))
    }

    func testBossPhaseThresholdsAndArmorPiercing() {
        XCTAssertEqual(BossRules.phase(health: 660, maxHealth: 660), 1)
        XCTAssertEqual(BossRules.phase(health: 440, maxHealth: 660), 2)
        XCTAssertEqual(BossRules.phase(health: 220, maxHealth: 660), 3)
        XCTAssertEqual(BossRules.phase(health: 0, maxHealth: 0), 3)
        XCTAssertEqual(BossRules.armoredDamage(100, armored: true), 55)
        XCTAssertEqual(BossRules.armoredDamage(100, armored: true, piercing: true), 100)
        XCTAssertEqual(BossRules.armoredDamage(100, overheated: true), 135)
        XCTAssertEqual(BossRules.armoredDamage(100, overheated: true, fromBehind: true), 200)
        XCTAssertEqual(BossRules.armoredDamage(.infinity), 0)
        XCTAssertEqual(BossRules.armoredDamage(-1), 0)
    }
}
