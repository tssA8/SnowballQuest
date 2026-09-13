import SpriteKit
import SnowballCore

struct NativePlatform { var rect: CGRect; var oneWay: Bool; var id: String }
struct NativeCollectible { var id: String; var kind: String; var position: CGPoint }
struct WorldFeature { var kind: String; var position: CGPoint }

/// Tiled coordinates are converted once to SpriteKit's upward-positive space.
final class GameWorld {
    let node = SKNode()
    let stage: StageDefinition
    var platforms: [NativePlatform] = []
    var collectibles: [NativeCollectible] = []
    var checkpoints: [CGPoint] = []
    var features: [WorldFeature] = []
    var width: CGFloat = 4864
    var spawn = CGPoint(x: 160, y: 128)
    private var bubbles: [(SKShapeNode, Int, CGFloat)] = []
    private var cableNodes: [SKShapeNode] = []
    private var rock: SKShapeNode?
    private var clock: Double = 0

    init(stage: StageDefinition) {
        self.stage = stage; loadMap(); buildScenery(); buildPlatforms()
    }
    private func loadMap() {
        guard let url = GameArt.resource("maps/\(stage.id.rawValue).json"),
              let data = try? Data(contentsOf: url),
              let map = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let layers = map["layers"] as? [[String: Any]] else { preconditionFailure("Native stage map is missing") }
        width = CGFloat((map["width"] as? Double ?? 152) * 32)
        for layer in layers {
            guard let name = layer["name"] as? String, let objects = layer["objects"] as? [[String: Any]] else { continue }
            for object in objects {
                let x = object["x"] as? Double ?? 0, y = object["y"] as? Double ?? 0
                let w = object["width"] as? Double ?? 0, h = object["height"] as? Double ?? 0
                let kind = object["type"] as? String ?? "", id = object["name"] as? String ?? ""
                let point = CGPoint(x: x, y: 768 - y)
                var props: [String: Any] = [:]
                for property in object["properties"] as? [[String: Any]] ?? [] {
                    if let key = property["name"] as? String { props[key] = property["value"] }
                }
                switch name {
                case "Collision": platforms.append(NativePlatform(rect: CGRect(x: x, y: 768 - y - h, width: w, height: h), oneWay: props["oneWay"] as? Bool == true, id: id))
                case "Collectibles": collectibles.append(NativeCollectible(id: id, kind: kind, position: CGPoint(x: point.x, y: point.y + 16)))
                case "Checkpoints": checkpoints.append(point)
                case "Spawn": spawn = point
                case "Triggers": features.append(WorldFeature(kind: kind, position: point))
                case "Objects":
                    // The touch edition keeps the optional box reward directly collectible.
                    if kind == "toy-box", let reward = props["reward"] as? String {
                        collectibles.append(NativeCollectible(id: reward, kind: "star",
                                                             position: CGPoint(x: point.x, y: point.y + 56)))
                    }
                default: break
                }
            }
        }
        if stage.id == .home {
            // The web version reaches this nook through a tunnel interaction. A native step
            // makes it reachable with the same jump controls as the rest of the campaign.
            platforms.append(NativePlatform(rect: CGRect(x: 848, y: 288, width: 128, height: 32),
                                            oneWay: true, id: "native-nook-step"))
        }
    }

    private func buildPlatforms() {
        let base = [0x9b7759,0x557887,0x2e5c6c,0x3f4b60,0x79634c,0xbf91b4,0x383c67][stage.index - 1]
        for platform in platforms {
            node.box(platform.rect, color: UIColor(hex: base))
            node.box(CGRect(x: platform.rect.minX, y: platform.rect.maxY - 5, width: platform.rect.width, height: 5), color: UIColor(hex: 0xe4d6ab))
        }
        if stage.id == .foundations {
            platforms.append(NativePlatform(rect: CGRect(x: 2992, y: 384, width: 48, height: 80), oneWay: false, id: "earth-wall"))
            rock = node.box(CGRect(x: 2992, y: 384, width: 48, height: 80), color: UIColor(hex: 0xb9a077), radius: 12)
            node.label("大地共鳴", at: CGPoint(x: 3016, y: 474), size: 14, color: .white)
        }
        if stage.id == .floor13 {
            for (i, feature) in features.filter({ $0.kind == "bubble-lift" }).enumerated() {
                let top = feature.position.y
                let rect = CGRect(x: feature.position.x - 56, y: top - 16, width: 112, height: 16)
                platforms.append(NativePlatform(rect: rect, oneWay: true, id: "bubble-\(i)"))
                let bubble = node.disc(CGPoint(x: feature.position.x, y: top - 28), radius: 55, color: UIColor(hex: 0xbfe8ec, alpha: 0.4))
                bubble.strokeColor = .white; bubble.lineWidth = 3; bubble.yScale = 0.6
                bubbles.append((bubble, platforms.count - 1, top))
            }
        }
    }

    private func buildScenery() {
        let back = SKNode(); back.zPosition = -100; node.addChild(back)
        let colors = [0xf0dfc5,0xc4e2e5,0x213c51,0x202a3d,0x352f38,0xebd8e7,0x171b36]
        back.box(CGRect(x: 0, y: -200, width: width, height: 1100), color: UIColor(hex: colors[stage.index - 1]))
        switch stage.id {
        case .home:
            for x in stride(from: CGFloat(0), to: width, by: 64) {
                back.box(CGRect(x: x, y: 128, width: 2, height: 640), color: UIColor(hex: 0xd3bb9c, alpha: 0.45))
            }
            let props: [(String, CGFloat, CGFloat)] = [("window",440,330),("sofa",840,128),("lamp",650,128),("plant",1240,128),("cat-tree",2040,128),("window",2750,330),("plant",3380,128)]
            for (key, x, y) in props {
                let sprite = GameArt.sprite(key); sprite.position = CGPoint(x: x, y: y); back.addChild(sprite)
            }
            for x in stride(from: CGFloat(3540), to: width, by: 58) {
                back.box(CGRect(x: x, y: 128, width: 7, height: 100), color: UIColor(hex: 0x796b69))
            }
            back.box(CGRect(x: 3520, y: 228, width: width - 3520, height: 8), color: UIColor(hex: 0xa18b7d))
        case .rooftop:
            back.disc(CGPoint(x: 4210, y: 620), radius: 93, color: UIColor(hex: 0xf5d6a7))
            for x in stride(from: CGFloat(0), to: width, by: 280) {
                back.box(CGRect(x: x, y: 128, width: 250, height: 280 + x.truncatingRemainder(dividingBy: 113)), color: UIColor(hex: 0x8fb3c2, alpha: 0.4))
                for y in stride(from: CGFloat(154), to: 390, by: 35) {
                    for dx in stride(from: CGFloat(20), to: 230, by: 40) { back.box(CGRect(x: x + dx, y: y, width: 15, height: 17), color: UIColor(hex: 0xe2efea, alpha: 0.6)) }
                }
            }
            let towers: [CGFloat] = [600,1530,2500,3850,4620]
            for x in towers {
                back.box(CGRect(x: x - 60, y: 128, width: 120, height: 220), color: UIColor(hex: 0x8bafb6), radius: 22)
                back.box(CGRect(x: x - 78, y: 265, width: 156, height: 125), color: UIColor(hex: 0xb2d0d2), radius: 30)
            }
        case .basement:
            for x in stride(from: CGFloat(20), to: width, by: 320) {
                back.box(CGRect(x: x, y: 128, width: 275, height: 500), color: UIColor(hex: 0x2c5464), radius: 20)
                back.box(CGRect(x: x + 115, y: 128, width: 30, height: 505), color: UIColor(hex: 0x648b8b))
            }
            back.box(CGRect(x: 0, y: 556, width: width, height: 22), color: UIColor(hex: 0x638c94))
            for pool in features.filter({ $0.kind == "water-pool" }) {
                back.box(CGRect(x: pool.position.x - 130, y: 128, width: 310, height: 89), color: UIColor(hex: 0x74cde1, alpha: 0.4))
            }
        case .parking:
            for x in stride(from: CGFloat(90), to: width, by: 440) {
                back.box(CGRect(x: x - 70, y: 128, width: 44, height: 540), color: UIColor(hex: 0x48566c))
                back.box(CGRect(x: x, y: 151, width: 250, height: 65), color: UIColor(hex: 0x7a92a5), radius: 22)
                back.box(CGRect(x: x + 43, y: 210, width: 155, height: 47), color: UIColor(hex: 0x526c82), radius: 18)
                back.disc(CGPoint(x: x + 50, y: 152), radius: 23, color: UIColor(hex: 0x172235))
                back.disc(CGPoint(x: x + 202, y: 152), radius: 23, color: UIColor(hex: 0x172235))
            }
            for cable in features.filter({ $0.kind == "electric-cable" }) {
                let visual = node.box(CGRect(x: cable.position.x, y: 128, width: 200, height: 10), color: UIColor(hex: 0xbca56c), radius: 4)
                cableNodes.append(visual)
            }
        case .foundations:
            for x in stride(from: CGFloat(20), to: width, by: 185) {
                back.box(CGRect(x: x, y: 120, width: 65, height: 350 + x.truncatingRemainder(dividingBy: 123)), color: UIColor(hex: 0x665342), radius: 25)
                let crystal = SKShapeNode(path: Self.triangle(x: x + 78, y: 128, height: 85))
                crystal.fillColor = UIColor(hex: 0x94cec1); crystal.strokeColor = UIColor(hex: 0xcde5d6); back.addChild(crystal)
            }
        case .floor13:
            for x in stride(from: CGFloat(40), to: width, by: 340) {
                back.box(CGRect(x: x, y: 349, width: 248, height: 280), color: UIColor(hex: 0xc3adce), radius: 42)
                back.box(CGRect(x: x + 15, y: 364, width: 218, height: 250), color: UIColor(hex: 0xb4d9e0), radius: 32)
                back.box(CGRect(x: x + 117, y: 364, width: 8, height: 250), color: UIColor(hex: 0xf1e4d8))
                back.box(CGRect(x: x + 15, y: 485, width: 218, height: 8), color: UIColor(hex: 0xf1e4d8))
                back.disc(CGPoint(x: x + 90, y: 275), radius: 28, color: UIColor(hex: 0xffffff, alpha: 0.4))
            }
        case .nightark:
            for i in 0..<240 {
                back.disc(CGPoint(x: CGFloat((i * 137 + i * i * 7) % 4864), y: CGFloat(180 + (i * 83) % 550)), radius: i % 5 == 0 ? 3 : 1.5, color: UIColor(hex: 0xd6d8f2, alpha: 0.6))
            }
            let core = back.disc(CGPoint(x: 4220, y: 350), radius: 175, color: UIColor(hex: 0x595780, alpha: 0.25))
            core.strokeColor = UIColor(hex: 0xaca9d5); core.lineWidth = 4
            for i in 0..<5 { let a = CGFloat(i) * .pi * 2 / 5
                back.disc(CGPoint(x: 4220 + cos(a) * 175, y: 350 + sin(a) * 175), radius: 17, color: GameScene.color(Fruit.allCases[i])) }
        }
        let darkStages: [StageID] = [.basement, .parking, .foundations, .nightark]
        let light = darkStages.contains(stage.id)
        back.label(stage.title, at: CGPoint(x: 680, y: 470), size: 25, color: light ? .white : UIColor(hex: 0x605266))
        back.label(stage.bossName, at: CGPoint(x: 4220, y: 470), size: 28, color: light ? .white : UIColor(hex: 0x605266))
        back.label("避開預警 · 集氣反擊 · 罐頭補血", at: CGPoint(x: 4220, y: 433), size: 18, color: light ? UIColor(hex: 0xc0d5e3) : UIColor(hex: 0x65717d))
    }
    private static func triangle(x: CGFloat, y: CGFloat, height: CGFloat) -> CGPath {
        let path = CGMutablePath(); path.move(to: CGPoint(x: x - 25, y: y)); path.addLine(to: CGPoint(x: x, y: y + height)); path.addLine(to: CGPoint(x: x + 25, y: y)); path.closeSubpath(); return path
    }

    func update(delta: Double, player: CGPoint, fruit: Fruit?, grounded: Bool) -> (lift: CGFloat, gravity: CGFloat, electric: Bool, ride: CGFloat) {
        clock += delta
        var result: (CGFloat, CGFloat, Bool, CGFloat) = (0, 900, false, 0)
        for (index, feature) in features.enumerated() {
            let x = feature.position.x
            switch feature.kind {
            case "wind-lift":
                if abs(player.x - x) < 59 && player.y > 152 && player.y < 455 { result.0 = fruit == .wind ? 310 : 245 }
            case "water-pool":
                if player.x > x - 130 && player.x < x + 180 && player.y < 220 { result.1 = fruit == .water ? 340 : 540 }
            case "electric-cable":
                let phase = (clock + Double(index) * 1.7).truncatingRemainder(dividingBy: 6.5)
                if phase >= 5.35 && phase < 6.1 && abs(player.x - x - 100) < 112 && player.y < 176 && fruit != .earth && fruit != .lightning { result.2 = true }
            case "gravity-field": if player.x > x - 96 && player.x < x + 164 { result.1 = 540 }
            default: break
            }
        }
        for (index, cable) in cableNodes.enumerated() {
            let featureIndex = features.indices.filter { features[$0].kind == "electric-cable" }[index]
            let phase = (clock + Double(featureIndex) * 1.7).truncatingRemainder(dividingBy: 6.5)
            cable.fillColor = UIColor(hex: phase >= 5.35 && phase < 6.1 ? 0x9ae3ff : phase >= 4.1 && phase < 5.35 ? 0xffdc76 : 0x746d59)
            cable.lineWidth = phase >= 5.35 && phase < 6.1 ? 6 : 1; cable.strokeColor = cable.fillColor
        }
        if fruit == .earth, let wall = rock, abs(player.x - 3016) < 105 && abs(player.y - 384) < 100 {
            wall.removeFromParent(); rock = nil; platforms.removeAll { $0.id == "earth-wall" }
            // Bubble indices only exist in floor13, so removing this wall cannot invalidate them.
        }
        for (i, entry) in bubbles.enumerated() {
            let old = platforms[entry.1].rect.maxY
            let top = entry.2 + CGFloat(sin((clock + Double(i) * 1.7) / 1.7) + 1) * 82
            platforms[entry.1].rect.origin.y = top - 16; entry.0.position.y = top - 28
            if grounded && abs(player.x - entry.0.position.x) < 62 && abs(player.y - old) < 12 { result.3 = top - old }
        }
        return result
    }
}
