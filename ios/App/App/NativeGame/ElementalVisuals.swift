import SpriteKit
import SnowballCore

/// A shared visual language for forms, travelling attacks and their impact debris.
/// All paths are local game artwork; no particles, textures or timers are allocated per frame.
enum ElementInk {
    struct Palette {
        let dark: UIColor
        let main: UIColor
        let light: UIColor
        let white: UIColor
    }

    static func palette(_ fruit: Fruit?) -> Palette {
        let colors: (Int, Int, Int, Int)
        switch fruit {
        case .fire: colors = (0x9e324b, 0xff693c, 0xffc34b, 0xfff3c4)
        case .wind: colors = (0x287e84, 0x54d9bf, 0xb2ffe1, 0xf3fff4)
        case .water: colors = (0x2354a4, 0x37adf4, 0x8eeeff, 0xebffff)
        case .lightning: colors = (0x7750b4, 0xffbe38, 0xffed86, 0xfffce3)
        case .earth: colors = (0x65513e, 0xba8652, 0x86d6aa, 0xe6ffd4)
        case nil: colors = (0x5751a2, 0x8d9eff, 0xb9eeff, 0xf8f7ff)
        }
        return Palette(dark: UIColor(hex: colors.0), main: UIColor(hex: colors.1),
                       light: UIColor(hex: colors.2), white: UIColor(hex: colors.3))
    }

    static func path(_ points: [CGPoint], closed: Bool = true) -> CGPath {
        let path = CGMutablePath()
        guard let first = points.first else { return path }
        path.move(to: first)
        for point in points.dropFirst() { path.addLine(to: point) }
        if closed { path.closeSubpath() }
        return path
    }

    static func polygon(_ points: [(CGFloat, CGFloat)]) -> CGPath {
        path(points.map { CGPoint(x: $0.0, y: $0.1) })
    }

    @discardableResult static func fill(_ path: CGPath, on parent: SKNode, color: UIColor,
                                       outline: UIColor = .clear, width: CGFloat = 1) -> SKShapeNode {
        let shape = SKShapeNode(path: path)
        shape.fillColor = color; shape.strokeColor = outline; shape.lineWidth = width
        shape.lineJoin = .round
        shape.zPosition = CGFloat(parent.children.count) * 0.01
        parent.addChild(shape)
        return shape
    }

    @discardableResult static func line(_ points: [CGPoint], on parent: SKNode,
                                       color: UIColor, width: CGFloat) -> SKShapeNode {
        let shape = fill(path(points, closed: false), on: parent, color: .clear, outline: color, width: width)
        shape.lineCap = .round
        return shape
    }

    /// Small, recognizable silhouettes. The same glyph is worn and shed by its element.
    static func glyph(_ fruit: Fruit?, size: CGFloat, bright: Bool = false) -> SKNode {
        if let fruit {
            let frame: Int
            switch fruit {
            case .fire: frame = 0
            case .wind: frame = 4
            case .water: frame = 0
            case .lightning: frame = 2
            case .earth: frame = 0
            }
            return effect(fruit, frame: frame, size: CGSize(width: size, height: size))
        }
        let node = SKNode(), p = palette(fruit)
        let path = polygon([(0,10),(3,3),(10,0),(3,-3),(0,-10),(-3,-3),(-10,0),(-3,3)])
        fill(path, on: node, color: bright ? p.light : p.main, outline: p.dark, width: 1.2)
        let gleam = fill(path, on: node, color: p.white.withAlphaComponent(0.85))
        gleam.setScale(0.42); gleam.position = CGPoint(x: -1, y: 1.5)
        node.setScale(size / 20)
        return node
    }

    static func effect(_ fruit: Fruit, frame: Int, size: CGSize) -> SKSpriteNode {
        let sprite = GameArt.sprite("element-\(fruit.rawValue)", frame: frame, size: size)
        sprite.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        return sprite
    }
}

/// Positive X is the leading edge. Mirroring the parent mirrors the entire trail and forks.
/// The simulation owns collision radius and damage; this node is presentation only.
final class ElementalProjectileVisual: SKNode {
    let fruit: Fruit?
    let radius: CGFloat
    let reducedMotion: Bool
    private let art = SKNode()
    private var flowing: [SKNode] = []
    private var motes: [SKNode] = []
    private var bolts: [SKShapeNode] = []
    private var boltPhase = -1
    private(set) var elapsed = 0.0

    init(fruit: Fruit?, radius: CGFloat, power: Double, starburst: Bool = false, reducedMotion: Bool = false) {
        self.fruit = fruit; self.radius = radius; self.reducedMotion = reducedMotion
        super.init()
        name = "projectile-\(fruit?.rawValue ?? "base")"
        addChild(art); art.setScale(radius / 26)
        let p = ElementInk.palette(fruit)
        if let fruit { buildPixelEffect(fruit, palette: p) }
        else { buildStarlight(p) }
        let count = reducedMotion ? 3 : 7
        for index in 0..<count {
            let mote = ElementInk.glyph(fruit, size: CGFloat(5 + index % 3 * 2), bright: index % 2 == 0)
            mote.zPosition = 2; art.addChild(mote); motes.append(mote)
        }
        if power >= 0.85 || starburst {
            // A bright leading edge and a longer wake communicate a fully charged shot.
            let crest = ElementInk.glyph(nil, size: starburst ? 25 : 14, bright: true)
            crest.position = CGPoint(x: 15, y: 0); crest.zPosition = 3; art.addChild(crest)
        }
        update(elapsed: 0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    private func buildPixelEffect(_ fruit: Fruit, palette: ElementInk.Palette) {
        // Source-sheet key artwork with animated layers, not purported extra drawn frames.
        let frames: [Int]
        switch fruit {
        case .fire: frames = [1, 1]
        case .wind: frames = [0, 1]
        case .water: frames = [2, 4]
        case .lightning: frames = [5, 4]; buildLightning(palette)
        case .earth: frames = [4, 0]
        }
        for (index, frame) in frames.enumerated() {
            let sprite = ElementInk.effect(fruit, frame: frame,
                size: CGSize(width: index == 0 ? 98 : 83, height: index == 0 ? 68 : 44))
            sprite.position = CGPoint(x: index == 0 ? -20 : -48, y: fruit == .water && index == 1 ? -10 : 0)
            sprite.zPosition = index == 0 ? 2 : 1
            sprite.alpha = index == 0 ? 1 : 0.8
            art.addChild(sprite); flowing.append(sprite)
        }
    }

    private func buildLightning(_ p: ElementInk.Palette) {
        // Two independently changing branches, each with a gold sheath and white core.
        for _ in 0..<2 {
            bolts.append(ElementInk.line([], on: art, color: p.dark.withAlphaComponent(0.6), width: 12))
            bolts.append(ElementInk.line([], on: art, color: p.main, width: 7))
            bolts.append(ElementInk.line([], on: art, color: p.white, width: 2.5))
        }
        ElementInk.fill(ElementInk.polygon([(26,0),(9,11),(-5,5),(-15,0),(-5,-5),(9,-11)]),
                        on: art, color: p.light, outline: p.main, width: 2)
    }

    private func buildStarlight(_ p: ElementInk.Palette) {
        let edge = ElementInk.polygon([(26,0),(1,19),(-22,11),(-64,16),(-48,2),(-79,0),
                                       (-49,-3),(-59,-15),(-18,-9),(1,-19)])
        flowing.append(ElementInk.fill(edge, on: art, color: p.main, outline: p.dark, width: 2))
        ElementInk.fill(ElementInk.polygon([(26,0),(-4,9),(-51,0),(-4,-9)]), on: art, color: p.white)
        ElementInk.line([CGPoint(x: -64,y: 0),CGPoint(x: 10,y: 0)], on: art, color: p.light, width: 3)
    }

    func update(elapsed: Double) {
        self.elapsed = max(0, elapsed)
        // Keep the tip at the collision edge while the wake grows out of the muzzle.
        // A full-length tail at birth would extend backwards through Snowball.
        let extensionRatio = CGFloat(min(1, self.elapsed / 0.12))
        let stretch: CGFloat = 0.28 + extensionRatio * 0.72
        art.xScale = radius / 26 * stretch
        art.position.x = radius * (1 - stretch)
        let t = reducedMotion ? 0 : self.elapsed
        for (index, node) in flowing.enumerated() {
            node.zRotation = CGFloat(sin(t * 17 + Double(index) * 1.8)) * (fruit == .earth ? 0.18 : 0.045)
        }
        for (index, mote) in motes.enumerated() {
            let phase = (t * 1.7 + Double(index) / Double(motes.count)).truncatingRemainder(dividingBy: 1)
            let side: CGFloat = index % 2 == 0 ? 1 : -1
            mote.position = CGPoint(x: -18 - CGFloat(phase) * 65,
                y: side * (13 + CGFloat(phase) * 10) + CGFloat(sin(t * 10 + Double(index))) * 3)
            mote.alpha = CGFloat(1 - phase) * 0.85
            mote.zRotation = CGFloat(t * 2 + Double(index))
        }
        if fruit == .lightning {
            let phase = Int(t * 12)
            guard phase != boltPhase else { return }; boltPhase = phase
            for branch in 0..<2 {
                let side: CGFloat = branch == 0 ? 1 : -1
                let points = (0..<8).map { index -> CGPoint in
                    let x: CGFloat = 22 - CGFloat(index) * 13
                    let zig = CGFloat(sin(Double(phase * 3 + index * 11 + branch * 7))) * 8
                    return CGPoint(x: x, y: index == 0 ? 0 : side * CGFloat(index) * 1.6 + zig)
                }
                let path = ElementInk.path(points, closed: false)
                for layer in 0..<3 { bolts[branch * 3 + layer].path = path }
            }
        }
    }
}

/// Short bursts run on GameScene's simulation clock, so pausing freezes them too.
final class ElementalBurst: SKNode {
    enum Kind { case transformation, launch, impact, melee }
    let duration: Double
    private(set) var elapsed = 0.0
    private let kind: Kind
    private let reducedMotion: Bool
    private var shards: [SKNode] = []
    private let slash = SKNode()

    init(fruit: Fruit?, kind: Kind, direction: CGFloat = 1, strength: CGFloat = 1, reducedMotion: Bool = false) {
        self.kind = kind; self.reducedMotion = reducedMotion
        duration = kind == .transformation ? 0.65 : kind == .impact ? 0.42 : 0.24
        super.init()
        name = "\(kind)-\(fruit?.rawValue ?? "base")"; xScale = direction * strength; yScale = strength
        let p = ElementInk.palette(fruit)
        let count = reducedMotion ? 4 : kind == .transformation ? 12 : 9
        for index in 0..<count {
            let shard = ElementInk.glyph(fruit, size: CGFloat(7 + index % 3 * 3), bright: index % 3 == 0)
            shards.append(shard); addChild(shard)
        }
        if kind == .melee || kind == .launch {
            if let fruit {
                let frame: Int
                switch fruit {
                case .fire: frame = 2
                case .wind: frame = 0
                case .water: frame = 2
                case .lightning: frame = 5
                case .earth: frame = 5
                }
                slash.addChild(ElementInk.effect(fruit, frame: frame, size: CGSize(width: 76, height: 76)))
            } else {
            let arc = CGMutablePath(); arc.move(to: CGPoint(x: -16, y: 34))
            arc.addQuadCurve(to: CGPoint(x: -17, y: -32), control: CGPoint(x: 48, y: 5))
            arc.addQuadCurve(to: CGPoint(x: -5, y: 26), control: CGPoint(x: 25, y: 4))
            arc.closeSubpath()
            ElementInk.fill(arc, on: slash, color: p.white, outline: p.main, width: 2)
            }
            addChild(slash); slash.zPosition = 1
        } else if kind == .impact, let fruit {
            let frame: Int
            switch fruit {
            case .fire: frame = 3
            case .wind: frame = 5
            case .water: frame = 1
            case .lightning: frame = 6
            case .earth: frame = 5
            }
            slash.addChild(ElementInk.effect(fruit, frame: frame, size: CGSize(width: 85, height: 68)))
            addChild(slash)
        }
        update(delta: 0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    func update(delta: Double) {
        elapsed += max(0, delta)
        let progress = min(1, elapsed / duration)
        let travel = CGFloat(1 - pow(1 - progress, 2))
        for (index, shard) in shards.enumerated() {
            let angle = CGFloat(index) / CGFloat(shards.count) * .pi * 2
            let distance: CGFloat = (kind == .transformation ? 18 : 5) + travel * (reducedMotion ? 16 : 45)
            shard.position = CGPoint(x: cos(angle) * distance, y: sin(angle) * distance)
            shard.zRotation = angle + (reducedMotion ? 0 : travel * 0.8)
            shard.alpha = CGFloat(pow(1 - progress, 0.8))
        }
        slash.zRotation = kind == .impact ? 0 : -0.45 + (reducedMotion ? 0 : travel * 0.8)
        if kind == .impact { slash.setScale(0.6 + travel * 0.8) }
        slash.alpha = CGFloat(1 - progress)
    }

    var finished: Bool { elapsed >= duration }
}
