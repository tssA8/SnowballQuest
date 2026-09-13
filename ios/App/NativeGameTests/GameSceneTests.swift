import XCTest
import SpriteKit
import SnowballCore
@testable import App

@MainActor
final class GameSceneTests: XCTestCase {
    private func withGame(_ stage: StageID = .home,
                          configure: (NativeSaveStore) -> Void = { _ in },
                          body: (GameScene, NativeSaveStore, UserDefaults) -> Void) {
        let suite = "snowball-hosted-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = NativeSaveStore(defaults: defaults)
        let definition = StageDefinition.find(stage)
        for previous in StageDefinition.all where previous.index < definition.index { store.complete(previous.id) }
        XCTAssertTrue(store.startStage(stage))
        store.updateSettings(NativeSettings(music: false, sound: false, haptics: false, reducedMotion: true))
        configure(store)
        let scene = GameScene(stage: definition, store: store)
        scene.resumeGame()
        body(scene, store, defaults)
        scene.pauseGame()
    }

    private func advance(_ scene: GameScene, frames: Int) {
        for _ in 0..<frames { scene.advance(delta: 1.0 / 60) }
    }

    func testNativePhysicsJumpsAndLandsOnTheBundledCollisionFloor() {
        withGame { scene, _, _ in
            advance(scene, frames: 2)
            XCTAssertEqual(scene.player.position.y, 128, accuracy: 1)
            let startX = scene.player.position.x
            scene.setMovement(1)
            advance(scene, frames: 15)
            scene.setMovement(0)
            XCTAssertGreaterThan(scene.player.position.x, startX + 30)
            scene.setJump(true)
            advance(scene, frames: 15)
            XCTAssertGreaterThan(scene.player.position.y, 190)
            scene.setJump(false)
            advance(scene, frames: 120)
            XCTAssertEqual(scene.player.position.y, 128, accuracy: 1)
        }
    }

    func testNativeChargeReleaseCostsEnergyButCancellationDoesNot() {
        withGame { scene, _, _ in
            scene.setCharge(true)
            advance(scene, frames: 75)
            scene.cancelCharge()
            scene.setCharge(false)
            XCTAssertEqual(scene.energy, 100, accuracy: 0.001)
            scene.setCharge(true)
            advance(scene, frames: 75)
            scene.setCharge(false)
            XCTAssertEqual(scene.energy, 70, accuracy: 0.001)
        }
    }

    func testPauseFreezesGameTimeAndCancelsUnreleasedCharge() {
        withGame { scene, _, _ in
            scene.setMovement(1)
            scene.setCharge(true)
            advance(scene, frames: 45)
            scene.pauseGame()
            let clock = scene.clock
            let position = scene.player.position
            advance(scene, frames: 120)
            scene.setCharge(false)
            XCTAssertEqual(scene.clock, clock)
            XCTAssertEqual(scene.player.position, position)
            XCTAssertEqual(scene.energy, 100)
            scene.resumeGame()
            advance(scene, frames: 1)
            XCTAssertEqual(scene.energy, 100)
        }
    }

    func testDamageInvulnerabilityAndSavedHeartsSurviveReopeningStore() {
        withGame { scene, store, defaults in
            scene.receiveDamage(from: scene.player.position.x + 100)
            XCTAssertEqual(scene.hearts, 4)
            scene.receiveDamage(from: scene.player.position.x + 100)
            XCTAssertEqual(scene.hearts, 4, "A continuous overlap must not remove every heart")
            advance(scene, frames: 102)
            scene.receiveDamage(from: scene.player.position.x + 100)
            XCTAssertEqual(scene.hearts, 3)
            scene.persist()
            XCTAssertEqual(store.state.run.hearts, 3)
            XCTAssertEqual(NativeSaveStore(defaults: defaults).state.run.hearts, 3)
        }
    }

    func testDashProtectsThePlayerOnlyDuringItsDodgeWindow() {
        withGame { scene, _, _ in
            advance(scene, frames: 2)
            scene.dash()
            scene.receiveDamage(from: scene.player.position.x + 100)
            XCTAssertEqual(scene.hearts, 5)
            advance(scene, frames: 25)
            scene.receiveDamage(from: scene.player.position.x + 100)
            XCTAssertEqual(scene.hearts, 4)
        }
    }

    func testHealingCanRestoresTwoHeartsAndStaysCollectedAfterReopening() {
        withGame(configure: { store in
            var run = store.state.run
            run.hearts = 3
            store.updateRun(run)
        }) { scene, store, _ in
            scene.player.position = CGPoint(x: 1800, y: 128)
            advance(scene, frames: 1)
            XCTAssertEqual(scene.hearts, 5)
            XCTAssertTrue(store.state.run.collected.contains("healing-0"))
            var run = store.state.run
            run.hearts = 3
            store.updateRun(run)
            let resumed = GameScene(stage: .find(.home), store: store)
            resumed.resumeGame()
            resumed.player.position = CGPoint(x: 1800, y: 128)
            advance(resumed, frames: 1)
            XCTAssertEqual(resumed.hearts, 3, "A consumed route can must remain consumed after loading the save")
            resumed.pauseGame()
        }
    }

    func testArenaCanReappearsDuringTheSameFight() {
        withGame { scene, _, _ in
            scene.startBoss()
            // Keep the real boss in its protected intro to isolate timed supply respawning.
            scene.boss.reset()
            scene.boss.start(now: 100)
            scene.player.position = CGPoint(x: 3800, y: 128)
            advance(scene, frames: 122)
            scene.receiveDamage(from: 3900)
            XCTAssertEqual(scene.hearts, 4)
            advance(scene, frames: 1)
            XCTAssertEqual(scene.hearts, 5)
            scene.player.position = CGPoint(x: 3980, y: 128)
            advance(scene, frames: 730)
            scene.receiveDamage(from: 4100)
            XCTAssertEqual(scene.hearts, 4)
            scene.player.position = CGPoint(x: 3800, y: 128)
            advance(scene, frames: 1)
            XCTAssertEqual(scene.hearts, 5, "The arena can must respawn after twelve active seconds")
        }
    }

    func testDefeatWaitsBrieflyThenRestartsWithFullHealthAndNoHeldCharge() {
        withGame(configure: { store in
            var run = store.state.run
            run.hearts = 1
            store.updateRun(run)
        }) { scene, store, _ in
            scene.setCharge(true)
            scene.receiveDamage(from: 260)
            XCTAssertEqual(scene.mode, .defeated)
            XCTAssertFalse(scene.charging)
            advance(scene, frames: 45)
            XCTAssertEqual(scene.mode, .defeated)
            advance(scene, frames: 10)
            XCTAssertEqual(scene.mode, .playing)
            XCTAssertEqual(scene.hearts, store.state.maxHearts)
            XCTAssertEqual(scene.player.position.y, 128, accuracy: 1)
        }
    }

    func testWindDoubleJumpAndWaterShieldAffectTheNativeSimulation() {
        func trial(_ fruit: Fruit) -> (NativeSaveStore) -> Void {
            { store in
                var run = store.state.run
                run.trial = fruit
                store.updateRun(run)
            }
        }
        withGame(.rooftop, configure: trial(.wind)) { scene, _, _ in
            advance(scene, frames: 2)
            scene.setJump(true)
            advance(scene, frames: 30)
            scene.setJump(false)
            let before = scene.player.position.y
            scene.setJump(true)
            advance(scene, frames: 15)
            XCTAssertGreaterThan(scene.player.position.y, before + 60)
        }
        withGame(.basement, configure: trial(.water)) { scene, store, _ in
            scene.setCharge(true)
            advance(scene, frames: 1)
            scene.setCharge(false)
            scene.receiveDamage(from: 260)
            XCTAssertEqual(scene.hearts, store.state.maxHearts, "Water casting grants a shield")
            advance(scene, frames: 100)
            scene.receiveDamage(from: 260)
            XCTAssertEqual(scene.hearts, store.state.maxHearts - 1, "The shield is consumed and cannot grant permanent immunity")
        }
    }

    func testArenaRetryRestoresBossPlayerAndCheckpointWithoutReplayingTheLevel() {
        withGame { scene, store, defaults in
            scene.startBoss()
            advance(scene, frames: 120)
            XCTAssertTrue(scene.boss.active)
            XCTAssertTrue(scene.boss.hit(200, sourceX: 4000, now: scene.clock, piercing: true))
            scene.receiveDamage(from: scene.player.position.x + 100)
            scene.setCharge(true)
            advance(scene, frames: 20)
            scene.retryCheckpoint()
            XCTAssertEqual(scene.player.position.x, 3590, accuracy: 1)
            XCTAssertEqual(scene.hearts, store.state.maxHearts)
            XCTAssertEqual(scene.energy, store.state.maxEnergy)
            XCTAssertEqual(scene.boss.health, scene.boss.maxHealth)
            XCTAssertEqual(scene.boss.phase, 1)
            scene.setCharge(false)
            XCTAssertEqual(scene.energy, store.state.maxEnergy, "Retry must cancel any held charge")
            scene.persist()
            let reopened = NativeSaveStore(defaults: defaults)
            XCTAssertEqual(reopened.state.run.checkpointX, 3590)
            XCTAssertEqual(reopened.state.run.checkpointY, 640)
        }
    }

    func testRealProjectileHitsAnArmoredBossAfterFullCharge() {
        withGame { scene, _, _ in
            scene.startBoss()
            advance(scene, frames: 120)
            scene.player.position = CGPoint(x: 4050, y: 128)
            scene.setMovement(1)
            advance(scene, frames: 1)
            scene.setMovement(0)
            scene.setCharge(true)
            advance(scene, frames: 75)
            scene.setCharge(false)
            advance(scene, frames: 35)
            XCTAssertLessThan(scene.boss.health, scene.boss.maxHealth - 75, "The charged native projectile must reach and pierce boss armor")
        }
    }

    func testEveryBossCompletionSavesItsCompanionAndUnlocksTheNextStage() {
        for stage in StageDefinition.all {
            withGame(stage.id) { scene, store, defaults in
                scene.startBoss()
                advance(scene, frames: 120)
                XCTAssertTrue(scene.boss.hit(10_000, sourceX: 4000, now: scene.clock, piercing: true), stage.id.rawValue)
                XCTAssertTrue(scene.boss.defeated)
                XCTAssertEqual(scene.mode, .complete)
                XCTAssertTrue(store.state.cleared.contains(stage.id), stage.id.rawValue)
                if let next = stage.next { XCTAssertTrue(store.state.unlockedStages.contains(next)) }
                scene.persist()
                let reopened = NativeSaveStore(defaults: defaults)
                XCTAssertTrue(reopened.state.cleared.contains(stage.id))
                XCTAssertTrue(reopened.state.run.bossDefeated)
            }
        }
    }
}
