import XCTest
import SpriteKit
import SnowballCore
@testable import App

@MainActor
final class GameActorsTests: XCTestCase {
    private func tick(_ boss: GameBoss, _ now: Double, player: CGPoint = CGPoint(x: 4000, y: 128),
                      hurt: (CGFloat) -> Void = { _ in }, shoot: (GameHazard) -> Void = { _ in }) {
        boss.update(now: now, delta: 1.0 / 60, player: player, fruit: .lightning,
                    hurt: hurt, shoot: shoot, summon: { _ in })
    }

    func testEveryBossHasProtectedIntroThreePhasesAndOneDefeatCallback() {
        for stage in StageDefinition.all {
            let boss = GameBoss(stage: stage)
            var phases = 0, defeats = 0
            boss.onPhase = { phases += 1 }
            boss.onDefeated = { defeats += 1 }
            boss.start(now: 0)
            XCTAssertFalse(boss.hit(10_000, sourceX: 4000, now: 1, piercing: true), stage.id.rawValue)
            tick(boss, 1.8)
            XCTAssertEqual(boss.state, .warning)
            XCTAssertTrue(boss.hit(boss.maxHealth * 0.38, sourceX: 4000, now: 1.9, piercing: true))
            XCTAssertEqual(boss.phase, 2, stage.id.rawValue)
            XCTAssertTrue(boss.hit(boss.maxHealth * 0.34, sourceX: 4000, now: 2, piercing: true))
            XCTAssertEqual(boss.phase, 3, stage.id.rawValue)
            XCTAssertEqual(boss.state, .exposed)
            XCTAssertEqual(phases, 2)
            XCTAssertTrue(boss.hit(10_000, sourceX: 4000, now: 2.1, piercing: true))
            XCTAssertTrue(boss.defeated)
            XCTAssertFalse(boss.hit(10_000, sourceX: 4000, now: 2.2, piercing: true))
            XCTAssertEqual(defeats, 1, stage.id.rawValue)
            boss.reset()
            XCTAssertEqual(boss.state, .dormant)
            XCTAssertEqual(boss.health, boss.maxHealth)
            XCTAssertEqual(boss.phase, 1)
            XCTAssertTrue(boss.markers.children.isEmpty)
        }
    }

    func testAllBossesWarnBeforeAttacking() {
        for stage in StageDefinition.all {
            let boss = GameBoss(stage: stage)
            var danger = 0
            boss.start(now: 0)
            tick(boss, 1.8)
            XCTAssertFalse(boss.warningText.isEmpty)
            tick(boss, 3.04, hurt: { _ in danger += 1 }, shoot: { _ in danger += 1 })
            XCTAssertEqual(boss.state, .warning)
            XCTAssertEqual(danger, 0, stage.id.rawValue)
            tick(boss, 3.06)
            XCTAssertEqual(boss.state, .attack)
        }
    }

    func testSevenBossesEmitTheirDistinctPlayableAttackPatterns() {
        var attacks: [StageID: [GameHazard]] = [:]
        for stage in StageDefinition.all {
            let boss = GameBoss(stage: stage)
            boss.start(now: 0)
            for frame in 0..<1_400 {
                let now = Double(frame) / 60
                tick(boss, now, player: CGPoint(x: 4500, y: 128), shoot: { attacks[stage.id, default: []].append($0) })
            }
            XCTAssertFalse(attacks[stage.id, default: []].isEmpty, stage.id.rawValue)
        }
        XCTAssertTrue(attacks[.home, default: []].contains { $0.size.width == 205 }, "Wrench has suction zones")
        XCTAssertTrue(attacks[.rooftop, default: []].contains { $0.velocity.dy != 0 }, "Galeplume has spreading feathers")
        XCTAssertTrue(attacks[.basement, default: []].contains { $0.size.width == 310 }, "Bobo has a horizontal water jet")
        XCTAssertTrue(attacks[.parking, default: []].contains { $0.size.height == 235 }, "Volt has vertical lightning")
        XCTAssertTrue(attacks[.foundations, default: []].contains { $0.velocity.dx == -225 }, "Tato sends left ground waves")
        XCTAssertTrue(attacks[.foundations, default: []].contains { $0.velocity.dx == 225 }, "Tato sends right ground waves")
        XCTAssertTrue(attacks[.floor13, default: []].contains { $0.size.width == 310 }, "Bubble Mother has a tail sweep")
        XCTAssertTrue(attacks[.floor13, default: []].contains { $0.size.height == 34 }, "Bubble Mother also emits bubbles")
        XCTAssertTrue(attacks[.nightark, default: []].contains { $0.size.height == 235 }, "Nightink copies equipped lightning")
        XCTAssertTrue(attacks[.nightark, default: []].contains { $0.size.width == 205 }, "Nightink also creates gravity zones")
    }

    func testSynchronousRetryDuringBossContactDoesNotRestoreOldAttackState() {
        let boss = GameBoss(stage: .find(.home))
        let point = CGPoint(x: 4260, y: 128)
        boss.start(now: 0)
        tick(boss, 1.8, player: point)
        tick(boss, 3.06, player: point)
        tick(boss, 3.1, player: point, hurt: { _ in boss.reset() })
        XCTAssertEqual(boss.state, .dormant)
        XCTAssertEqual(boss.health, boss.maxHealth)
        XCTAssertEqual(boss.sprite.position, point)
    }

    func testEightEnemyTypesWarnAttackAndStopAfterDefeat() {
        for kind in ["vacuum", "mouse", "pigeon", "slime", "beetle", "mole", "dragon", "shadow"] {
            let enemy = GameEnemy(kind: kind, x: 1000)
            var danger = 0
            func update(_ now: Double) {
                enemy.update(now: now, delta: 1.0 / 60, player: CGPoint(x: 1000, y: 128), fruit: .fire,
                             hurt: { _ in danger += 1 }, shoot: { _ in danger += 1 })
            }
            update(0)
            XCTAssertEqual(enemy.state, .warning, kind)
            update(0.79)
            XCTAssertEqual(enemy.state, .warning)
            XCTAssertEqual(danger, 0)
            update(1.1)
            XCTAssertEqual(enemy.state, .attack)
            XCTAssertTrue(enemy.hit(enemy.maxHealth, direction: 1, now: 1.2))
            let before = danger
            update(3)
            XCTAssertTrue(enemy.defeated)
            XCTAssertEqual(danger, before)
            XCTAssertFalse(enemy.hit(1, direction: 1, now: 3))
        }
    }

    func testHazardsRespectWarningExpirationAndSingleConsumption() {
        let hazard = GameHazard(position: CGPoint(x: 100, y: 150), velocity: CGVector(dx: 120, dy: 0),
                                size: CGSize(width: 30, height: 30), color: .red, now: 0, warning: 1, duration: 1)
        XCTAssertFalse(hazard.hits(CGPoint(x: 100, y: 128), now: 0.99))
        hazard.update(now: 0.5, delta: 0.5)
        XCTAssertEqual(hazard.node.position.x, 100)
        XCTAssertTrue(hazard.hits(CGPoint(x: 100, y: 128), now: 1))
        hazard.update(now: 1.5, delta: 0.5)
        XCTAssertEqual(hazard.node.position.x, 160)
        XCTAssertFalse(hazard.hits(CGPoint(x: 160, y: 128), now: 2))
        hazard.spent = true
        XCTAssertFalse(hazard.hits(CGPoint(x: 160, y: 128), now: 1.5))
    }
}
