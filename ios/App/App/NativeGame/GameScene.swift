import SpriteKit
import SnowballCore

struct GameHUDState {
    var hearts: Int
    var maxHearts: Int
    var energy: Double
    var maxEnergy: Double
    var fish: Int
    var stars: Int
    var fruit: Fruit?
    var charging: Bool
    var chargeRatio: Double
    var bossName: String?
    var bossPhase: Int
    var bossHealthRatio: Double
}

protocol GameSceneDelegate: AnyObject {
    func gameScene(_ scene: GameScene, didUpdate hud: GameHUDState)
    func gameScene(_ scene: GameScene, showDialogue speaker: String, lines: [String], completion: @escaping () -> Void)
    func gameScene(_ scene: GameScene, didComplete stage: StageDefinition)
    func gameScene(_ scene: GameScene, toast message: String)
    func gameScene(_ scene: GameScene, feedback event: GameFeedback)
}

/// Native SpriteKit presentation with an explicit, pause-safe game clock and platform solver.
final class GameScene: SKScene {
    enum Mode { case intro, playing, paused, defeated, complete }
    weak var gameDelegate: GameSceneDelegate?
    let stage: StageDefinition
    let store: NativeSaveStore
    let world: GameWorld
    let boss: GameBoss
    let player: SKSpriteNode
    let appearance = SnowballAppearance()
    private(set) var hearts: Int
    private(set) var energy: Double
    private(set) var fruit: Fruit?
    private(set) var mode: Mode = .intro
    private(set) var clock: Double = 0
    private(set) var enemies: [GameEnemy] = []
    private(set) var hazards: [GameHazard] = []
    private(set) var charging = false
    private(set) var chargeElapsed = 0.0

    private var runSave: NativeRun
    private let followCamera = SKCameraNode()
    private let effectsLayer = SKNode()
    private let aura = SKShapeNode(circleOfRadius: 30)
    private let chargeRing = SKShapeNode(circleOfRadius: 42)
    private let warningLabel = SKLabelNode(fontNamed: "PingFangTC-Semibold")
    private let audio = GameAudio()
    private var collectibleNodes: [String: SKSpriteNode] = [:]
    private var healing: [HealingCan] = []
    private var projectiles: [PlayerShot] = []
    private var combatBursts: [ElementalBurst] = []
    private var altar: SKSpriteNode?
    private var velocity = CGVector.zero
    private var movement: CGFloat = 0
    private var facing: CGFloat = 1
    private var grounded = false
    private var jumpHeld = false
    private var jumpBufferedUntil = -1.0
    private var coyoteUntil = -1.0
    private var airJumpAvailable = true
    private var dashUntil = 0.0
    private var dashReadyAt = 0.0
    private var dodgeUntil = 0.0
    private var invulnerableUntil = 0.0
    private var shieldUntil = 0.0
    private var earthGuardReadyAt = 0.0
    private var castReadyAt = 0.0
    private var emergencyReadyAt = 0.0
    private var rescueUsed = false
    private var stomping = false
    private var combo = ComboState()
    private var poseFrames: [Int] = []
    private var poseStarted = 0.0
    private var poseUntil = 0.0
    private var lastFrameTime: TimeInterval?
    private var autosaveElapsed = 0.0
    private var hudElapsed = 0.0
    private var retryRemaining = 0.0
    private var introductionPresented = false
    private var reconciliationPresented = false
    private var fullChargeNotified = false
    private var previousCastFruit: Fruit?
    private var previousCastAt = -10.0

    private final class HealingCan {
        let node = SKNode()
        let arena: Bool
        let emergency: Bool
        let id: String
        var readyAt = 0.0
        init(x: CGFloat, id: String, arena: Bool, emergency: Bool = false) {
            self.id = id; self.arena = arena; self.emergency = emergency
            node.position = CGPoint(x: x, y: 152); node.zPosition = 9
            node.box(CGRect(x: -16, y: -17, width: 32, height: 32), color: UIColor(hex: 0xf4e7ce), radius: 8)
            node.box(CGRect(x: -17, y: 12, width: 34, height: 5), color: UIColor(hex: 0xaca9a1), radius: 2)
            let heart = GameArt.sprite("heart", size: CGSize(width: 20, height: 20))
            heart.position = CGPoint(x: 0, y: -12); node.addChild(heart)
        }
    }

    private final class PlayerShot {
        let node: ElementalProjectileVisual
        let direction: CGFloat
        let damage: Double
        let fruit: Fruit?
        let piercing: Bool
        let radius: CGFloat
        let born: Double
        let duration: Double
        var victims = Set<ObjectIdentifier>()
        var spent = false
        init(position: CGPoint, direction: CGFloat, damage: Double, fruit: Fruit?,
             ratio: Double, piercing: Bool, now: Double, starburst: Bool, reducedMotion: Bool) {
            self.direction = direction; self.damage = damage; self.fruit = fruit
            self.piercing = piercing; radius = starburst ? 43 : 13 + CGFloat(ratio) * 20
            born = now; duration = 1.5 + ratio * 0.5
            node = ElementalProjectileVisual(fruit: fruit, radius: radius, power: ratio,
                                             starburst: starburst, reducedMotion: reducedMotion)
            node.position = position; node.xScale = direction; node.zPosition = 18
        }
    }

    init(stage: StageDefinition, store: NativeSaveStore) {
        self.stage = stage; self.store = store
        world = GameWorld(stage: stage); boss = GameBoss(stage: stage)
        player = GameArt.sprite("snowball")
        hearts = store.state.run.hearts > 0 ? store.state.run.hearts : store.state.maxHearts
        energy = store.state.maxEnergy; runSave = store.state.run
        fruit = store.state.run.trial
        super.init(size: CGSize(width: 844, height: 390))
        scaleMode = .resizeFill; backgroundColor = UIColor(hex: 0x171b36)
        addChild(world.node); addChild(effectsLayer); effectsLayer.zPosition = 20
        player.position = CGPoint(x: runSave.checkpointX, y: 768 - runSave.checkpointY)
        player.zPosition = 16; addChild(player)
        player.addChild(appearance)
        appearance.update(fruit: fruit, frame: 0, elapsed: 0, reducedMotion: store.state.settings.reducedMotion)
        aura.position = CGPoint(x: 0, y: 26); aura.fillColor = .clear; aura.lineWidth = 2
        player.addChild(aura)
        chargeRing.fillColor = .clear; chargeRing.strokeColor = .white; chargeRing.lineWidth = 3
        chargeRing.position = CGPoint(x: 0, y: 26); chargeRing.isHidden = true; player.addChild(chargeRing)
        addChild(boss.sprite); addChild(boss.markers)
        warningLabel.fontSize = 20; warningLabel.fontColor = UIColor(hex: 0xffe2a3)
        warningLabel.zPosition = 50; addChild(warningLabel)
        camera = followCamera; addChild(followCamera)
        buildCollectibles(); buildEnemies(); buildHealing(); buildAltar(); buildCheckpoints()
        boss.onPhase = { [weak self] in
            guard let self else { return }
            self.clearHazards(); self.energy = max(self.energy, 30)
            self.toast("防禦鬆動了！集氣反擊的機會來了")
        }
        boss.onDefeated = { [weak self] in self?.bossDefeated() }
        if runSave.bossDefeated {
            boss.state = .defeated; boss.health = 0
            boss.sprite.texture = GameArt.texture(key: stage.bossKey, frame: 7)
        }
        updateCamera(immediate: true)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    override func didMove(to view: SKView) {
        publishHUD()
        guard !introductionPresented else { return }
        introductionPresented = true
        if runSave.bossDefeated { presentReconciliation(); return }
        let lines = runSave.elapsed > 0 ? ["回到\(stage.title)。已從最近的腳印接續冒險。", "按住集氣再放開發射；罐頭會回復兩顆心。"] : stage.intro
        if let delegate = gameDelegate {
            delegate.gameScene(self, showDialogue: "小鈴 · 第 \(stage.index) 關", lines: lines) { [weak self] in self?.resumeGame() }
        } else { resumeGame() }
    }

    override func willMove(from view: SKView) {
        cancelCharge(); movement = 0; jumpHeld = false; audio.stopAll(); lastFrameTime = nil
        // The controller saves before changing stages. Saving here would overwrite a newly reset run.
    }

    override func didChangeSize(_ oldSize: CGSize) { updateCamera(immediate: true) }

    var availableFruits: [Fruit] {
        var fruits = store.state.fruits
        if let trial = runSave.trial, !fruits.contains(trial) { fruits.append(trial) }
        return Fruit.allCases.filter { fruits.contains($0) }
    }

    func setMovement(_ amount: CGFloat) { movement = mode == .playing ? min(1, max(-1, amount)) : 0 }

    func setJump(_ held: Bool) {
        guard mode == .playing else { jumpHeld = false; return }
        if held && !jumpHeld {
            if !grounded && clock > coyoteUntil && fruit == .wind && airJumpAvailable {
                airJumpAvailable = false; velocity.dy = 420; feedback(.jump); sparkle(player.position, color: Self.color(.wind))
            } else { jumpBufferedUntil = clock + 0.14 }
        }
        if !held && jumpHeld && velocity.dy > 120 { velocity.dy *= 0.5 }
        jumpHeld = held
    }

    func dash() {
        guard mode == .playing, clock >= dashReadyAt else { return }
        dashUntil = clock + 0.17; dodgeUntil = clock + 0.36; dashReadyAt = clock + 0.75
        velocity.dx = facing * (fruit == .lightning ? 920 : 690)
        pose([10, 11, 12], duration: 0.22); sparkle(player.position, color: Self.color(fruit))
    }

    func attack() {
        guard mode == .playing, let hit = combo.hit(now: clock, airborne: !grounded) else { return }
        // These are poses of the approved Snowball, not the unrecolored combat atlas.
        let frames = hit.airborne ? [16, 18, 19] : hit.step == 1 ? [28, 18, 29] : hit.step == 2 ? [29, 16, 18, 28] : [28, 16, 18, 19, 29]
        pose(frames, duration: hit.step == 3 ? 0.36 : 0.24)
        if fruit == .earth && !grounded { stomping = true; velocity.dy = -760 }
        let thirdHitBonus = hit.step == 3 && store.state.cleared.contains(.foundations) ? 1.25 : 1.0
        let damage = hit.damage * store.state.attackMultiplier * (fruit == .fire ? 1.25 : 1) * thirdHitBonus
        let range: CGFloat = hit.step == 3 ? 113 : 87
        var landed = false
        for enemy in enemies where !enemy.defeated {
            if meleeReaches(enemy.sprite.position, range: range, halfWidth: 25) {
                strike(enemy, damage: damage, element: fruit); landed = true
            }
        }
        if meleeReaches(boss.sprite.position, range: range, halfWidth: 78) {
            landed = boss.hit(elementDamage(damage, element: fruit), sourceX: player.position.x, now: clock) || landed
        }
        addBurst(at: CGPoint(x: player.position.x + facing * 39, y: player.position.y + 28),
                 fruit: fruit, kind: .melee, direction: facing, strength: hit.step == 3 ? 1.25 : 0.9)
        if landed { energy = min(store.state.maxEnergy, energy + 3); feedback(.hit) }
        publishHUD()
    }

    func setCharge(_ held: Bool) {
        guard mode == .playing else { cancelCharge(); return }
        if held {
            guard !charging, clock >= castReadyAt else { return }
            guard energy >= 16 else { toast("呼嚕能量正在回復，稍等一下就能集氣"); return }
            charging = true; chargeElapsed = 0; fullChargeNotified = false; chargeRing.isHidden = false
        } else if charging {
            let heldTime = chargeElapsed
            cancelCharge(); cast(held: heldTime)
        }
        publishHUD()
    }

    func cancelCharge() {
        charging = false; chargeElapsed = 0; fullChargeNotified = false; chargeRing.isHidden = true
        publishHUD()
    }

    func cycleFruit() {
        guard mode == .playing else { return }
        let options: [Fruit?] = [nil] + availableFruits.map { Optional($0) }
        guard options.count > 1 else { toast("向右找到本關果實，就能切換形態"); return }
        cancelCharge()
        let index = options.firstIndex(where: { $0 == fruit }) ?? 0
        fruit = options[(index + 1) % options.count]
        pose([30, 31, 30], duration: 0.25)
        addBurst(at: CGPoint(x: player.position.x, y: player.position.y + 25), fruit: fruit, kind: .transformation)
        toast(fruit.map { "\($0.title)形態" } ?? "原生雪球")
        publishHUD()
    }

    func pauseGame() {
        // Dialogue already freezes gameplay; keep it distinct so interruptions cannot resume a defeated boss.
        if mode == .playing || mode == .defeated { mode = .paused }
        cancelCharge(); movement = 0; jumpHeld = false; jumpBufferedUntil = -1
        audio.stopAll(); lastFrameTime = nil; persist()
    }

    func resumeGame() {
        guard mode != .complete else { return }
        if runSave.bossDefeated {
            if !reconciliationPresented { presentReconciliation() }
            return
        }
        mode = hearts > 0 ? .playing : .defeated
        lastFrameTime = nil
        audio.startMusic(enabled: store.state.settings.music)
        publishHUD()
    }

    func persist() {
        guard store.state.currentStage == stage.id else { return }
        runSave.hearts = hearts
        store.updateRun(runSave)
    }

    override func update(_ currentTime: TimeInterval) {
        defer { lastFrameTime = currentTime }
        guard let previous = lastFrameTime else { return }
        advance(delta: currentTime - previous)
    }

    /// Shared by rendering and deterministic hosted tests. Simulation never uses wall-clock timers.
    func advance(delta rawDelta: Double) {
        guard rawDelta.isFinite, rawDelta > 0 else { return }
        let delta = min(0.05, rawDelta)
        if mode == .defeated {
            retryRemaining -= delta
            if retryRemaining <= 0 { retryCheckpoint() }
            return
        }
        guard mode == .playing else { return }
        clock += delta; runSave.elapsed += delta
        updateBursts(delta: delta)
        energy = min(store.state.maxEnergy, energy + store.state.energyPerSecond * delta)
        if charging {
            chargeElapsed = min(ChargeProfile.chargeDuration, chargeElapsed + delta)
            if chargeElapsed >= ChargeProfile.chargeDuration && !fullChargeNotified {
                fullChargeNotified = true; feedback(.charged)
            }
        }
        updateMovement(delta: delta)
        guard mode == .playing else { return }
        collectItems(); updateAltar(); updateCheckpoint()
        if player.position.x >= 3650 && boss.state == .dormant { startBoss() }
        for enemy in enemies where mode == .playing {
            enemy.update(now: clock, delta: delta, player: player.position, fruit: fruit,
                         hurt: { [weak self] x in self?.receiveDamage(from: x) },
                         shoot: { [weak self] hazard in self?.addHazard(hazard) })
        }
        guard mode == .playing else { return }
        boss.update(now: clock, delta: delta, player: player.position, fruit: fruit,
                    hurt: { [weak self] x in self?.receiveDamage(from: x) },
                    shoot: { [weak self] hazard in self?.addHazard(hazard) },
                    summon: { [weak self] x in self?.summonEnemy(x: x) })
        guard mode == .playing else { return }
        updateProjectiles(delta: delta)
        guard mode == .playing else { return }
        updateHazards(delta: delta)
        guard mode == .playing else { return }
        updateHealing(); updatePlayerArt(); updateCamera(immediate: false)
        warningLabel.text = boss.warningText; warningLabel.position = CGPoint(x: followCamera.position.x, y: followCamera.position.y + 115)
        autosaveElapsed += delta; hudElapsed += delta
        if autosaveElapsed >= 2 { autosaveElapsed = 0; persist() }
        if hudElapsed >= 0.05 { hudElapsed = 0; publishHUD() }
    }

    private func updateMovement(delta: Double) {
        let dt = CGFloat(delta)
        let environment = world.update(delta: delta, player: player.position, fruit: fruit, grounded: grounded)
        player.position.y += environment.ride
        if grounded { coyoteUntil = clock + 0.12; airJumpAvailable = true }
        if clock <= jumpBufferedUntil && (grounded || clock <= coyoteUntil) {
            velocity.dy = 470; grounded = false; coyoteUntil = -1; jumpBufferedUntil = -1; feedback(.jump)
        }
        if clock >= dashUntil {
            let target = movement * (fruit == .wind ? 285 : 260)
            let acceleration: CGFloat = grounded ? 1900 : 1250
            velocity.dx = approach(velocity.dx, target, amount: acceleration * dt)
        }
        if abs(movement) > 0.1 && clock >= dashUntil { facing = movement < 0 ? -1 : 1 }
        velocity.dy -= environment.gravity * dt
        if environment.lift > 0 { velocity.dy = max(velocity.dy, environment.lift) }
        if fruit == .wind && jumpHeld && !stomping { velocity.dy = max(-115, velocity.dy) }
        velocity.dy = max(-900, velocity.dy)
        let old = player.position
        var point = old
        point.x += velocity.dx * dt
        for platform in world.platforms where !platform.oneWay {
            let rect = platform.rect
            guard point.y + 45 > rect.minY + 1, point.y < rect.maxY - 1 else { continue }
            if velocity.dx > 0, old.x + 16 <= rect.minX + 2, point.x + 16 > rect.minX {
                point.x = rect.minX - 16; velocity.dx = 0
            } else if velocity.dx < 0, old.x - 16 >= rect.maxX - 2, point.x - 16 < rect.maxX {
                point.x = rect.maxX + 16; velocity.dx = 0
            }
        }
        let arenaLeft: CGFloat = boss.active ? 3545 : 24
        point.x = min(world.width - 25, max(arenaLeft, point.x))
        point.y += velocity.dy * dt; grounded = false
        for platform in world.platforms {
            let rect = platform.rect
            guard point.x + 15 > rect.minX, point.x - 15 < rect.maxX else { continue }
            if velocity.dy <= 0, old.y >= rect.maxY - 5, point.y <= rect.maxY {
                point.y = rect.maxY; velocity.dy = 0; grounded = true
            } else if !platform.oneWay && velocity.dy > 0, old.y + 46 <= rect.minY + 1, point.y + 46 >= rect.minY {
                point.y = rect.minY - 46; velocity.dy = 0
            }
        }
        player.position = point
        if grounded && stomping { stomping = false; groundShockwave() }
        if environment.electric { receiveDamage(from: point.x - facing * 20) }
        if player.position.y < -100 { loseLifeToFall() }
    }

    private func cast(held: Double) {
        guard mode == .playing, clock >= castReadyAt,
              let profile = ChargeProfile.make(held: held, fire: fruit == .fire, energy: energy) else { return }
        let starburst = (stage.id == .nightark || store.state.cleared.contains(.nightark)) && profile.piercing && energy >= 100
        let cost = starburst ? 100.0 : profile.cost
        var damage = (starburst ? 240 : profile.damage) * store.state.attackMultiplier
        if stage.index >= 6 || store.state.cleared.contains(.floor13), let current = fruit, let previous = previousCastFruit,
           current != previous && clock - previousCastAt <= 4.5 {
            damage *= 1.4; toast("元素連攜！")
        }
        previousCastFruit = fruit; previousCastAt = clock
        energy -= cost; castReadyAt = clock + ChargeProfile.cooldown
        if fruit == .water { shieldUntil = clock + 6 }
        if fruit == .earth { earthGuardReadyAt = min(earthGuardReadyAt, clock) }
        if starburst { clearHazards(); toast("星貓爆發！大家一起回家！") }
        let shot = PlayerShot(position: CGPoint(x: player.position.x + facing * 37, y: player.position.y + 31),
                              direction: facing, damage: damage, fruit: fruit, ratio: profile.ratio,
                              piercing: profile.piercing, now: clock, starburst: starburst,
                              reducedMotion: store.state.settings.reducedMotion)
        projectiles.append(shot); addChild(shot.node)
        pose([28, 29, 18], duration: 0.24)
        addBurst(at: shot.node.position, fruit: fruit, kind: .launch, direction: facing,
                 strength: 0.6 + CGFloat(profile.ratio) * 0.6)
        feedback(profile.piercing ? .charged : .hit)
    }

    private func updateProjectiles(delta: Double) {
        for shot in projectiles {
            shot.node.update(elapsed: clock - shot.born)
            shot.node.position.x += shot.direction * (shot.fruit == .lightning ? 840 : 620) * CGFloat(delta)
            if clock - shot.born > shot.duration || shot.node.position.x < 0 || shot.node.position.x > world.width { shot.spent = true }
            guard !shot.spent else { continue }
            for enemy in enemies where !enemy.defeated {
                let identity = ObjectIdentifier(enemy)
                guard !shot.victims.contains(identity), abs(shot.node.position.x - enemy.sprite.position.x) < shot.radius + 27,
                      abs(shot.node.position.y - enemy.sprite.position.y - 28) < shot.radius + 30 else { continue }
                shot.victims.insert(identity)
                strike(enemy, damage: shot.damage, element: shot.fruit)
                if shot.fruit == .lightning { chainLightning(from: enemy, damage: shot.damage * 0.55, excluding: shot.victims) }
                addBurst(at: shot.node.position, fruit: shot.fruit, kind: .impact, direction: shot.direction)
                feedback(.hit)
                if !shot.piercing { shot.spent = true; break }
            }
            if !shot.spent, boss.active,
               abs(shot.node.position.x - boss.sprite.position.x) < shot.radius + 72,
               abs(shot.node.position.y - boss.sprite.position.y - 75) < shot.radius + 82 {
                if boss.hit(elementDamage(shot.damage, element: shot.fruit), sourceX: shot.node.position.x - shot.direction * 100,
                            now: clock, piercing: shot.piercing) {
                    shot.spent = true
                    addBurst(at: shot.node.position, fruit: shot.fruit, kind: .impact, direction: shot.direction, strength: 1.3)
                    feedback(.hit)
                }
            }
            if mode != .playing { break }
        }
        projectiles.removeAll { shot in
            if shot.spent { shot.node.removeFromParent(); return true }
            return false
        }
    }

    private func strike(_ enemy: GameEnemy, damage: Double, element: Fruit?) {
        let weaknesses: [String: Fruit] = ["vacuum": .fire, "mouse": .fire, "pigeon": .wind,
                                         "slime": .water, "beetle": .lightning, "mole": .earth]
        let power = damage * (element != nil && weaknesses[enemy.kind] == element ? 1.3 : 1)
        enemy.hit(power, direction: facing, now: clock)
        if enemy.defeated && !enemy.arena, let index = enemies.firstIndex(where: { $0 === enemy }) {
            runSave.collected.insert("enemy-route-\(index)")
            energy = min(store.state.maxEnergy, energy + 5)
        }
    }

    private func chainLightning(from enemy: GameEnemy, damage: Double, excluding: Set<ObjectIdentifier>) {
        guard let nearby = enemies.first(where: { !$0.defeated && $0 !== enemy && !excluding.contains(ObjectIdentifier($0)) &&
            abs($0.sprite.position.x - enemy.sprite.position.x) < 190 }) else { return }
        strike(nearby, damage: damage, element: .lightning)
        let path = CGMutablePath(); path.move(to: CGPoint(x: enemy.sprite.position.x, y: enemy.sprite.position.y + 30))
        path.addLine(to: CGPoint(x: nearby.sprite.position.x, y: nearby.sprite.position.y + 30))
        let bolt = SKShapeNode(path: path); bolt.strokeColor = Self.color(.lightning); bolt.lineWidth = 5
        effectsLayer.addChild(bolt); bolt.run(.sequence([.fadeOut(withDuration: 0.18), .removeFromParent()]))
    }

    private func groundShockwave() {
        for enemy in enemies where !enemy.defeated && abs(enemy.sprite.position.x - player.position.x) < 140 && abs(enemy.sprite.position.y - player.position.y) < 60 {
            strike(enemy, damage: 36 * store.state.attackMultiplier, element: .earth)
        }
        if abs(boss.sprite.position.x - player.position.x) < 190 && abs(boss.sprite.position.y - player.position.y) < 70 {
            _ = boss.hit(36 * store.state.attackMultiplier, sourceX: player.position.x, now: clock)
        }
        let ring = effectsLayer.disc(player.position, radius: 115, color: Self.color(.earth).withAlphaComponent(0.25))
        ring.yScale = 0.2; ring.run(.sequence([.fadeOut(withDuration: 0.35), .removeFromParent()]))
    }

    private func elementDamage(_ damage: Double, element: Fruit?) -> Double {
        let preferred: [StageID: Fruit] = [.home: .fire, .rooftop: .fire, .basement: .wind,
                                         .parking: .water, .foundations: .lightning, .floor13: .earth, .nightark: .fire]
        return damage * (element != nil && element == preferred[stage.id] ? 1.3 : 1)
    }

    private func meleeReaches(_ target: CGPoint, range: CGFloat, halfWidth: CGFloat) -> Bool {
        let forward = (target.x - player.position.x) * facing
        return forward >= -halfWidth && forward <= range + halfWidth && abs(target.y - player.position.y) < (grounded ? 80 : 110)
    }

    private func addHazard(_ hazard: GameHazard) {
        guard mode == .playing else { return }
        hazards.append(hazard); addChild(hazard.node)
    }

    private func updateHazards(delta: Double) {
        for hazard in hazards {
            hazard.update(now: clock, delta: delta)
            if hazard.hits(player.position, now: clock) {
                hazard.spent = true; receiveDamage(from: hazard.node.position.x)
                if mode != .playing { break }
            }
        }
        hazards.removeAll { hazard in
            if hazard.spent || clock >= hazard.expires {
                hazard.node.removeFromParent(); return true
            }
            return false
        }
    }

    func receiveDamage(from sourceX: CGFloat) {
        guard mode == .playing, clock >= invulnerableUntil, clock >= dodgeUntil else { return }
        if shieldUntil > clock || (fruit == .earth && clock >= earthGuardReadyAt) {
            shieldUntil = 0; earthGuardReadyAt = clock + 8; invulnerableUntil = clock + 0.6
            sparkle(player.position, color: Self.color(fruit)); toast("元素護盾擋住攻擊！"); return
        }
        hearts = max(0, hearts - 1); invulnerableUntil = clock + 1.6
        velocity.dx = player.position.x < sourceX ? -170 : 170; velocity.dy = 135
        pose([40, 41], duration: 0.3); feedback(.hurt)
        if hearts <= 0 {
            if boss.active && store.state.cleared.contains(.floor13) && !rescueUsed {
                rescueUsed = true; hearts = 3; energy = max(energy, 40); invulnerableUntil = clock + 3
                clearHazards(); toast("泡泡龍一家救援！回復三顆心"); feedback(.heal)
            } else { defeatPlayer() }
        }
        persist(); publishHUD()
    }

    private func loseLifeToFall() {
        hearts = max(0, hearts - 1)
        if hearts == 0 { defeatPlayer() }
        else {
            player.position = CGPoint(x: runSave.checkpointX, y: 768 - runSave.checkpointY)
            velocity = .zero; invulnerableUntil = clock + 2; cancelCharge()
            toast("回到最近的腳印，繼續前進吧"); persist(); publishHUD()
        }
    }

    private func defeatPlayer() {
        mode = .defeated; retryRemaining = 0.85; cancelCharge(); movement = 0; jumpHeld = false
        velocity = .zero; clearHazards(); clearProjectiles()
        player.texture = GameArt.texture(key: "snowball", frame: 42)
        appearance.update(fruit: fruit, frame: 42, elapsed: clock, reducedMotion: store.state.settings.reducedMotion)
        toast(boss.active ? "先休息一下，從魔王入口再試！" : "先休息一下，從最近的腳印再試！")
    }

    func retryCheckpoint() {
        clearHazards(); clearProjectiles(); cancelCharge(); combo.reset()
        hearts = store.state.maxHearts; energy = store.state.maxEnergy
        player.position = CGPoint(x: runSave.checkpointX, y: 768 - runSave.checkpointY)
        velocity = .zero; movement = 0; jumpHeld = false; jumpBufferedUntil = -1
        invulnerableUntil = clock + 2; dashUntil = 0; castReadyAt = clock; stomping = false
        shieldUntil = 0; rescueUsed = false; grounded = false; airJumpAvailable = true
        if runSave.checkpointX >= 3500 {
            boss.reset(); removeArenaEnemies(); resetArenaHealing()
        }
        mode = .playing; runSave.bossDefeated = false
        audio.startMusic(enabled: store.state.settings.music)
        persist(); updateCamera(immediate: true); publishHUD()
    }

    func startBoss() {
        guard mode == .playing, boss.state == .dormant else { return }
        cancelCharge(); runSave.checkpointX = 3590; runSave.checkpointY = 640
        hearts = store.state.maxHearts; energy = store.state.maxEnergy; rescueUsed = false
        invulnerableUntil = clock + 1.8; resetArenaHealing(); boss.start(now: clock)
        toast("\(stage.bossName)出現！留意預警，罐頭會持續補充")
        persist(); publishHUD()
    }

    private func bossDefeated() {
        guard !runSave.bossDefeated else { return }
        runSave.bossDefeated = true; mode = .intro; cancelCharge(); movement = 0; velocity = .zero
        clearHazards(); removeArenaEnemies(); audio.stopMusic(); feedback(.victory)
        persist(); publishHUD(); presentReconciliation()
    }

    private func presentReconciliation() {
        guard !reconciliationPresented else { return }
        reconciliationPresented = true
        mode = .intro
        if let delegate = gameDelegate {
            delegate.gameScene(self, showDialogue: stage.bossName, lines: stage.reconcile) { [weak self] in self?.finishStage() }
        } else { finishStage() }
    }

    private func finishStage() {
        guard mode != .complete else { return }
        store.complete(stage.id)
        store.recordResult(stage.id, fish: collectedCount("fish"), stars: collectedCount("star"), time: max(1, runSave.elapsed))
        mode = .complete; runSave.bossDefeated = true; clearProjectiles(); audio.stopAll(); persist(); publishHUD()
        gameDelegate?.gameScene(self, didComplete: stage)
    }

    private func buildEnemies() {
        let positions: [CGFloat] = [940, 1370, 2220, 2940]
        for (index, x) in positions.enumerated() {
            let enemy = GameEnemy(kind: stage.enemyKinds[index % stage.enemyKinds.count], x: x)
            if runSave.collected.contains("enemy-route-\(index)") { _ = enemy.hit(enemy.health, direction: 1, now: clock) }
            enemies.append(enemy); addChild(enemy.sprite)
        }
    }

    private func summonEnemy(x: CGFloat) {
        guard enemies.filter({ $0.arena && !$0.defeated }).count < 1 else { return }
        let kind = stage.id == .floor13 ? "dragon" : stage.enemyKinds[0]
        let enemy = GameEnemy(kind: kind, x: x, arena: true); enemies.append(enemy); addChild(enemy.sprite)
    }

    private func removeArenaEnemies() {
        enemies.removeAll { enemy in
            if enemy.arena { enemy.sprite.removeFromParent(); return true }
            return false
        }
    }

    private func buildCollectibles() {
        for item in world.collectibles where !runSave.collected.contains(item.id) && ["fish", "star", "heart"].contains(item.kind) {
            let node = GameArt.sprite(item.kind); node.position = item.position; node.zPosition = 8
            collectibleNodes[item.id] = node; addChild(node)
        }
    }

    private func collectItems() {
        for item in world.collectibles {
            guard let node = collectibleNodes[item.id], abs(player.position.x - item.position.x) < 35,
                  abs(player.position.y + 26 - item.position.y - 12) < 45 else { continue }
            if item.kind == "heart" && !heal(hearts: 1, energy: 0) { continue }
            if item.kind == "fish" { hearts = min(store.state.maxHearts, hearts + 1) }
            runSave.collected.insert(item.id); node.removeFromParent(); collectibleNodes.removeValue(forKey: item.id)
            energy = min(store.state.maxEnergy, energy + (item.kind == "star" ? 8 : 1))
            sparkle(item.position, color: UIColor(hex: 0xffe4a0))
            if item.kind == "star" { toast("找到星星！\(collectedCount("star")) / 3"); feedback(.heal) }
            persist(); publishHUD()
        }
    }

    private func collectedCount(_ kind: String) -> Int {
        world.collectibles.filter { $0.kind == kind && runSave.collected.contains($0.id) }.count
    }

    private func buildCheckpoints() {
        for point in world.checkpoints {
            let node = GameArt.sprite("checkpoint"); node.position = point; node.zPosition = 6; addChild(node)
        }
    }

    private func updateCheckpoint() {
        for checkpoint in world.checkpoints where checkpoint.x > CGFloat(runSave.checkpointX) + 30 {
            if abs(player.position.x - checkpoint.x) < 42 && abs(player.position.y - checkpoint.y) < 90 {
                runSave.checkpointX = Double(checkpoint.x); runSave.checkpointY = 768 - Double(checkpoint.y)
                hearts = store.state.maxHearts; energy = store.state.maxEnergy
                sparkle(player.position, color: UIColor(hex: 0x95e8b7)); feedback(.heal)
                persist(); publishHUD(); toast("腳印已記住進度 · 生命與能量全滿")
            }
        }
    }

    private func buildAltar() {
        guard let trial = stage.fruit, !availableFruits.contains(trial) else { return }
        let node = GameArt.sprite(trial.textureKey, size: CGSize(width: 43, height: 43))
        node.position = CGPoint(x: 500, y: 153); node.zPosition = 8; addChild(node); altar = node
        node.label("\(trial.title)果實", at: CGPoint(x: 0, y: 57), size: 16, color: Self.color(trial))
    }

    private func updateAltar() {
        guard let node = altar, let trial = stage.fruit else { return }
        node.position.y = 153 + CGFloat(sin(clock * 3)) * 4
        if abs(player.position.x - 500) < 66 && abs(player.position.y - 128) < 85 {
            runSave.trial = trial; fruit = trial; energy = store.state.maxEnergy
            node.removeFromParent(); altar = nil; pose([28, 30, 31], duration: 0.4)
            addBurst(at: CGPoint(x: player.position.x, y: player.position.y + 25), fruit: fruit, kind: .transformation)
            toast("\(trial.title)果實試用！打贏本關後永久保留")
            feedback(.heal); persist(); publishHUD()
        }
    }

    private func buildHealing() {
        for (index, x) in [CGFloat(1800), 2800, 3800, 4160, 4670].enumerated() {
            let can = HealingCan(x: x, id: "healing-\(index)", arena: index >= 2)
            if !can.arena && runSave.collected.contains(can.id) { can.readyAt = .infinity; can.node.isHidden = true }
            healing.append(can); addChild(can.node)
        }
        let extra = HealingCan(x: 3800, id: "healing-emergency", arena: true, emergency: true)
        extra.readyAt = .infinity; extra.node.isHidden = true; healing.append(extra); addChild(extra.node)
    }

    @discardableResult private func heal(hearts amount: Int = 2, energy recovered: Double = 20) -> Bool {
        guard (amount > 0 && hearts < store.state.maxHearts) || (recovered > 0 && energy < store.state.maxEnergy) else { return false }
        hearts = min(store.state.maxHearts, hearts + amount); energy = min(store.state.maxEnergy, energy + recovered)
        sparkle(player.position, color: UIColor(hex: 0x95e8b7)); feedback(.heal); publishHUD()
        return true
    }

    private func updateHealing() {
        if boss.active && hearts <= 2 && clock >= emergencyReadyAt, let emergency = healing.first(where: { $0.emergency }), emergency.readyAt == .infinity {
            emergency.node.position.x = min(4740, max(3590, player.position.x - facing * 70))
            emergency.readyAt = clock; emergencyReadyAt = clock + 18; toast("附近出現救急罐頭！")
        }
        for can in healing {
            can.node.isHidden = clock < can.readyAt
            guard !can.node.isHidden else { continue }
            if abs(player.position.x - can.node.position.x) < 48 && abs(player.position.y + 24 - can.node.position.y) < 55, heal() {
                can.readyAt = can.arena && !can.emergency && boss.active ? clock + 12 : .infinity
                can.node.isHidden = true
                if !can.arena { runSave.collected.insert(can.id) }
                toast("愛心罐頭：回復兩顆心＋呼嚕能量"); persist()
            }
        }
    }

    private func resetArenaHealing() {
        emergencyReadyAt = clock
        for can in healing where can.arena {
            can.readyAt = can.emergency ? .infinity : clock; can.node.isHidden = can.emergency
        }
    }

    private func clearHazards() { hazards.forEach { $0.node.removeFromParent() }; hazards.removeAll() }
    private func clearProjectiles() {
        projectiles.forEach { $0.node.removeFromParent() }; projectiles.removeAll()
        combatBursts.forEach { $0.removeFromParent() }; combatBursts.removeAll()
    }

    private func pose(_ frames: [Int], duration: Double) {
        poseFrames = frames; poseStarted = clock; poseUntil = clock + duration
        updatePlayerArt()
    }

    private func addBurst(at point: CGPoint, fruit: Fruit?, kind: ElementalBurst.Kind,
                          direction: CGFloat = 1, strength: CGFloat = 1) {
        // Bound node count even when a piercing shot hits several targets in one frame.
        if combatBursts.count >= 20 { combatBursts.removeFirst().removeFromParent() }
        let burst = ElementalBurst(fruit: fruit, kind: kind, direction: direction,
                                   strength: strength, reducedMotion: store.state.settings.reducedMotion)
        burst.position = point; effectsLayer.addChild(burst); combatBursts.append(burst)
    }

    private func updateBursts(delta: Double) {
        for burst in combatBursts { burst.update(delta: delta) }
        combatBursts.removeAll { burst in
            guard burst.finished else { return false }
            burst.removeFromParent(); return true
        }
    }

    private func updatePlayerArt() {
        let selectedFrame: Int
        if clock < poseUntil && !poseFrames.isEmpty {
            let duration: Double = max(0.01, poseUntil - poseStarted)
            let progress: Double = (clock - poseStarted) / duration
            let frame = min(poseFrames.count - 1, Int(progress * Double(poseFrames.count)))
            selectedFrame = poseFrames[max(0, frame)]
        } else {
            let frame = !grounded ? (velocity.dy > 10 ? 17 : 18) : abs(velocity.dx) > 20 ? 4 + Int(clock * 11) % 6 : Int(clock * 3) % 4
            selectedFrame = frame
        }
        player.texture = GameArt.texture(key: "snowball", frame: selectedFrame)
        appearance.update(fruit: fruit, frame: selectedFrame, elapsed: clock, reducedMotion: store.state.settings.reducedMotion)
        player.xScale = facing; player.alpha = clock < invulnerableUntil ? (Int(clock * 12) % 2 == 0 ? 0.5 : 1) : 1
        aura.isHidden = fruit == nil && shieldUntil <= clock
        aura.strokeColor = Self.color(fruit).withAlphaComponent(shieldUntil > clock ? 0.9 : 0.4)
        chargeRing.isHidden = !charging; chargeRing.strokeColor = fullChargeNotified ? UIColor.white : Self.color(fruit)
        chargeRing.setScale(0.65 + CGFloat(chargeElapsed / ChargeProfile.chargeDuration) * 0.5)
    }

    private func updateCamera(immediate: Bool) {
        guard size.width > 0, size.height > 0 else { return }
        let scale = min(1.8, max(0.85, 520 / size.height))
        followCamera.setScale(scale)
        let halfWidth = size.width * scale / 2
        let x = max(halfWidth, min(world.width - halfWidth, player.position.x + facing * 80))
        let y = min(550, max(200, player.position.y + 80))
        if immediate || store.state.settings.reducedMotion { followCamera.position = CGPoint(x: x, y: y) }
        else {
            followCamera.position.x += (x - followCamera.position.x) * 0.14
            followCamera.position.y += (y - followCamera.position.y) * 0.12
        }
    }

    private func sparkle(_ point: CGPoint, color: UIColor) {
        let count = store.state.settings.reducedMotion ? 2 : 6
        for index in 0..<count {
            let angle = CGFloat(index) * .pi * 2 / CGFloat(count)
            let mote = effectsLayer.disc(CGPoint(x: point.x, y: point.y + 24), radius: 3, color: color)
            let travel = SKAction.moveBy(x: cos(angle) * 24, y: sin(angle) * 24, duration: 0.3)
            mote.run(.sequence([.group([travel, .fadeOut(withDuration: 0.3)]), .removeFromParent()]))
        }
    }

    private func publishHUD() {
        gameDelegate?.gameScene(self, didUpdate: GameHUDState(
            hearts: hearts, maxHearts: store.state.maxHearts, energy: energy, maxEnergy: store.state.maxEnergy,
            fish: collectedCount("fish"), stars: collectedCount("star"), fruit: fruit,
            charging: charging, chargeRatio: chargeElapsed / ChargeProfile.chargeDuration,
            bossName: boss.active ? stage.bossName : nil, bossPhase: boss.phase,
            bossHealthRatio: boss.maxHealth > 0 ? boss.health / boss.maxHealth : 0))
    }

    private func toast(_ text: String) { gameDelegate?.gameScene(self, toast: text) }
    private func feedback(_ event: GameFeedback) {
        audio.play(event, enabled: store.state.settings.sound); gameDelegate?.gameScene(self, feedback: event)
    }
    private func approach(_ value: CGFloat, _ target: CGFloat, amount: CGFloat) -> CGFloat {
        value < target ? min(target, value + amount) : max(target, value - amount)
    }

    static func color(_ fruit: Fruit?) -> UIColor {
        switch fruit {
        case .fire: return UIColor(hex: 0xffa267)
        case .wind: return UIColor(hex: 0x97e3c5)
        case .water: return UIColor(hex: 0x81d7ff)
        case .lightning: return UIColor(hex: 0xffdf79)
        case .earth: return UIColor(hex: 0xd2b184)
        case nil: return UIColor(hex: 0xc1dfff)
        }
    }
}
