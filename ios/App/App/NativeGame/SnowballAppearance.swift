import SpriteKit
import SnowballCore

/// Wearable elemental forms over the approved, recolored Snowball atlas.
/// Faces and coat pixels are never replaced by the older combat sheet.
final class SnowballAppearance: SKNode {
    private(set) var fruit: Fruit?
    private var configured = false
    let elementalLayer = SKNode()
    private let neck = SKNode()
    private let ears = SKNode()
    private let tail = SKNode()
    private let paws = SKNode()

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
        neck.name = "mission-collar"; neck.zPosition = 2
        elementalLayer.name = "elemental-overlays"; elementalLayer.zPosition = 3
        addChild(neck); addChild(elementalLayer)
        [ears, tail, paws].forEach { elementalLayer.addChild($0) }
        buildMissionGear()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    func update(fruit: Fruit?, frame: Int, elapsed: Double, reducedMotion: Bool) {
        if !configured || self.fruit != fruit {
            configured = true; self.fruit = fruit; rebuildElement()
        }
        let pose = Self.landmarks[min(max(frame, 0), Self.landmarks.count - 1)]
        let tucked = (24...27).contains(frame) || frame >= 41
        neck.isHidden = tucked || frame == 20
        neck.position = pose.neck; neck.xScale = pose.profile ? 0.72 : 1
        elementalLayer.isHidden = fruit == nil
        ears.isHidden = tucked || (36...39).contains(frame)
        paws.isHidden = tucked
        tail.isHidden = tucked
        for (index, tuft) in ears.children.enumerated() {
            tuft.position = index == 0 ? pose.leftEar : pose.rightEar
        }
        tail.position = CGPoint(x: pose.profile ? -22 : -18, y: pose.neck.y + 2)
        // Effects hug the feet; no colored scarf or face mask replaces mission gear.
        let lifted = (10...19).contains(frame)
        for (index, paw) in paws.children.enumerated() {
            let x: CGFloat = pose.profile ? (index == 0 ? 9 : -10) : (index == 0 ? 7 : -7)
            paw.position = CGPoint(x: x, y: lifted ? (index == 0 ? 10 : 6) : 3)
        }
        let time = reducedMotion ? 0 : elapsed
        tail.zRotation = CGFloat(sin(time * 5)) * 0.14
        for (index, effect) in paws.children.enumerated() {
            effect.alpha = reducedMotion ? 0.85 : 0.8 + CGFloat(sin(time * 8 + Double(index))) * 0.15
        }
    }

    private func buildMissionGear() {
        let band = CGMutablePath()
        band.move(to: CGPoint(x: -10, y: 0))
        band.addQuadCurve(to: CGPoint(x: 10, y: 0), control: CGPoint(x: 0, y: -3))
        band.addQuadCurve(to: CGPoint(x: 8, y: -2), control: CGPoint(x: 10, y: -2))
        band.addQuadCurve(to: CGPoint(x: -8, y: -2), control: CGPoint(x: 0, y: -4))
        band.addQuadCurve(to: CGPoint(x: -10, y: 0), control: CGPoint(x: -10, y: -2))
        band.closeSubpath()
        ElementInk.fill(band, on: neck, color: UIColor(hex: 0x493c48))
        let bell = SKShapeNode(ellipseOf: CGSize(width: 5, height: 5))
        bell.position = CGPoint(x: 0, y: -4); bell.zPosition = 1
        bell.fillColor = UIColor(hex: 0xefbb66); bell.strokeColor = UIColor(hex: 0x8d612d); bell.lineWidth = 0.6
        neck.addChild(bell)
        ElementInk.line([CGPoint(x: -1.3, y: -4.8), CGPoint(x: 1.3, y: -4.8)], on: neck,
                        color: UIColor(hex: 0x493c48), width: 0.65).zPosition = 2
    }

    private func rebuildElement() {
        [ears, tail, paws].forEach { $0.removeAllChildren() }
        guard let fruit else { return }
        let pawFrame: Int, tailFrame: Int
        switch fruit {
        case .fire: pawFrame = 3; tailFrame = 1
        case .wind: pawFrame = 0; tailFrame = 1
        case .water: pawFrame = 1; tailFrame = 0
        case .lightning: pawFrame = 3; tailFrame = 4
        case .earth: pawFrame = 4; tailFrame = 0
        }
        for _ in 0..<2 {
            paws.addChild(ElementInk.effect(fruit, frame: pawFrame, size: CGSize(width: 16, height: 12)))
        }
        let tailEffect = ElementInk.effect(fruit, frame: tailFrame, size: CGSize(width: 21, height: 24))
        if fruit == .fire { tailEffect.zRotation = 0.5 }
        tail.addChild(tailEffect)
        // Small edge accents, embedded in the ear silhouette rather than floating horns.
        if fruit == .lightning || fruit == .wind {
            for _ in 0..<2 { ears.addChild(ElementInk.glyph(fruit, size: 6, bright: true)) }
        }
    }
}
