import XCTest
import SpriteKit
import SnowballCore
@testable import App

@MainActor
final class ElementalArtTests: XCTestCase {
    private func withGame(_ stageID: StageID = .nightark, body: (GameScene, NativeSaveStore) throws -> Void) rethrows {
        let suite = "snowball-element-tests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = NativeSaveStore(defaults: defaults)
        for stage in StageDefinition.all {
            if stage.id == stageID { break }
            store.complete(stage.id)
        }
        XCTAssertTrue(store.startStage(stageID))
        store.updateSettings(NativeSettings(music: false, sound: false, haptics: false))
        let scene = GameScene(stage: .find(stageID), store: store)
        scene.resumeGame(); advance(scene, frames: 2)
        defer { scene.pauseGame() }
        try body(scene, store)
    }

    private func advance(_ scene: GameScene, frames: Int) {
        for _ in 0..<frames { scene.advance(delta: 1.0 / 60) }
    }

    private func render(_ node: SKNode, crop: CGRect, view: SKView) throws -> UIImage {
        // A live player's world transform otherwise moves it outside this small crop.
        // Detach only during the synchronous snapshot, then restore the real scene.
        let parent = node.parent, position = node.position
        node.removeFromParent(); node.position = .zero
        defer {
            node.position = position
            parent?.addChild(node)
        }
        let texture = try XCTUnwrap(view.texture(from: node, crop: crop), "SpriteKit must actually render the artwork")
        let image = texture.cgImage()
        let pixels = try XCTUnwrap(image.dataProvider?.data) as Data
        var samples = Set<UInt8>()
        for index in stride(from: 0, to: pixels.count, by: max(1, pixels.count / 1021)) { samples.insert(pixels[index]) }
        XCTAssertGreaterThan(samples.count, 8, "A blank or flat-color snapshot is not valid visual evidence")
        return UIImage(cgImage: image)
    }

    func testCollectingEachFruitImmediatelyChangesSnowballsRenderedAppearance() throws {
        let view = SKView(frame: CGRect(x: 0, y: 0, width: 240, height: 180))
        for stage in StageDefinition.all where stage.fruit != nil {
            try withGame(stage.id) { scene, store in
                let crop = CGRect(x: -55, y: -4, width: 110, height: 84)
                scene.player.texture = GameArt.texture(key: "snowball", frame: 0)
                scene.appearance.update(fruit: nil, frame: 0, elapsed: 0, reducedMotion: true)
                let before = try render(scene.player, crop: crop, view: view).pngData()
                scene.player.position = CGPoint(x: 500, y: 128)
                advance(scene, frames: 1)
                XCTAssertEqual(scene.fruit, stage.fruit)
                XCTAssertEqual(scene.appearance.fruit, stage.fruit)
                XCTAssertFalse(scene.appearance.elementalLayer.isHidden)
                XCTAssertEqual(store.state.run.trial, stage.fruit)
                // Compare the SAME atlas frame with and without the real wearable form.
                scene.player.texture = GameArt.texture(key: "snowball", frame: 0)
                scene.appearance.update(fruit: scene.fruit, frame: 0, elapsed: 0, reducedMotion: true)
                let after = try render(scene.player, crop: crop, view: view).pngData()
                XCTAssertNotEqual(before, after, "Picking up \(stage.fruit!) must visibly change Snowball")
            }
        }
    }

    func testAllEquippedFormsAreVisuallyDistinctAndCyclingBackRemovesTheCostume() throws {
        try withGame { scene, _ in
            let view = SKView(frame: CGRect(x: 0, y: 0, width: 240, height: 180))
            var pictures = Set<Data>()
            var originalFace: Data?
            var missionGear: Data?
            for expected in [nil] + Fruit.allCases.map({ Optional($0) }) {
                XCTAssertEqual(scene.fruit, expected)
                XCTAssertEqual(scene.appearance.fruit, expected)
                scene.player.texture = GameArt.texture(key: "snowball", frame: 0)
                scene.appearance.update(fruit: expected, frame: 0, elapsed: 0, reducedMotion: true)
                let picture = try render(scene.player, crop: CGRect(x: -55, y: -4, width: 110, height: 84), view: view)
                pictures.insert(try XCTUnwrap(picture.pngData()))
                let face = try render(scene.player, crop: CGRect(x: -7, y: 20, width: 14, height: 12), view: view).pngData()
                if expected == nil { originalFace = face }
                else { XCTAssertEqual(face, originalFace, "Elemental costumes must leave Snowball's eyes and muzzle unobscured") }
                let collar = try XCTUnwrap(scene.appearance.childNode(withName: "mission-collar"))
                let gear = try render(collar, crop: CGRect(x: -12, y: -9, width: 24, height: 12), view: view).pngData()
                if expected == nil { missionGear = gear }
                else { XCTAssertEqual(gear, missionGear, "The dark mission collar and gold bell must never change with element") }
                scene.cycleFruit()
            }
            XCTAssertEqual(pictures.count, 6, "Forms must have distinct pixels, not only different HUD labels")
            XCTAssertNil(scene.fruit)
            XCTAssertTrue(scene.appearance.elementalLayer.isHidden)
            XCTAssertFalse(scene.appearance.isHidden, "Base form still wears the mission collar")
        }
    }

    func testAttackDashCastAndHurtAlwaysUseTheApprovedCoatAtlasAndKeepTheEquippedForm() {
        withGame { scene, _ in
            let approved = (0..<44).map { GameArt.texture(key: "snowball", frame: $0) }
            scene.cycleFruit(); scene.cycleFruit() // Wind
            for action in [scene.attack, scene.dash, { scene.setCharge(true) }, { scene.setCharge(false) },
                           { scene.receiveDamage(from: scene.player.position.x + 100) }] {
                action()
                for _ in 0..<24 {
                    advance(scene, frames: 1)
                    XCTAssertTrue(approved.contains { $0 === scene.player.texture }, "An animation must never swap in a different cat")
                    XCTAssertEqual(scene.appearance.fruit, .wind)
                    XCTAssertFalse(scene.appearance.elementalLayer.isHidden)
                }
            }
        }
    }

    func testTravellingEffectsMirrorFreezeOnPauseAndAreRemovedWhenSpent() {
        withGame { scene, _ in
            scene.cycleFruit() // Fire
            scene.setMovement(-1); advance(scene, frames: 1); scene.setMovement(0)
            scene.setCharge(true); advance(scene, frames: 75); scene.setCharge(false)
            let shots = scene.children.compactMap { $0 as? ElementalProjectileVisual }
            XCTAssertEqual(shots.count, 1)
            guard let shot = shots.first else { return }
            XCTAssertEqual(shot.fruit, .fire)
            XCTAssertEqual(shot.xScale, -1)
            let start = shot.position.x
            advance(scene, frames: 2)
            XCTAssertLessThan(shot.position.x, start)
            scene.pauseGame()
            let position = shot.position, elapsed = shot.elapsed
            advance(scene, frames: 120)
            XCTAssertEqual(shot.position, position)
            XCTAssertEqual(shot.elapsed, elapsed)
            scene.resumeGame(); advance(scene, frames: 150)
            XCTAssertNil(shot.parent)
            XCTAssertTrue(scene.children.compactMap { $0 as? ElementalProjectileVisual }.isEmpty)
        }
    }

    func testEveryArtPackEffectIsBundledWithTheExpectedCellAndTransparentMargin() throws {
        for fruit in Fruit.allCases {
            let count = fruit == .lightning ? 8 : 6
            for frame in 0..<count {
                let image = try XCTUnwrap(GameArt.image(key: "element-\(fruit.rawValue)", frame: frame))
                XCTAssertEqual(image.size, CGSize(width: 128, height: 128))
                let cg = try XCTUnwrap(image.cgImage)
                XCTAssertNotEqual(cg.alphaInfo, .none)
                XCTAssertEqual(GameArt.texture(key: "element-\(fruit.rawValue)", frame: frame).filteringMode, .nearest)
            }
            XCTAssertNil(GameArt.image(key: "element-\(fruit.rawValue)", frame: count))
        }
    }

    func testRenderElementalAnimationFramesForVisualReview() throws {
        let size = CGSize(width: 1320, height: 1040)
        let view = SKView(frame: CGRect(origin: .zero, size: size))
        let forms: [Fruit?] = [nil, .fire, .wind, .water, .lightning, .earth]
        for frame in 0..<12 {
            let time = Double(frame) / 16
            let page = SKScene(size: size)
            page.backgroundColor = UIColor(hex: 0x11182a)
            page.label("SNOWBALL  /  ELEMENTAL ARTS", at: CGPoint(x: 660, y: 994), size: 25, color: .white)
            page.label("FORM         SAME-COAT ATTACK                QUICK SHOT               FULL CHARGE                   IMPACT",
                       at: CGPoint(x: 660, y: 952), size: 15, color: UIColor(hex: 0xaec1d9))
            for (row, fruit) in forms.enumerated() {
                let y = CGFloat(820 - row * 150)
                let panel = page.box(CGRect(x: 20, y: y - 14, width: 1280, height: 138), color: UIColor(hex: row % 2 == 0 ? 0x202b41 : 0x182238), radius: 12)
                panel.zPosition = -10
                page.label((fruit?.rawValue ?? "base").uppercased(), at: CGPoint(x: 89, y: y + 99), size: 13,
                           color: ElementInk.palette(fruit).light)
                let attackFrames = [28, 16, 18, 29]
                for (column, pose) in [frame % 4, attackFrames[(frame / 2) % 4]].enumerated() {
                    let cat = GameArt.sprite("snowball", frame: pose)
                    let form = SnowballAppearance(); cat.addChild(form)
                    form.update(fruit: fruit, frame: pose, elapsed: time, reducedMotion: false)
                    cat.position = CGPoint(x: CGFloat(115 + column * 205), y: y + 2)
                    cat.setScale(1.8); page.addChild(cat)
                }
                for (column, power) in [0.2, 1.0].enumerated() {
                    let radius: CGFloat = 13 + CGFloat(power) * 20
                    let shot = ElementalProjectileVisual(fruit: fruit, radius: radius, power: power)
                    shot.position = CGPoint(x: CGFloat(574 + column * 296) + CGFloat(time * 85), y: y + 47)
                    shot.update(elapsed: time); page.addChild(shot)
                }
                let impact = ElementalBurst(fruit: fruit, kind: .impact)
                impact.position = CGPoint(x: 1200, y: y + 49)
                impact.update(delta: time.truncatingRemainder(dividingBy: 0.42)); page.addChild(impact)
            }
            let image = try render(page, crop: CGRect(origin: .zero, size: size), view: view)
            let attachment = XCTAttachment(image: image)
            attachment.name = String(format: "Elemental animation %02d", frame)
            attachment.lifetime = .keepAlways; add(attachment)
        }

        // Inspect every anchor, including low landings, side attacks and concealed rolling poses.
        let poses = SKScene(size: CGSize(width: 1280, height: 1056))
        poses.backgroundColor = UIColor(hex: 0x182238)
        for frame in 0..<44 {
            let x = CGFloat(frame % 8) * 160 + 80
            let y = CGFloat(5 - frame / 8) * 176 + 18
            let cat = GameArt.sprite("snowball", frame: frame)
            let form = SnowballAppearance(); cat.addChild(form)
            form.update(fruit: .wind, frame: frame, elapsed: 0, reducedMotion: true)
            cat.position = CGPoint(x: x, y: y); cat.setScale(2.2); poses.addChild(cat)
            poses.label("POSE \(frame)", at: CGPoint(x: x, y: y - 8), size: 13, color: .white)
        }
        let anchors = XCTAttachment(image: try render(poses, crop: CGRect(origin: .zero, size: poses.size), view: view))
        anchors.name = "All 44 poses - collar and ear alignment"; anchors.lifetime = .keepAlways; add(anchors)
    }
}
