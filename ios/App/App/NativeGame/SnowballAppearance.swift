import SpriteKit
import SnowballCore

/// Wearable elemental forms over the approved, recolored Snowball atlas.
/// Faces and coat pixels are never replaced by the older combat sheet.
final class SnowballAppearance: SKNode {
    private(set) var fruit: Fruit?
    private var configured = false
    private let outline = SKSpriteNode()
    private let mantle = SKNode()
    private let neck = SKNode()
    private let ears = SKNode()
    private let tail = SKNode()
    private var flutter: [SKNode] = []

    /// Hand-checked landmarks in the approved 64px atlas, measured up from the feet.
    /// The old head-height heuristic put the collar across the muzzle on side poses.
    private struct Landmarks {
        let neck: CGPoint
        let leftEar: CGPoint
        let rightEar: CGPoint
        let profile: Bool
        init(_ x: CGFloat, _ y: CGFloat, _ lx: CGFloat, _ ly: CGFloat,
             _ rx: CGFloat, _ ry: CGFloat, profile: Bool = true) {
            neck = CGPoint(x: x, y: y)
            leftEar = CGPoint(x: lx, y: ly); rightEar = CGPoint(x: rx, y: ry)
            self.profile = profile
        }
    }
    private static let landmarks: [Landmarks] = [
        .init(0,14,-9,41,10,41,profile:false), .init(0,15,-10,42,10,42,profile:false),
        .init(0,14,-10,38,9,38,profile:false), .init(0,14,-10,38,9,38,profile:false),
        .init(4,16,1,40,10,39), .init(3,12,-1,37,12,36),
        .init(4,15,-3,38,11,38), .init(4,14,-2,38,11,37),
        .init(4,15,-3,37,12,41), .init(3,15,-2,38,12,39),
        .init(5,13,-1,35,12,34), .init(5,13,-1,37,12,36),
        .init(4,18,-2,41,12,42), .init(7,14,3,39,15,38),
        .init(5,15,-1,39,12,39), .init(6,13,2,37,15,37),
        .init(3,14,-3,36,10,40), .init(3,18,-1,40,12,40),
        .init(5,19,0,40,14,43), .init(7,14,2,37,15,35),
        .init(5,5,-2,22,14,24), .init(0,11,-9,37,10,37,profile:false),
        .init(0,13,-9,37,10,37,profile:false), .init(0,14,-10,37,10,38,profile:false),
        .init(0,0,0,0,0,0), .init(0,0,0,0,0,0), .init(0,0,0,0,0,0), .init(0,0,0,0,0,0),
        .init(3,9,-5,32,11,34), .init(3,10,-5,33,12,35),
        .init(0,13,-10,37,10,37,profile:false), .init(0,14,-11,39,10,39,profile:false),
        .init(3,14,-4,36,11,37,profile:false), .init(3,15,-4,38,11,39,profile:false),
        .init(1,13,-6,35,8,36,profile:false), .init(3,15,-4,38,11,39,profile:false),
        .init(0,14,-6,34,10,36,profile:false), .init(0,16,-8,37,11,39,profile:false),
        .init(0,16,-8,37,11,38,profile:false), .init(0,16,-8,37,11,39,profile:false),
        .init(5,7,-3,28,13,30), .init(0,0,0,0,0,0), .init(0,0,0,0,0,0), .init(0,0,0,0,0,0)
    ]

    override init() {
        super.init()
        name = "snowball-appearance"
        outline.anchorPoint = CGPoint(x: 0.5, y: 0)
        outline.size = CGSize(width: 67, height: 66)
        outline.colorBlendFactor = 1; outline.zPosition = -3
        addChild(outline)
        mantle.zPosition = -2; tail.zPosition = -1
        neck.zPosition = 2; ears.zPosition = 2
        [mantle, tail, neck, ears].forEach { addChild($0) }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    func update(fruit: Fruit?, frame: Int, elapsed: Double, reducedMotion: Bool) {
        if !configured || self.fruit != fruit {
            configured = true; self.fruit = fruit; rebuild()
        }
        isHidden = fruit == nil
        guard fruit != nil else { return }
        outline.texture = GameArt.texture(key: "snowball", frame: frame)
        let pose = Self.landmarks[min(max(frame, 0), Self.landmarks.count - 1)]
        // Tucked/rolling poses conceal the neck and ears. Do not leave floating accessories.
        let tucked = (24...27).contains(frame) || frame >= 41
        [neck, mantle, tail].forEach { $0.isHidden = tucked }
        neck.isHidden = tucked || frame == 20
        ears.isHidden = tucked || (36...39).contains(frame) // The victory crown occupies the ears.
        neck.position = pose.neck
        neck.xScale = pose.profile ? 0.72 : 1
        mantle.position = neck.position
        mantle.yScale = min(1, pose.neck.y / 20)
        for (index, tuft) in ears.children.enumerated() {
            tuft.position = index == 0 ? pose.leftEar : pose.rightEar
        }
        tail.position = CGPoint(x: pose.profile ? -18 : -15, y: pose.neck.y + 2)
        let time = reducedMotion ? 0 : elapsed
        for (index, piece) in flutter.enumerated() {
            piece.zRotation = CGFloat(sin(time * 6 + Double(index) * 1.5)) * 0.09
        }
        outline.alpha = reducedMotion ? 0.36 : 0.3 + CGFloat(sin(time * 3)) * 0.06
    }

    private func rebuild() {
        [mantle, neck, ears, tail].forEach { $0.removeAllChildren() }
        flutter.removeAll()
        guard let fruit else { return }
        let p = ElementInk.palette(fruit)
        outline.color = p.main

        // Soft neck band entirely BELOW the chin: no upturned corners across the whiskers.
        let band = CGMutablePath()
        band.move(to: CGPoint(x: -10, y: 0))
        band.addQuadCurve(to: CGPoint(x: 10, y: 0), control: CGPoint(x: 0, y: -3))
        band.addQuadCurve(to: CGPoint(x: 8, y: -3), control: CGPoint(x: 10, y: -2))
        band.addQuadCurve(to: CGPoint(x: -8, y: -3), control: CGPoint(x: 0, y: -5))
        band.addQuadCurve(to: CGPoint(x: -10, y: 0), control: CGPoint(x: -10, y: -2))
        band.closeSubpath()
        ElementInk.fill(band, on: neck, color: p.main, outline: p.dark, width: 0.7)
        let crest = ElementInk.glyph(fruit, size: 6, bright: true)
        crest.position = CGPoint(x: 0, y: -5); crest.zPosition = 1; neck.addChild(crest)

        switch fruit {
        case .fire:
            let mane = ElementInk.fill(ElementInk.polygon([(-13,4),(-21,7),(-16,-2),(-24,-2),
                (-17,-8),(-21,-14),(-11,-12),(-8,-18),(1,-12),(8,-14),(15,-4),(12,4)]),
                on: mantle, color: p.main, outline: p.dark, width: 1.3)
            flutter.append(mane)
            addEarPair(.fire, size: 7)
            let flame = ElementInk.glyph(.fire, size: 19, bright: true)
            tail.addChild(flame); flutter.append(flame)
        case .wind:
            let scarf = ElementInk.fill(ElementInk.polygon([(-7,1),(-23,5),(-38,1),(-32,-3),
                (-46,-7),(-28,-9),(-16,-5),(-5,-4)]), on: mantle, color: p.main, outline: p.dark)
            ElementInk.fill(ElementInk.polygon([(-13,-3),(-26,-7),(-37,-7),(-26,-12),(-11,-9)]),
                            on: mantle, color: p.light, outline: p.dark)
            flutter.append(scarf)
            addEarPair(.wind, size: 8)
            let feather = ElementInk.glyph(.wind, size: 17, bright: true)
            feather.zRotation = -0.5; tail.addChild(feather)
        case .water:
            let fin = ElementInk.fill(ElementInk.polygon([(-10,2),(-21,4),(-16,-2),(-25,-8),
                (-14,-7),(-15,-16),(-6,-8),(7,-12),(12,-1)]), on: mantle, color: p.main, outline: p.dark)
            flutter.append(fin); addEarPair(.water, size: 7)
            for side in [CGFloat(-1), CGFloat(1)] {
                let droplet = ElementInk.glyph(.water, size: 16, bright: true)
                droplet.position.x = side * 4; droplet.zRotation = side * 0.6
                tail.addChild(droplet)
            }
        case .lightning:
            let collar = ElementInk.fill(ElementInk.polygon([(-13,3),(-21,0),(-16,-6),(-23,-11),
                (-11,-10),(-6,-16),(3,-10),(13,-11),(11,2)]), on: mantle, color: p.dark, outline: p.main)
            flutter.append(collar); addEarPair(.lightning, size: 8)
            let bolt = ElementInk.glyph(.lightning, size: 20, bright: true)
            bolt.zRotation = -0.4; tail.addChild(bolt)
        case .earth:
            for side in [CGFloat(-1), CGFloat(1)] {
                let shoulder = ElementInk.glyph(.earth, size: 16)
                shoulder.position = CGPoint(x: side * 13, y: -5)
                shoulder.zRotation = side * 0.6; mantle.addChild(shoulder)
            }
            addEarPair(.earth, size: 7)
            let crystal = ElementInk.glyph(.earth, size: 15, bright: true)
            tail.addChild(crystal)
        }
    }

    private func addEarPair(_ fruit: Fruit, size: CGFloat) {
        for side in [CGFloat(-1), CGFloat(1)] {
            let tuft = ElementInk.glyph(fruit, size: size, bright: true)
            tuft.zRotation = -side * 0.35
            ears.addChild(tuft)
        }
    }
}
