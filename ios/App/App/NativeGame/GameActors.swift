import SpriteKit
import SnowballCore

final class GameHazard {
    let node: SKShapeNode
    var velocity: CGVector
    let armed: Double
    let expires: Double
    let size: CGSize
    var spent = false
    init(position: CGPoint, velocity: CGVector = .zero, size: CGSize, color: UIColor, now: Double, warning: Double = 0, duration: Double = 2.5) {
        self.velocity = velocity; self.size = size; armed = now + warning; expires = armed + duration
        node = SKShapeNode(rectOf: size, cornerRadius: min(size.width, size.height) / 2)
        node.position = position; node.fillColor = color.withAlphaComponent(0.25)
        node.strokeColor = color; node.lineWidth = 3; node.zPosition = 14
    }
    func update(now: Double, delta: Double) {
        node.alpha = now < armed ? 0.3 + CGFloat((now * 3).truncatingRemainder(dividingBy: 1)) * 0.4 : 1
        if now >= armed {
            node.position.x += velocity.dx * CGFloat(delta); node.position.y += velocity.dy * CGFloat(delta)
        }
    }
    func hits(_ point: CGPoint, now: Double) -> Bool {
        !spent && now >= armed && now < expires && abs(point.x - node.position.x) < size.width / 2 + 14 && abs(point.y + 22 - node.position.y) < size.height / 2 + 20
    }
}

final class GameEnemy {
    enum State { case patrol, warning, attack, recover, defeated }
    let sprite: SKSpriteNode
    let kind: String
    let arena: Bool
    let initialX: CGFloat
    var health: Double
    let maxHealth: Double
    var state: State = .patrol
    var facing: CGFloat = -1
    private var until: Double = 0
    private var attackStart: Double = 0
    private var attackOrigin = CGPoint.zero
    private var attackTarget = CGPoint.zero
    private var contacted = false
    let warning = SKLabelNode(fontNamed: "PingFangTC-Semibold")
    var defeated: Bool { state == .defeated }
    init(kind: String, x: CGFloat, arena: Bool = false) {
        self.kind = kind; self.arena = arena; initialX = x
        maxHealth = ["vacuum":34.0,"mouse":25,"pigeon":24,"slime":28,"beetle":36,"mole":30,"dragon":36,"shadow":32][kind] ?? 30
        health = maxHealth; sprite = GameArt.sprite("enemy-\(kind)"); sprite.position = CGPoint(x: x, y: 128)
        sprite.zPosition = 12; warning.text = "!"; warning.fontSize = 30; warning.fontColor = UIColor(hex: 0xffc676)
        warning.position = CGPoint(x: 0, y: 72); warning.isHidden = true; sprite.addChild(warning)
    }
    @discardableResult func hit(_ damage: Double, direction: CGFloat, now: Double) -> Bool {
        guard !defeated else { return false }
        health = max(0, health - damage)
        if health <= 0 { state = .defeated; sprite.texture = GameArt.texture(key: "enemy-\(kind)", frame: 5); sprite.alpha = 0.65; warning.isHidden = true }
        else { state = .recover; until = now + 0.65; sprite.position.x += direction * 13; sprite.texture = GameArt.texture(key: "enemy-\(kind)", frame: 4) }
        return true
    }
    func update(now: Double, delta: Double, player: CGPoint, fruit: Fruit?, hurt: (CGFloat) -> Void, shoot: (GameHazard) -> Void) {
        guard !defeated else { return }
        warning.isHidden = state != .warning
        let flying = kind == "pigeon" || kind == "dragon"
        let floor: CGFloat = 128
        switch state {
        case .patrol:
            let distance: CGFloat = arena ? 340 : 120
            if sprite.position.x < initialX - distance { facing = 1 }; if sprite.position.x > initialX + distance { facing = -1 }
            let speed: CGFloat = ["mouse":70,"pigeon":65,"slime":30,"beetle":32,"dragon":35,"shadow":62][kind] ?? 42
            sprite.position.x += facing * speed * CGFloat(delta)
            sprite.position.y = floor + (flying ? 54 + sin(CGFloat(now * 2 + Double(initialX))) * 12 : 0)
            sprite.texture = GameArt.texture(key: "enemy-\(kind)", frame: Int(now * 8) % 2 + 1)
            if abs(player.x - sprite.position.x) < (kind == "dragon" ? 340 : 220) && abs(player.y - sprite.position.y) < 125 {
                state = .warning; until = now + (kind == "mouse" ? 0.8 : 1.05); facing = player.x < sprite.position.x ? -1 : 1
                attackTarget = player; attackOrigin = sprite.position; sprite.texture = GameArt.texture(key: "enemy-\(kind)")
            }
        case .warning:
            if now >= until {
                state = .attack; attackStart = now; until = now + 0.7; contacted = false
                if kind == "dragon" || kind == "shadow" {
                    shoot(GameHazard(position: CGPoint(x: sprite.position.x, y: sprite.position.y + 25), velocity: CGVector(dx: facing * 190, dy: -14), size: CGSize(width: 30, height: 30), color: GameScene.color(kind == "shadow" ? fruit : .water), now: now))
                }
            }
        case .attack:
            let progress = min(1, CGFloat((now - attackStart) / 0.7))
            sprite.texture = GameArt.texture(key: "enemy-\(kind)", frame: 3)
            if kind == "pigeon" {
                sprite.position = CGPoint(x: attackOrigin.x + (attackTarget.x - attackOrigin.x) * progress, y: max(floor, attackOrigin.y - progress * 90))
            } else {
                sprite.position.x += facing * (kind == "beetle" ? 175 : 240) * CGFloat(delta)
                sprite.position.y = floor + ((kind == "slime" || kind == "mole") ? sin(progress * .pi) * (kind == "slime" ? 85 : 45) : flying ? 45 : 0)
            }
            if !contacted && abs(sprite.position.x - player.x) < 42 && abs(sprite.position.y - player.y) < 49 { contacted = true; hurt(sprite.position.x) }
            if now >= until { state = .recover; until = now + 1.4; sprite.position.y = floor }
        case .recover: if now >= until { state = .patrol }
        case .defeated: break
        }
        sprite.xScale = facing < 0 ? -1 : 1
    }
}

final class GameBoss {
    enum State { case dormant, intro, warning, attack, recover, exposed, defeated }
    let stage: StageDefinition
    let sprite: SKSpriteNode
    let markers = SKNode()
    let maxHealth: Double
    var health: Double
    var state: State = .dormant
    var phase = 1
    var facing: CGFloat = -1
    var active: Bool { state != .dormant && state != .defeated }
    var defeated: Bool { state == .defeated }
    var warningText: String = ""
    private var until: Double = 0
    private var startTime: Double = 0
    private var action = "charge"
    private var attackCount = 0
    private var target: CGFloat = 4000
    private var origin: CGFloat = 4260
    private var contacted = false
    private var copied: Fruit?
    private var epoch = 0
    var onPhase: (() -> Void)?
    var onDefeated: (() -> Void)?

    init(stage: StageDefinition) {
        self.stage = stage; maxHealth = 660 + Double(max(0, stage.index - 2)) * 30; health = maxHealth
        sprite = GameArt.sprite(stage.bossKey); sprite.position = CGPoint(x: 4260, y: 128)
        let scale: CGFloat = stage.index >= 6 ? 1 : 2
        sprite.setScale(scale); sprite.xScale = -scale; sprite.zPosition = 11; markers.zPosition = 5
    }
    func start(now: Double) { guard state == .dormant else { return }; state = .intro; until = now + 1.8; warningText = "\(stage.bossName)準備迎戰" }
    func reset() {
        epoch += 1; state = .dormant; health = maxHealth; phase = 1; attackCount = 0
        sprite.position = CGPoint(x: 4260, y: 128); sprite.texture = GameArt.texture(key: stage.bossKey)
        markers.removeAllChildren(); warningText = ""
    }
    @discardableResult func hit(_ damage: Double, sourceX: CGFloat, now: Double, piercing: Bool = false) -> Bool {
        guard active && state != .intro else { return false }
        let armored = (stage.id == .home || stage.id == .foundations) && state != .exposed && state != .recover
        health = max(0, health - BossRules.armoredDamage(damage, overheated: state == .exposed, fromBehind: (sourceX - sprite.position.x) * facing < 0, armored: armored, piercing: piercing))
        if health <= 0 {
            epoch += 1; state = .defeated; sprite.position.y = 128
            sprite.texture = GameArt.texture(key: stage.bossKey, frame: 7); markers.removeAllChildren(); onDefeated?()
        } else {
            let next = BossRules.phase(health: health, maxHealth: maxHealth)
            if phase != next { phase = next; recover(now); onPhase?() }
        }
        return true
    }
    private func pattern() -> [String] {
        switch stage.id {
        case .home: return phase == 1 ? ["charge","suction"] : phase == 2 ? ["bombs","summon","charge"] : ["charge","bombs"]
        case .rooftop: return phase == 1 ? ["dive","feathers"] : ["wind","dive","feathers"]
        case .basement: return phase == 1 ? ["jet","bubbles"] : ["roll","bubbles","jet"]
        case .parking: return phase == 1 ? ["charge","lightning"] : ["lightning","charge","charge"]
        case .foundations: return phase == 1 ? ["shockwave","rocks"] : ["rocks","shockwave","roll"]
        case .floor13: return phase == 1 ? ["bubbles","tail"] : ["summon","tail","bubbles"]
        case .nightark: return phase == 1 ? ["copy","gravity"] : ["gravity","copy","lightning"]
        }
    }
    private func recover(_ now: Double) {
        epoch += 1; state = phase == 3 ? .exposed : .recover; until = now + (phase == 3 ? 3.8 : 2.6)
        sprite.position.y = 128; markers.removeAllChildren()
        sprite.texture = GameArt.texture(key: stage.bossKey, frame: phase == 3 ? 6 : 0)
        warningText = phase == 3 ? "核心露出！集氣反擊" : "破綻出現 · 趁現在反擊"
    }
    private func warn(_ now: Double, player: CGPoint, fruit: Fruit?) {
        let choices = pattern(); action = choices[attackCount % choices.count]; attackCount += 1
        target = min(4760, max(3620, player.x)); origin = sprite.position.x; facing = player.x < origin ? -1 : 1
        state = .warning; until = now + 1.25; copied = fruit; markers.removeAllChildren()
        sprite.position.y = 128; sprite.texture = GameArt.texture(key: stage.bossKey, frame: 2)
        let hints = ["charge":"衝刺預警 · 跳起或閃避", "suction":"吸力啟動 · 離開風圈", "bombs":"螺絲炸彈 · 離開圓圈", "summon":"小幫手來了 · 先處理小怪", "dive":"俯衝預警 · 跳起或閃避", "feathers":"羽毛散射 · 留意上下兩路", "wind":"旋風將起 · 離開風圈", "jet":"水柱預警 · 繞到背後", "bubbles":"泡泡來了 · 跳過低處泡泡", "roll":"滾動預警 · 跳起或閃避", "lightning":"落雷預警 · 離開直線", "shockwave":"大地震波 · 起跳避開", "rocks":"落石預警 · 離開圓圈", "tail":"龍尾橫掃 · 起跳或退後", "copy":"夜墨模仿元素 · 留意波紋", "gravity":"重力漩渦 · 離開紫色圈"]
        warningText = hints[action] ?? "準備閃避"
        switch action {
        case "bombs","rocks","lightning":
            for offset in [-180,0,180] { let x = min(4750, max(3600, target + CGFloat(offset)))
                markers.box(CGRect(x: x - 30, y: 128, width: 60, height: action == "lightning" ? 240 : 12), color: UIColor(hex: 0xffc777, alpha: 0.4), radius: 6) }
        case "wind","gravity","suction": markers.box(CGRect(x: target - 115, y: 128, width: 230, height: 90), color: UIColor(hex: 0xc3a0ed, alpha: 0.35), radius: 40)
        case "jet","tail": markers.box(CGRect(x: origin + (facing < 0 ? -360 : 50), y: 128, width: 310, height: 52), color: UIColor(hex: 0xffb68e, alpha: 0.3), radius: 10)
        default: markers.box(CGRect(x: min(origin,target), y: 128, width: max(90,abs(origin - target)), height: 10), color: UIColor(hex: 0xffbd88, alpha: 0.4), radius: 4)
        }
    }

    func update(now: Double, delta: Double, player: CGPoint, fruit: Fruit?, hurt: (CGFloat) -> Void, shoot: (GameHazard) -> Void, summon: (CGFloat) -> Void) {
        let generation = epoch
        switch state {
        case .dormant,.defeated: return
        case .intro,.recover,.exposed: if now >= until { warn(now, player: player, fruit: fruit) }
        case .warning:
            if now >= until {
                state = .attack; startTime = now; until = now + 1.65; contacted = false
                sprite.texture = GameArt.texture(key: stage.bossKey, frame: 3); warningText = ""
                let color = GameScene.color(stage.id == .nightark ? copied : stage.fruit)
                func projectile(_ x: CGFloat, _ y: CGFloat, _ vx: CGFloat, _ vy: CGFloat = 0, _ w: CGFloat = 34, _ h: CGFloat = 34, _ lifetime: Double = 2.2) {
                    shoot(GameHazard(position: CGPoint(x: x, y: y), velocity: CGVector(dx: vx, dy: vy), size: CGSize(width: w, height: h), color: color, now: now, duration: lifetime))
                }
                switch action {
                case "charge","roll","dive": until = now + 1.2
                case "feathers","bubbles": for i in 0..<3 { projectile(origin + facing * 80, 159 + CGFloat(i) * 53, facing * CGFloat(185 + i * 15), CGFloat(i - 1) * 16) }
                case "bombs","rocks","lightning":
                    for offset in [-180,0,180] { let x = min(4750,max(3600,target + CGFloat(offset)))
                        if action == "lightning" { projectile(x, 245, 0, 0, 55, 235, 0.6) }
                        else if action == "rocks" { projectile(x, 420, 0, -260, 43, 43, 1.4) }
                        else { projectile(x, 149, 0, 0, 108, 42, 0.45) }
                    }
                case "shockwave": projectile(origin,149,-225,0,44,36); projectile(origin,149,225,0,44,36)
                case "jet","tail": projectile(origin + facing * 200,156,0,0,310,52,0.8)
                case "summon": summon(min(4750,max(3600,origin - facing * 150)))
                case "wind","gravity","suction": projectile(target,163,0,0,205,70,1.2)
                case "copy":
                    switch copied {
                    case .earth: projectile(origin,147,-230,0,54,36); projectile(origin,147,230,0,54,36)
                    case .lightning: shoot(GameHazard(position: CGPoint(x: target,y:245),size:CGSize(width:58,height:235),color:color,now:now,warning:1.1,duration:0.5))
                    case .wind: for i in 0..<3 { projectile(origin,160 + CGFloat(i)*56,facing*230) }
                    case .water: for i in 0..<2 { projectile(origin,160 + CGFloat(i)*85,facing*170,-10,48,48) }
                    default: projectile(origin,160,facing*245,0,55,55)
                    }
                default: break
                }
            }
        case .attack:
            if ["charge","roll","dive"].contains(action) {
                let t = min(1,CGFloat((now - startTime) / 1.2))
                sprite.position.x = origin + (target - origin) * t
                sprite.position.y = action == "dive" ? 128 + sin(t * .pi) * 110 : 128
                if !contacted && abs(player.x - sprite.position.x) < 90 && abs(player.y - sprite.position.y) < 75 {
                    contacted = true; hurt(sprite.position.x); if generation != epoch { return }
                }
            }
            if now >= until { recover(now) }
        }
        sprite.xScale = (stage.index >= 6 ? 1 : 2) * facing
    }
}
