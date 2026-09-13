import UIKit
import SpriteKit

/// All art is local PNG data. No HTML, JavaScript, network or WebView is used.
enum GameArt {
    private static var images: [String: UIImage] = [:]
    private static var textures: [String: SKTexture] = [:]
    private static var sheets: [String: UIImage] = [:]
    private static var paths: [String: String] = [:]
    private static var frames: [String: Int] = [:]
    private static var prepared = false

    static func resource(_ path: String) -> URL? {
        Bundle.main.resourceURL?.appendingPathComponent("GameAssets").appendingPathComponent(path)
    }
    private static func prepare() {
        guard !prepared else { return }; prepared = true
        for (file, list) in [("manifest.json", "textures"), ("adventure/manifest.json", "assets")] {
            guard let url = resource(file), let bytes = try? Data(contentsOf: url),
                  let object = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
                  let assets = object[list] as? [[String: Any]] else { continue }
            for asset in assets {
                guard let key = asset["key"] as? String else { continue }
                paths[key] = asset["path"] as? String ?? "adventure/\(key).png"
                if let cell = asset["frameSize"] as? Int { frames[key] = cell }
            }
        }
        frames["snowball"] = 64
    }
    static func image(key: String, frame: Int = 0) -> UIImage? {
        prepare()
        let cacheKey = "\(key):\(frame)"
        if let image = images[cacheKey] { return image }
        guard frame >= 0, let path = paths[key], let url = resource(path) else { return nil }
        let original: UIImage
        if let sheet = sheets[key] {
            original = sheet
        } else {
            guard let sheet = UIImage(contentsOfFile: url.path) else { return nil }
            sheets[key] = sheet
            original = sheet
        }
        let result: UIImage
        if let cell = frames[key] {
            guard cell > 0, let cg = original.cgImage, cg.height >= cell,
                  frame < cg.width / cell,
                  let crop = cg.cropping(to: CGRect(x: CGFloat(frame * cell), y: 0,
                                                    width: CGFloat(cell), height: CGFloat(cell))) else { return nil }
            result = UIImage(cgImage: crop)
        } else {
            guard frame == 0 else { return nil }
            result = original
        }
        images[cacheKey] = result
        return result
    }
    static func texture(key: String, frame: Int = 0) -> SKTexture {
        let cacheKey = "\(key):\(frame)"
        if let texture = textures[cacheKey] { return texture }
        guard let image = image(key: key, frame: frame) else {
            assertionFailure("Missing native game art: \(cacheKey)")
            return SKTexture()
        }
        let texture = SKTexture(image: image); texture.filteringMode = .nearest
        textures[cacheKey] = texture; return texture
    }
    static func sprite(_ key: String, frame: Int = 0, size: CGSize? = nil) -> SKSpriteNode {
        let texture = texture(key: key, frame: frame)
        let node = SKSpriteNode(texture: texture, size: size ?? texture.size())
        node.anchorPoint = CGPoint(x: 0.5, y: 0)
        return node
    }
}

extension UIColor {
    convenience init(hex: Int, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255,
                  blue: CGFloat(hex & 255) / 255, alpha: alpha)
    }
}

extension SKNode {
    @discardableResult func box(_ rect: CGRect, color: UIColor, radius: CGFloat = 0) -> SKShapeNode {
        let node = SKShapeNode(rect: rect, cornerRadius: radius)
        node.fillColor = color; node.strokeColor = .clear; addChild(node); return node
    }
    @discardableResult func disc(_ center: CGPoint, radius: CGFloat, color: UIColor) -> SKShapeNode {
        let node = SKShapeNode(circleOfRadius: radius); node.position = center
        node.fillColor = color; node.strokeColor = .clear; addChild(node); return node
    }
    @discardableResult func label(_ text: String, at position: CGPoint, size: CGFloat = 20, color: UIColor = UIColor(hex: 0x594962)) -> SKLabelNode {
        let node = SKLabelNode(fontNamed: "PingFangTC-Medium"); node.text = text; node.fontSize = size
        node.fontColor = color; node.position = position; addChild(node); return node
    }
}
