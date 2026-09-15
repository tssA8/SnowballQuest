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
        let texture = try XCTUnwrap(view.texture(from: node, crop: crop), "SpriteKit must actually render the artwork")
        return UIImage(cgImage: texture.cgImage())
    }

    func testCollectingEachFruitImmediatelyChangesSnowballsRenderedAppearance() throws {
        let view = SKView(frame: CGRect(x: 0, y: 0, width: 240, height: 180))
        for stage in StageDefinition.all where stage.fruit != nil {
            try withGame(stage.id) { scene, store in
                let crop = CGRect(x: -55, y: -4, width: 110, height: 84)
                let before = try render(scene.player, crop: crop, view: view).pngData()
                scene.player.position = CGPoint(x: 500, y: 128)
                advance(scene, frames: 1)
                XCTAssertEqual(scene.fruit, stage.fruit)
                XCTAssertEqual(scene.appearance.fruit, stage.fruit)
                XCTAssertFalse(scene.appearance.isHidden)
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
            for expected in [nil] + Fruit.allCases.map({ Optional($0) }) {
                XCTAssertEqual(scene.fruit, expected)
                XCTAssertEqual(scene.appearance.fruit, expected)
                scene.player.texture = GameArt.texture(key: "snowball", frame: 0)
                scene.appearance.update(fruit: expected, frame: 0, elapsed: 0, reducedMotion: true)
                let picture = try render(scene.player, crop: CGRect(x: -55, y: -4, width: 110, height: 84), view: view)
                pictures.insert(try XCTUnwrap(picture.pngData()))
                scene.cycleFruit()
            }
            XCTAssertEqual(pictures.count, 6, "Forms must have distinct pixels, not only different HUD labels")
            XCTAssertNil(scene.fruit)
            XCTAssertTrue(scene.appearance.isHidden)
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
                    XCTAssertFalse(scene.appearance.isHidden)
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
    }
}
