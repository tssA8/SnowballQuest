import XCTest

final class NativeUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]
    }

    override func tearDownWithError() throws {
        // hasSucceeded is still false while teardown is running. Only capture
        // actual failures, and use the screen if the test already closed the app.
        if (testRun?.failureCount ?? 0) > 0 {
            let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            image.name = "Native UI failure"
            image.lifetime = .keepAlways
            add(image)
        }
        app.terminate()
    }

    private func launchGame(stage: String = "home") {
        app.launchArguments = ["-ui-testing", "-stage", stage]
        app.launch()
        XCTAssertTrue(app.buttons["menu-continue"].waitForExistence(timeout: 15))
        app.buttons["menu-continue"].tap()
        let dialogue = app.buttons["dialogue-next"]
        XCTAssertTrue(dialogue.waitForExistence(timeout: 10), "Stage \(stage) should show its native introduction")
        dialogue.tap()
        XCTAssertTrue(app.buttons["control-pause"].waitForExistence(timeout: 5))
    }

    private func energyValue() -> Int {
        let value = app.progressIndicators["hud-energy"].value as? String ?? ""
        return Int(value.components(separatedBy: " / ").first ?? "") ?? -1
    }

    func testNewSaveOnlyUnlocksFirstStage() {
        app.launch()
        app.buttons["menu-stages"].tap()
        let home = app.buttons["stage-home"]
        XCTAssertTrue(home.waitForExistence(timeout: 5))
        XCTAssertTrue(home.isEnabled)
        XCTAssertFalse(app.buttons["stage-rooftop"].isEnabled)
        XCTAssertFalse(app.buttons["stage-basement"].isEnabled)
        home.tap()
        XCTAssertTrue(app.buttons["dialogue-next"].waitForExistence(timeout: 10))
    }

    func testSevenNativeStagesBootWithUsableControls() {
        for stage in ["home", "rooftop", "basement", "parking", "foundations", "floor13", "nightark"] {
            launchGame(stage: stage)
            let window = app.windows.firstMatch.frame
            XCTAssertGreaterThan(window.width, window.height, "The game must use landscape layout")
            for name in ["left", "right", "jump", "attack", "charge", "dash", "pause", "fruit"] {
                let control = app.buttons["control-\(name)"]
                XCTAssertTrue(control.isHittable, "\(stage) \(name) must be reachable")
                XCTAssertGreaterThanOrEqual(control.frame.width, 48)
                XCTAssertGreaterThanOrEqual(control.frame.height, 48)
                XCTAssertTrue(app.windows.firstMatch.frame.contains(control.frame), "\(name) cannot be outside the screen")
            }
            let left = app.buttons["control-right"].frame
            let actions = app.buttons["control-dash"].frame
            XCTAssertFalse(left.intersects(actions), "Movement and combat controls must not overlap")
            // Application-element cropping can use portrait coordinates after a
            // landscape launch. Preserve the complete simulator screen instead.
            let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            image.name = "Native \(stage) landscape"
            image.lifetime = .keepAlways
            add(image)
            app.terminate()
        }
    }

    func testChargeReleaseSpendsEnergy() {
        launchGame()
        XCTAssertEqual(energyValue(), 100)
        app.buttons["control-charge"].press(forDuration: 1.3)
        // This feedback persists while energy regenerates, avoiding a timing-sensitive snapshot.
        let spent = NSPredicate { [weak self] _, _ in
            let value = self?.app.buttons["control-charge"].value as? String ?? ""
            return value.contains("上次消耗")
        }
        expectation(for: spent, evaluatedWith: nil)
        waitForExpectations(timeout: 3)
        let feedback = app.buttons["control-charge"].value as? String ?? ""
        let cost = feedback.split(separator: " ").compactMap { Int($0) }.first ?? 0
        XCTAssertGreaterThanOrEqual(cost, 25, "Holding must produce a charged shot, not the 16-energy tap")
        XCTAssertLessThanOrEqual(cost, 30)
    }

    func testDraggingOutCancelsChargeWithoutSpendingEnergy() {
        launchGame()
        let button = app.buttons["control-charge"]
        let start = button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let outside = button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: -1.0))
        start.press(forDuration: 0.5, thenDragTo: outside)
        XCTAssertGreaterThanOrEqual(energyValue(), 95)
        XCTAssertEqual(button.value as? String, "準備集氣")
    }

    func testPauseAndReturnToShip() {
        launchGame()
        app.buttons["control-pause"].tap()
        XCTAssertTrue(app.buttons["pause-resume"].waitForExistence(timeout: 5))
        app.buttons["pause-resume"].tap()
        app.buttons["control-jump"].tap()
        app.buttons["control-pause"].tap()
        app.buttons["pause-menu"].tap()
        XCTAssertTrue(app.buttons["menu-continue"].waitForExistence(timeout: 5))
    }

    func testBackgroundRequiresExplicitResume() {
        launchGame()
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.buttons["pause-resume"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["pause-menu"].isHittable)
        app.buttons["pause-resume"].tap()
        XCTAssertTrue(app.buttons["control-charge"].isHittable)
    }

    func testSettingsRemainChangedWhenReopened() {
        app.launch()
        app.buttons["menu-settings"].tap()
        let haptics = app.switches["setting-haptics"]
        XCTAssertTrue(haptics.waitForExistence(timeout: 5))
        XCTAssertEqual(haptics.value as? String, "1")
        haptics.tap()
        // The short landscape sheet scrolls, instead of shrinking native touch targets.
        for _ in 0..<4 {
            if app.buttons["panel-close"].isHittable { break }
            app.swipeUp()
        }
        app.buttons["panel-close"].tap()
        app.buttons["menu-settings"].tap()
        XCTAssertEqual(app.switches["setting-haptics"].value as? String, "0")
    }
}
