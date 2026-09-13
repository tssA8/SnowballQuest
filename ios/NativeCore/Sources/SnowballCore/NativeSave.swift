import Foundation
import CoreFoundation

public struct NativeSettings: Codable, Equatable {
    public var music: Bool
    public var sound: Bool
    public var haptics: Bool
    public var reducedMotion: Bool

    public init(music: Bool = true, sound: Bool = true, haptics: Bool = true, reducedMotion: Bool = false) {
        self.music = music
        self.sound = sound
        self.haptics = haptics
        self.reducedMotion = reducedMotion
    }
}

public struct NativeRun: Codable, Equatable {
    public var checkpointX: Double
    public var checkpointY: Double
    public var hearts: Int
    /// Active play time in seconds, excluding menus and background time.
    public var elapsed: Double
    public var collected: Set<String>
    public var trial: Fruit?
    public var bossDefeated: Bool

    public init(checkpointX: Double = 160, checkpointY: Double = 640, hearts: Int = 5,
                elapsed: Double = 0, collected: Set<String> = [], trial: Fruit? = nil,
                bossDefeated: Bool = false) {
        self.checkpointX = checkpointX
        self.checkpointY = checkpointY
        self.hearts = hearts
        self.elapsed = elapsed
        self.collected = collected
        self.trial = trial
        self.bossDefeated = bossDefeated
    }

    internal func validated(maxHearts: Int, stage: StageID) -> NativeRun {
        var run = self
        run.checkpointX = bounded(checkpointX, fallback: 160, lower: 16, upper: 4832)
        run.checkpointY = bounded(checkpointY, fallback: 640, lower: 16, upper: 768)
        run.hearts = min(maxHearts, max(0, hearts))
        run.elapsed = bounded(elapsed, fallback: 0, lower: 0, upper: 86_400)
        run.collected = Set(collected.filter(validIdentifier).sorted().prefix(2000))
        if trial != StageDefinition.find(stage).fruit { run.trial = nil }
        return run
    }
}

public struct NativeStageRecord: Codable, Equatable {
    public var completed: Bool
    public var fish: Int
    public var stars: Int
    public var secrets: Int
    /// Fastest completed run in seconds. Legacy milliseconds are converted on migration.
    public var bestTime: Double?

    public init(completed: Bool = false, fish: Int = 0, stars: Int = 0, secrets: Int = 0,
                bestTime: Double? = nil) {
        self.completed = completed
        self.fish = fish
        self.stars = stars
        self.secrets = secrets
        self.bestTime = bestTime
    }

    internal var validated: NativeStageRecord {
        var record = self
        record.fish = min(100_000, max(0, fish))
        record.stars = min(3, max(0, stars))
        record.secrets = min(100, max(0, secrets))
        if let time = bestTime {
            record.bestTime = time.isFinite && time > 0 ? min(86_400, time) : nil
        }
        return record
    }
}

public struct NativeSave: Codable, Equatable {
    public var version = 1
    public var currentStage: StageID
    public var cleared: Set<StageID>
    public var settings: NativeSettings
    public var run: NativeRun
    /// Includes historical cafe/garden/ending records; scores do not grant boss rewards.
    public var stageRecords: [String: NativeStageRecord]

    public init(currentStage: StageID = .home, cleared: Set<StageID> = [],
                settings: NativeSettings = NativeSettings(), run: NativeRun = NativeRun(),
                stageRecords: [String: NativeStageRecord] = [:]) {
        self.currentStage = currentStage
        self.cleared = cleared
        self.settings = settings
        self.run = run
        self.stageRecords = stageRecords
    }

    public var unlockedStages: [StageID] {
        StageID.allCases.enumerated().compactMap { index, stage in
            index == 0 || cleared.contains(StageID.allCases[index - 1]) ? stage : nil
        }
    }

    public var fruits: [Fruit] {
        StageDefinition.all.filter { cleared.contains($0.id) }.compactMap(\.fruit)
    }
    public var maxHearts: Int { cleared.contains(.basement) ? 6 : 5 }
    public var maxEnergy: Double { cleared.contains(.parking) ? 120 : 100 }
    public var attackMultiplier: Double { cleared.contains(.home) ? 1.1 : 1 }
    public var energyPerSecond: Double { cleared.contains(.parking) ? 15 : 12 }

    internal var validated: NativeSave {
        var save = self
        save.version = 1
        if !unlockedStages.contains(currentStage) {
            save.currentStage = .home
            save.run = NativeRun(hearts: maxHearts)
        }
        save.run = save.run.validated(maxHearts: maxHearts, stage: save.currentStage)
        let knownRecords = Set(StageID.allCases.map(\.rawValue) + ["cafe", "garden", "ending"])
        save.stageRecords = stageRecords.filter { knownRecords.contains($0.key) }.mapValues(\.validated)
        return save
    }
}

/// Own on the UI thread. UserDefaults keeps a synchronous in-memory snapshot and handles disk writes.
public final class NativeSaveStore {
    public static let storageKey = "snowball-quest-native-save-v1"
    public static let legacyKey = "snowball-quest-save-v1"
    public static let capacitorKey = "CapacitorStorage.\(legacyKey)"
    public private(set) var state: NativeSave
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = Self.readData(defaults, key: Self.storageKey),
           let decoded = try? JSONDecoder().decode(NativeSave.self, from: data), decoded.version == 1 {
            state = decoded.validated
        } else if let migrated = Self.migrate(defaults: defaults) {
            state = migrated.validated
            // Preserve the original Capacitor value so older versions can still read it.
            flush()
        } else {
            state = NativeSave()
        }
    }

    @discardableResult
    public func startStage(_ id: StageID) -> Bool {
        guard state.unlockedStages.contains(id) else { return false }
        state.currentStage = id
        state.run = NativeRun(hearts: state.maxHearts)
        flush()
        return true
    }

    public func updateRun(_ run: NativeRun) {
        state.run = run.validated(maxHearts: state.maxHearts, stage: state.currentStage)
        flush()
    }

    public func complete(_ stage: StageID) {
        guard state.unlockedStages.contains(stage) else { return }
        state.cleared.insert(stage)
        if state.currentStage == stage { state.run.bossDefeated = true }
        flush()
    }

    public func recordResult(_ stage: StageID, fish: Int, stars: Int, secrets: Int = 0, time: Double) {
        guard state.cleared.contains(stage), time.isFinite, time > 0 else { return }
        let old = state.stageRecords[stage.rawValue] ?? NativeStageRecord()
        state.stageRecords[stage.rawValue] = NativeStageRecord(
            completed: true, fish: max(old.fish, fish), stars: max(old.stars, stars),
            secrets: max(old.secrets, secrets), bestTime: min(old.bestTime ?? .infinity, time)).validated
        flush()
    }

    public func updateSettings(_ settings: NativeSettings) {
        state.settings = settings
        flush()
    }

    public func flush() {
        state = state.validated
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: Self.storageKey)
    }

    private static func readData(_ defaults: UserDefaults, key: String) -> Data? {
        if let data = defaults.data(forKey: key) { return data }
        return defaults.string(forKey: key)?.data(using: .utf8)
    }

    private static func migrate(defaults: UserDefaults) -> NativeSave? {
        for key in [capacitorKey, legacyKey] {
            guard let data = readData(defaults, key: key),
                  let object = try? JSONSerialization.jsonObject(with: data),
                  let root = object as? [String: Any],
                  let version = number(root["version"]), version == 1 || version == 2 else { continue }
            let adventure = dictionary(root["adventure"])
            let badges = (root["bossBadges"] as? [String] ?? []).compactMap(StageID.init(rawValue:))
            var cleared = Set(badges)
            if adventure["wrenchJoined"] as? Bool == true { cleared.insert(.home) }
            let oldSettings = dictionary(root["settings"])
            let settings = NativeSettings(music: (number(oldSettings["music"]) ?? 0.25) > 0,
                                          sound: (number(oldSettings["sfx"]) ?? 0.65) > 0,
                                          reducedMotion: oldSettings["reducedMotion"] as? Bool == true)
            let rawStage = root["currentStage"] as? String ?? "home"
            let knownStage = StageID(rawValue: rawStage)
            let stage = knownStage ?? .home
            var save = NativeSave(currentStage: stage, cleared: cleared, settings: settings)
            let oldRun = dictionary(root["run"])
            let checkpoint = dictionary(oldRun["checkpoint"])
            let flags = dictionary(oldRun["flags"])
            let stageFruit = StageDefinition.find(stage).fruit
            let trial: Fruit?
            if let fruit = stageFruit,
               flags["fruit-trial-\(fruit.rawValue)"] as? Bool == true || (fruit == .fire && flags["fire-trial"] as? Bool == true) {
                trial = fruit
            } else { trial = nil }
            save.run = NativeRun(
                checkpointX: number(checkpoint["x"]) ?? 160,
                checkpointY: number(checkpoint["y"]) ?? 640,
                hearts: integer(oldRun["hearts"], fallback: save.maxHearts, upper: save.maxHearts),
                elapsed: (number(oldRun["elapsed"]) ?? 0) / 1000,
                collected: Set(oldRun["collected"] as? [String] ?? []), trial: trial,
                bossDefeated: flags["boss-defeated"] as? Bool == true)
            if knownStage == nil { save.run = NativeRun(hearts: save.maxHearts) }
            let oldRecords = dictionary(root["legacyStages"]).merging(dictionary(root["stages"])) { _, new in new }
            for (id, value) in oldRecords {
                let record = dictionary(value)
                save.stageRecords[id] = NativeStageRecord(
                    completed: record["completed"] as? Bool == true,
                    fish: integer(record["fish"], upper: 100_000),
                    stars: integer(record["stars"], upper: 3),
                    secrets: integer(record["secrets"], upper: 100),
                    bestTime: number(record["bestTime"]).map { $0 / 1000 }).validated
            }
            return save.validated
        }
        return nil
    }
}

private func dictionary(_ value: Any?) -> [String: Any] { value as? [String: Any] ?? [:] }

private func number(_ value: Any?) -> Double? {
    guard let value = value as? NSNumber, CFGetTypeID(value) != CFBooleanGetTypeID() else { return nil }
    return value.doubleValue.isFinite ? value.doubleValue : nil
}

private func integer(_ value: Any?, fallback: Int = 0, upper: Int) -> Int {
    guard let value = number(value) else { return fallback }
    return Int(min(Double(upper), max(0, value)))
}

private func bounded(_ value: Double, fallback: Double, lower: Double, upper: Double) -> Double {
    value.isFinite ? min(upper, max(lower, value)) : fallback
}

private func validIdentifier(_ value: String) -> Bool {
    guard !["__proto__", "constructor", "prototype"].contains(value) else { return false }
    return value.range(of: "^[a-zA-Z0-9_:-]{1,100}$", options: .regularExpression) != nil
}
