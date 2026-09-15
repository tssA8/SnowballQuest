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
        let profile = (4...20).contains(frame) || frame == 28 || frame == 29 || frame >= 40
        let running = (10...15).contains(frame) || frame == 18
        let low = frame == 20 || frame >= 41
        let headX: CGFloat = profile ? (running ? 9 : 6) : 0
        let headY: CGFloat = low ? 22 : running ? 32 : 37
        neck.position = CGPoint(x: headX - (profile ? 6 : 0), y: headY - 13)
        mantle.position = neck.position
        ears.position = CGPoint(x: headX, y: headY + 11)
        tail.position = CGPoint(x: profile ? -21 : -18, y: low ? 12 : 21)
        ears.xScale = profile ? 0.78 : 1
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

        // A colored collar and chest crest stay readable at the actual 64px game scale.
        ElementInk.fill(ElementInk.polygon([(-12,3),(-7,-1),(7,-1),(12,3),(9,-5),(-8,-5)]),
                        on: neck, color: p.main, outline: p.dark, width: 1)
        let crest = ElementInk.glyph(fruit, size: 9, bright: true)
        crest.position = CGPoint(x: 0, y: -6); crest.zPosition = 1; neck.addChild(crest)

        switch fruit {
        case .fire:
            let mane = ElementInk.fill(ElementInk.polygon([(-13,4),(-21,7),(-16,-2),(-24,-2),
                (-17,-8),(-21,-14),(-11,-12),(-8,-18),(1,-12),(8,-14),(15,-4),(12,4)]),
                on: mantle, color: p.main, outline: p.dark, width: 1.3)
            flutter.append(mane)
            addEarPair(.fire, size: 10)
            let flame = ElementInk.glyph(.fire, size: 19, bright: true)
            tail.addChild(flame); flutter.append(flame)
        case .wind:
            let scarf = ElementInk.fill(ElementInk.polygon([(-7,1),(-23,5),(-38,1),(-32,-3),
                (-46,-7),(-28,-9),(-16,-5),(-5,-4)]), on: mantle, color: p.main, outline: p.dark)
            ElementInk.fill(ElementInk.polygon([(-13,-3),(-26,-7),(-37,-7),(-26,-12),(-11,-9)]),
                            on: mantle, color: p.light, outline: p.dark)
            flutter.append(scarf)
            addEarPair(.wind, size: 13)
            let feather = ElementInk.glyph(.wind, size: 17, bright: true)
            feather.zRotation = -0.5; tail.addChild(feather)
        case .water:
            let fin = ElementInk.fill(ElementInk.polygon([(-10,2),(-21,4),(-16,-2),(-25,-8),
                (-14,-7),(-15,-16),(-6,-8),(7,-12),(12,-1)]), on: mantle, color: p.main, outline: p.dark)
            flutter.append(fin); addEarPair(.water, size: 9)
            for side in [CGFloat(-1), CGFloat(1)] {
                let droplet = ElementInk.glyph(.water, size: 16, bright: true)
                droplet.position.x = side * 4; droplet.zRotation = side * 0.6
                tail.addChild(droplet)
            }
        case .lightning:
            let collar = ElementInk.fill(ElementInk.polygon([(-13,3),(-21,0),(-16,-6),(-23,-11),
                (-11,-10),(-6,-16),(3,-10),(13,-11),(11,2)]), on: mantle, color: p.dark, outline: p.main)
            flutter.append(collar); addEarPair(.lightning, size: 13)
            let bolt = ElementInk.glyph(.lightning, size: 20, bright: true)
            bolt.zRotation = -0.4; tail.addChild(bolt)
        case .earth:
            for side in [CGFloat(-1), CGFloat(1)] {
                let shoulder = ElementInk.glyph(.earth, size: 16)
                shoulder.position = CGPoint(x: side * 13, y: -5)
                shoulder.zRotation = side * 0.6; mantle.addChild(shoulder)
            }
            addEarPair(.earth, size: 9)
            let crystal = ElementInk.glyph(.earth, size: 15, bright: true)
            tail.addChild(crystal)
        }
    }

    private func addEarPair(_ fruit: Fruit, size: CGFloat) {
        for side in [CGFloat(-1), CGFloat(1)] {
            let tuft = ElementInk.glyph(fruit, size: size, bright: true)
            tuft.position = CGPoint(x: side * 11, y: 0)
            tuft.zRotation = -side * 0.35
            ears.addChild(tuft); flutter.append(tuft)
        }
    }
}
