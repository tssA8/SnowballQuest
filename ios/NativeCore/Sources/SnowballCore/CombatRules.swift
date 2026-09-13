import Foundation

/// All times are active play time in seconds, so pausing cannot advance cooldowns.
public struct ChargeProfile: Equatable {
    public let ratio: Double
    public let cost: Double
    public let damage: Double
    public let piercing: Bool

    public static let chargeDuration = 1.2
    public static let cooldown = 0.7

    public static func make(held: Double, fire: Bool, energy: Double) -> ChargeProfile? {
        guard held.isFinite, energy.isFinite, energy >= 16 else { return nil }
        // Whole energy points prevent rounding the cost beyond what the player owns.
        let ratio = min(1, max(0, (held - 0.15) / 1.05), max(0, (floor(energy) - 16) / 14))
        return ChargeProfile(ratio: ratio, cost: (16 + ratio * 14).rounded(),
                             damage: ((fire ? 32.0 : 24.0) + ratio * (fire ? 108.0 : 86.0)).rounded(),
                             piercing: ratio >= 0.999)
    }
}

public struct ComboHit: Equatable {
    public let step: Int
    public let damage: Double
    public let airborne: Bool
}

public struct ComboState {
    public private(set) var count = 0
    private var lastAttack = -Double.infinity
    private var readyAt = 0.0

    public init() {}

    public mutating func hit(now: Double, airborne: Bool) -> ComboHit? {
        guard now.isFinite, now >= readyAt else { return nil }
        let step = airborne ? 1 : now - lastAttack > 0.9 ? 1 : count % 3 + 1
        count = airborne ? 0 : step
        lastAttack = now
        readyAt = now + (airborne ? 0.36 : [0.26, 0.29, 0.45][step - 1])
        return ComboHit(step: step, damage: airborne ? 14 : [10, 12, 18][step - 1], airborne: airborne)
    }

    public mutating func reset() {
        count = 0
        lastAttack = -Double.infinity
        readyAt = 0
    }
}

public enum BossRules {
    public static func phase(health: Double, maxHealth: Double) -> Int {
        guard health.isFinite, maxHealth.isFinite, maxHealth > 0 else { return 3 }
        return health > maxHealth * 2 / 3 ? 1 : health > maxHealth / 3 ? 2 : 3
    }

    public static func armoredDamage(_ damage: Double, overheated: Bool = false,
                                     fromBehind: Bool = false, armored: Bool = false,
                                     piercing: Bool = false) -> Double {
        guard damage.isFinite, damage > 0 else { return 0 }
        let multiplier = overheated ? (fromBehind ? 2.0 : 1.35) : armored && !piercing ? 0.55 : 1
        return max(1, (damage * multiplier).rounded())
    }
}
