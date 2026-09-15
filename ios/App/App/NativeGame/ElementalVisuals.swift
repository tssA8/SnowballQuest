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
        let node = SKNode(), p = palette(fruit)
        let path: CGPath
        switch fruit {
        case .fire:
            path = polygon([(-5,-6),(-7,0),(-3,5),(-2,1),(2,10),(4,3),(7,-1),(5,-6),(0,-8)])
        case .wind:
            path = polygon([(-7,-4),(-3,3),(8,7),(4,-2),(-3,-6)])
        case .water:
            let drop = CGMutablePath(); drop.move(to: CGPoint(x: 0, y: 10))
            drop.addCurve(to: CGPoint(x: 0, y: -8), control1: CGPoint(x: 2, y: 4), control2: CGPoint(x: 13, y: -7))
            drop.addCurve(to: CGPoint(x: 0, y: 10), control1: CGPoint(x: -13, y: -7), control2: CGPoint(x: -2, y: 4))
            drop.closeSubpath(); path = drop
        case .lightning:
            path = polygon([(1,11),(-7,0),(-1,0),(-3,-10),(8,3),(2,3)])
        case .earth:
            path = polygon([(0,10),(7,2),(5,-7),(-5,-7),(-7,2)])
        case nil:
            path = polygon([(0,10),(3,3),(10,0),(3,-3),(0,-10),(-3,-3),(-10,0),(-3,3)])
        }
        fill(path, on: node, color: bright ? p.light : p.main, outline: p.dark, width: 1.2)
        let gleam = fill(path, on: node, color: p.white.withAlphaComponent(0.85))
        gleam.setScale(0.42); gleam.position = CGPoint(x: -1, y: 1.5)
        node.setScale(size / 20)
        return node
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
        switch fruit {
        case .fire: buildFire(p)
        case .wind: buildWind(p)
        case .water: buildWater(p)
        case .lightning: buildLightning(p)
        case .earth: buildEarth(p)
        case nil: buildStarlight(p)
        }
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

    private func buildFire(_ p: ElementInk.Palette) {
        let silhouette = ElementInk.polygon([(26,0),(17,15),(4,22),(-10,15),(-27,28),(-21,12),
            (-48,15),(-38,5),(-75,1),(-51,-8),(-59,-20),(-31,-13),(-17,-25),(1,-19),(18,-12)])
        let shell = ElementInk.fill(silhouette, on: art, color: p.main, outline: p.dark, width: 2)
        flowing.append(shell)
        let middle = ElementInk.fill(ElementInk.polygon([(22,0),(9,13),(-8,10),(-28,17),(-19,3),
            (-53,0),(-30,-6),(-34,-12),(-8,-9),(6,-13)]), on: art, color: p.light)
        flowing.append(middle)
        let core = ElementInk.fill(ElementInk.polygon([(23,0),(8,7),(-15,4),(-33,0),(-12,-5),(6,-7)]),
                                   on: art, color: p.white)
        core.zPosition = 1
    }

    private func buildWind(_ p: ElementInk.Palette) {
        for index in 0..<3 {
            let ribbon = CGMutablePath()
            ribbon.move(to: CGPoint(x: 25, y: 0))
            ribbon.addCurve(to: CGPoint(x: -58, y: 13), control1: CGPoint(x: 6, y: 39), control2: CGPoint(x: -42, y: 36))
            ribbon.addCurve(to: CGPoint(x: 15, y: 5), control1: CGPoint(x: -25, y: 29), control2: CGPoint(x: 4, y: 22))
            ribbon.addCurve(to: CGPoint(x: -67, y: -12), control1: CGPoint(x: -1, y: -12), control2: CGPoint(x: -43, y: -19))
            ribbon.addCurve(to: CGPoint(x: 25, y: 0), control1: CGPoint(x: -29, y: -28), control2: CGPoint(x: 10, y: -22))
            ribbon.closeSubpath()
            let band = ElementInk.fill(ribbon, on: art, color: index == 1 ? p.white : p.main,
                                       outline: index == 1 ? p.light : p.dark, width: 1)
            band.setScale(1 - CGFloat(index) * 0.22)
            band.yScale *= index == 2 ? -1 : 1
            band.position.x = -CGFloat(index) * 13
            flowing.append(band)
        }
    }

    private func buildWater(_ p: ElementInk.Palette) {
        let wave = CGMutablePath(); wave.move(to: CGPoint(x: 23, y: -2))
        wave.addCurve(to: CGPoint(x: -5, y: 26), control1: CGPoint(x: 25, y: 23), control2: CGPoint(x: 5, y: 32))
        wave.addCurve(to: CGPoint(x: -1, y: 7), control1: CGPoint(x: -28, y: 20), control2: CGPoint(x: -17, y: 2))
        wave.addCurve(to: CGPoint(x: -62, y: 7), control1: CGPoint(x: -10, y: 20), control2: CGPoint(x: -36, y: 8))
        wave.addCurve(to: CGPoint(x: -67, y: -17), control1: CGPoint(x: -31, y: 5), control2: CGPoint(x: -30, y: -12))
        wave.addCurve(to: CGPoint(x: 23, y: -2), control1: CGPoint(x: -17, y: -29), control2: CGPoint(x: 13, y: -20))
        wave.closeSubpath()
        flowing.append(ElementInk.fill(wave, on: art, color: p.main, outline: p.dark, width: 2))
        let foam = CGMutablePath(); foam.move(to: CGPoint(x: -50, y: -12))
        foam.addCurve(to: CGPoint(x: 19, y: 1), control1: CGPoint(x: -16, y: -19), control2: CGPoint(x: 18, y: -10))
        foam.addCurve(to: CGPoint(x: -7, y: 17), control1: CGPoint(x: 19, y: 27), control2: CGPoint(x: -16, y: 30))
        let edge = ElementInk.fill(foam, on: art, color: .clear, outline: p.white, width: 4)
        flowing.append(edge)
        ElementInk.line([CGPoint(x: -49, y: -5),CGPoint(x: -18, y: -10),CGPoint(x: 5, y: -4)], on: art, color: p.light, width: 3)
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

    private func buildEarth(_ p: ElementInk.Palette) {
        for index in 0..<3 {
            let rock = SKNode(); art.addChild(rock); rock.zPosition = CGFloat(index) * 0.1
            let body = ElementInk.polygon([(24,0),(10,18),(-12,16),(-25,0),(-11,-18),(11,-14)])
            ElementInk.fill(body, on: rock, color: p.main, outline: p.dark, width: 2)
            ElementInk.fill(ElementInk.polygon([(24,0),(10,18),(-4,4),(10,-6)]), on: rock, color: p.light)
            ElementInk.fill(ElementInk.polygon([(-12,16),(-4,4),(10,18)]), on: rock, color: p.white)
            ElementInk.fill(ElementInk.polygon([(-25,0),(-11,-18),(10,-6),(-4,4)]), on: rock, color: p.dark)
            rock.position = CGPoint(x: -CGFloat(index) * 25, y: index == 1 ? 12 : -CGFloat(index) * 5)
            rock.setScale(1 - CGFloat(index) * 0.23); flowing.append(rock)
        }
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
            let arc = CGMutablePath(); arc.move(to: CGPoint(x: -16, y: 34))
            arc.addQuadCurve(to: CGPoint(x: -17, y: -32), control: CGPoint(x: 48, y: 5))
            arc.addQuadCurve(to: CGPoint(x: -5, y: 26), control: CGPoint(x: 25, y: 4))
            arc.closeSubpath()
            ElementInk.fill(arc, on: slash, color: p.white, outline: p.main, width: 2)
            addChild(slash); slash.zPosition = 1
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
        slash.zRotation = -0.45 + (reducedMotion ? 0 : travel * 0.8)
        slash.alpha = CGFloat(1 - progress)
    }

    var finished: Bool { elapsed >= duration }
}
