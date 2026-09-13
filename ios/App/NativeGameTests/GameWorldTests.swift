import XCTest
import SpriteKit
import SnowballCore
@testable import App

@MainActor
final class GameWorldTests: XCTestCase {
    func testSevenBundledWorldsHaveCollisionCheckpointsAndReachableBossFloors() {
        for stage in StageDefinition.all {
            let world = GameWorld(stage: stage)
            XCTAssertEqual(world.width, 4864, stage.id.rawValue)
            XCTAssertEqual(world.spawn, CGPoint(x: 160, y: 128))
            XCTAssertTrue(world.platforms.contains { $0.oneWay }, stage.id.rawValue)
            XCTAssertTrue(world.checkpoints.contains { $0.x >= 3500 }, stage.id.rawValue)
            XCTAssertGreaterThanOrEqual(world.collectibles.filter { $0.kind == "fish" }.count, 24)
            XCTAssertEqual(world.collectibles.filter { $0.kind == "star" }.count, 3)
            for x in stride(from: CGFloat(3600), through: 4800, by: 100) {
                XCTAssertTrue(world.platforms.contains { !$0.oneWay && $0.rect.minX <= x && $0.rect.maxX >= x && $0.rect.maxY == 128 }, stage.id.rawValue)
            }
            XCTAssertNotNil(GameArt.image(key: stage.bossKey, frame: 7), "Defeated pose for \(stage.id)")
            for kind in stage.enemyKinds { XCTAssertNotNil(GameArt.image(key: "enemy-\(kind)", frame: 5)) }
        }
    }

    func testWindLiftAndWaterBuoyancyReactToEquippedFruit() throws {
        let wind = GameWorld(stage: .find(.rooftop))
        let lift = try XCTUnwrap(wind.features.first { $0.kind == "wind-lift" })
        let point = CGPoint(x: lift.position.x, y: 200)
        let normal = wind.update(delta: 0, player: point, fruit: nil, grounded: false)
        let powered = wind.update(delta: 0, player: point, fruit: .wind, grounded: false)
        XCTAssertGreaterThan(normal.lift, 0)
        XCTAssertGreaterThan(powered.lift, normal.lift)
        let water = GameWorld(stage: .find(.basement))
        let pool = try XCTUnwrap(water.features.first { $0.kind == "water-pool" })
        let swimming = CGPoint(x: pool.position.x, y: 150)
        let base = water.update(delta: 0, player: swimming, fruit: nil, grounded: false)
        let equipped = water.update(delta: 0, player: swimming, fruit: .water, grounded: false)
        XCTAssertLessThan(equipped.gravity, base.gravity)
        XCTAssertLessThan(base.gravity, 900)
    }

    func testElectricCablesHaveSafeWindowsAndTwoElementCounters() throws {
        let world = GameWorld(stage: .find(.parking))
        let cable = try XCTUnwrap(world.features.first { $0.kind == "electric-cable" })
        let point = CGPoint(x: cable.position.x + 100, y: 128)
        var foundSafe = false, foundActive = false
        for _ in 0..<420 {
            let result = world.update(delta: 1.0 / 60, player: point, fruit: nil, grounded: true)
            if result.electric {
                foundActive = true
                XCTAssertFalse(world.update(delta: 0, player: point, fruit: .earth, grounded: true).electric)
                XCTAssertFalse(world.update(delta: 0, player: point, fruit: .lightning, grounded: true).electric)
            } else { foundSafe = true }
        }
        XCTAssertTrue(foundSafe)
        XCTAssertTrue(foundActive)
    }

    func testEarthOpensOptionalWallAndBubbleLiftMovesItsCollider() throws {
        let earth = GameWorld(stage: .find(.foundations))
        XCTAssertTrue(earth.platforms.contains { $0.id == "earth-wall" })
        _ = earth.update(delta: 0, player: CGPoint(x: 3016, y: 384), fruit: .fire, grounded: false)
        XCTAssertTrue(earth.platforms.contains { $0.id == "earth-wall" })
        _ = earth.update(delta: 0, player: CGPoint(x: 3016, y: 384), fruit: .earth, grounded: false)
        XCTAssertFalse(earth.platforms.contains { $0.id == "earth-wall" })
        let bubbles = GameWorld(stage: .find(.floor13))
        let platform = try XCTUnwrap(bubbles.platforms.first { $0.id == "bubble-0" })
        let movement = bubbles.update(delta: 1.0 / 60, player: CGPoint(x: platform.rect.midX, y: platform.rect.maxY), fruit: nil, grounded: true)
        let moved = try XCTUnwrap(bubbles.platforms.first { $0.id == "bubble-0" })
        XCTAssertNotEqual(moved.rect.maxY, platform.rect.maxY)
        XCTAssertEqual(movement.ride, moved.rect.maxY - platform.rect.maxY, accuracy: 0.001)
    }
}
