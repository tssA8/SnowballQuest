import Foundation
import XCTest
@testable import SnowballCore

final class SaveTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suite: String!

    override func setUp() {
        super.setUp()
        suite = "SnowballCoreTests.\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
        defaults = nil
        suite = nil
        super.tearDown()
    }

    func testSevenStagesUnlockSequentiallyWithoutCollectionRequirements() {
        let store = NativeSaveStore(defaults: defaults)
        XCTAssertEqual(store.state.unlockedStages, [.home])
        XCTAssertFalse(store.startStage(.nightark))
        store.complete(.nightark)
        XCTAssertTrue(store.state.cleared.isEmpty)
        for stage in StageDefinition.all {
            XCTAssertTrue(store.startStage(stage.id))
            XCTAssertTrue(store.state.run.collected.isEmpty)
            store.complete(stage.id)
            XCTAssertTrue(store.state.cleared.contains(stage.id))
            if let next = stage.next { XCTAssertTrue(store.state.unlockedStages.contains(next)) }
        }
        XCTAssertEqual(store.state.unlockedStages, StageID.allCases)
        XCTAssertEqual(store.state.fruits, Fruit.allCases)
        XCTAssertEqual(store.state.maxHearts, 6)
        XCTAssertEqual(store.state.maxEnergy, 120)
        XCTAssertEqual(store.state.attackMultiplier, 1.1)
        store.complete(.home)
        XCTAssertEqual(store.state.attackMultiplier, 1.1)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state, store.state)
    }

    func testReplayResetsRunButKeepsRewardsSettingsAndBestScores() {
        let store = NativeSaveStore(defaults: defaults)
        store.updateSettings(NativeSettings(music: false, haptics: false, reducedMotion: true))
        store.updateRun(NativeRun(checkpointX: 3590, hearts: 2, elapsed: 120,
                                 collected: ["fish-01"], trial: .fire))
        store.complete(.home)
        store.recordResult(.home, fish: 20, stars: 3, time: 120)
        store.recordResult(.home, fish: 22, stars: 1, time: 150)
        XCTAssertTrue(store.startStage(.home))
        XCTAssertEqual(store.state.run, NativeRun())
        XCTAssertEqual(store.state.fruits, [.fire])
        XCTAssertFalse(store.state.settings.music)
        XCTAssertFalse(store.state.settings.haptics)
        XCTAssertTrue(store.state.settings.reducedMotion)
        XCTAssertEqual(store.state.stageRecords["home"]?.fish, 22)
        XCTAssertEqual(store.state.stageRecords["home"]?.stars, 3)
        XCTAssertEqual(store.state.stageRecords["home"]?.bestTime, 120)
    }

    func testCheckpointAndFruitTrialSurviveReload() {
        let store = NativeSaveStore(defaults: defaults)
        let run = NativeRun(checkpointX: 3590, checkpointY: 640, hearts: 2, elapsed: 35,
                            collected: ["star-01", "fish-02"], trial: .fire)
        store.updateRun(run)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state.run, run)
        XCTAssertTrue(store.state.fruits.isEmpty)
        XCTAssertFalse(store.startStage(.rooftop))
        XCTAssertEqual(store.state.run, run)
    }

    func testNativeValidationContainsInvalidCoordinatesTimeAndIDs() {
        let store = NativeSaveStore(defaults: defaults)
        store.updateRun(NativeRun(checkpointX: .nan, checkpointY: 9999, hearts: 999,
                                 elapsed: .infinity, collected: ["fish-01", "constructor", "bad id"], trial: .earth))
        XCTAssertEqual(store.state.run.checkpointX, 160)
        XCTAssertEqual(store.state.run.checkpointY, 768)
        XCTAssertEqual(store.state.run.hearts, 5)
        XCTAssertEqual(store.state.run.elapsed, 0)
        XCTAssertEqual(store.state.run.collected, ["fish-01"])
        XCTAssertNil(store.state.run.trial)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state, store.state)
    }

    func testCapacitorV2MigrationPreservesRewardsCheckpointAndHistoricalScores() throws {
        let legacy = #"{"version":2,"currentStage":"parking","bossBadges":["home","rooftop","basement"],"settings":{"music":0,"sfx":0.7,"reducedMotion":true},"run":{"checkpoint":{"x":3590,"y":640},"hearts":4,"elapsed":123000,"collected":["fish-01","fish-01"],"flags":{"fruit-trial-lightning":true}},"stages":{"home":{"completed":true,"fish":24,"stars":3,"secrets":1,"bestTime":200000}},"legacyStages":{"cafe":{"completed":true,"fish":10,"stars":2,"bestTime":90000}}}"#
        defaults.set(legacy, forKey: NativeSaveStore.capacitorKey)
        let store = NativeSaveStore(defaults: defaults)
        XCTAssertEqual(store.state.currentStage, .parking)
        XCTAssertEqual(store.state.fruits, [.fire, .wind, .water])
        XCTAssertEqual(store.state.run.checkpointX, 3590)
        XCTAssertEqual(store.state.run.hearts, 4)
        XCTAssertEqual(store.state.run.elapsed, 123)
        XCTAssertEqual(store.state.run.collected, ["fish-01"])
        XCTAssertEqual(store.state.run.trial, .lightning)
        XCTAssertEqual(store.state.maxHearts, 6)
        XCTAssertEqual(store.state.maxEnergy, 100)
        XCTAssertFalse(store.state.settings.music)
        XCTAssertTrue(store.state.settings.sound)
        XCTAssertTrue(store.state.settings.reducedMotion)
        XCTAssertEqual(store.state.stageRecords["home"]?.bestTime, 200)
        XCTAssertEqual(store.state.stageRecords["cafe"]?.bestTime, 90)
        XCTAssertEqual(defaults.string(forKey: NativeSaveStore.capacitorKey), legacy)
        XCTAssertNotNil(defaults.data(forKey: NativeSaveStore.storageKey))
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state, store.state)
    }

    func testLegacyWrenchRewardMigratesButExplorationScoresDoNotUnlockCombat() {
        defaults.set(#"{"version":1,"adventure":{"wrenchJoined":true},"stages":{"home":{"completed":true}}}"#,
                     forKey: NativeSaveStore.legacyKey)
        let earned = NativeSaveStore(defaults: defaults)
        XCTAssertEqual(earned.state.cleared, [.home])
        XCTAssertEqual(earned.state.fruits, [.fire])
        XCTAssertEqual(earned.state.unlockedStages, [.home, .rooftop])

        defaults.removeObject(forKey: NativeSaveStore.storageKey)
        defaults.set(#"{"version":1,"adventure":{"fireUnlocked":true},"stages":{"home":{"completed":true}},"run":{"flags":{"fire-trial":true}}}"#,
                     forKey: NativeSaveStore.legacyKey)
        let exploration = NativeSaveStore(defaults: defaults)
        XCTAssertTrue(exploration.state.cleared.isEmpty)
        XCTAssertTrue(exploration.state.fruits.isEmpty)
        XCTAssertEqual(exploration.state.run.trial, .fire)
        XCTAssertEqual(exploration.state.stageRecords["home"]?.completed, true)
    }

    func testCurrentNativeSnapshotTakesPriorityOverRetainedOldSave() {
        defaults.set(#"{"version":1,"adventure":{"wrenchJoined":true}}"#, forKey: NativeSaveStore.capacitorKey)
        let store = NativeSaveStore(defaults: defaults)
        XCTAssertTrue(store.startStage(.rooftop))
        store.complete(.rooftop)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state.cleared, [.home, .rooftop])
    }

    func testCorruptUnsupportedAndLockedStageSavesHaveSafeDefaults() {
        defaults.set(Data("{broken".utf8), forKey: NativeSaveStore.storageKey)
        defaults.set(#"{"version":99,"bossBadges":["home"]}"#, forKey: NativeSaveStore.capacitorKey)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state, NativeSave())
        defaults.set(#"{"version":2,"currentStage":"nightark","run":{"checkpoint":{"x":4000},"hearts":1,"flags":{"boss-defeated":true}}}"#,
                     forKey: NativeSaveStore.capacitorKey)
        let locked = NativeSaveStore(defaults: defaults)
        XCTAssertEqual(locked.state.currentStage, .home)
        XCTAssertEqual(locked.state.run, NativeRun())
    }

    func testUnknownLegacyStageKeepsScoresButCannotReuseWrongCheckpoint() {
        defaults.set(#"{"version":1,"currentStage":"cafe","run":{"checkpoint":{"x":3000},"hearts":1},"stages":{"cafe":{"completed":true,"stars":3}}}"#,
                     forKey: NativeSaveStore.capacitorKey)
        let store = NativeSaveStore(defaults: defaults)
        XCTAssertEqual(store.state.currentStage, .home)
        XCTAssertEqual(store.state.run, NativeRun())
        XCTAssertEqual(store.state.stageRecords["cafe"]?.stars, 3)
    }

    func testJSONBooleansAreNotAcceptedAsNumericSaveVersion() {
        defaults.set(#"{"version":true,"adventure":{"wrenchJoined":true}}"#, forKey: NativeSaveStore.capacitorKey)
        XCTAssertEqual(NativeSaveStore(defaults: defaults).state, NativeSave())
    }
}
