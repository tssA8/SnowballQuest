import UIKit
import SpriteKit
import AVFAudio
import SnowballCore

final class GameViewController: UIViewController, GameSceneDelegate {
    private let store: NativeSaveStore
    private var stage: StageDefinition
    private let gameView = SKView()
    private var game: GameScene!
    private let hearts = NativeTheme.label("", size: 18, weight: .bold)
    private let energy = UIProgressView(progressViewStyle: .default)
    private let loot = NativeTheme.label("", size: 13, weight: .semibold)
    private let bossTitle = NativeTheme.label("", size: 12, weight: .bold)
    private let bossHealth = UIProgressView(progressViewStyle: .default)
    private let bossHUD = UIStackView()
    private let toastLabel = NativeTheme.label("", size: 14, weight: .semibold)
    private var fruitButton: UIButton!
    private let left = HeldActionButton(title: "左", symbol: "arrow.left", diameter: 60)
    private let right = HeldActionButton(title: "右", symbol: "arrow.right", diameter: 60)
    private let jump = HeldActionButton(title: "跳躍", symbol: "arrow.up", diameter: 64)
    private let claw = HeldActionButton(title: "肉球", symbol: "pawprint.fill", diameter: 56)
    private let charge = HeldActionButton(title: "集氣", symbol: "sparkles", diameter: 72, accent: NativeTheme.gold)
    private let dashButton = HeldActionButton(title: "衝刺", symbol: "forward.fill", diameter: 48)
    private var keys = Set<String>()
    private var interrupted = false
    private var interruptionRevision = 0
    private var audioInterrupted = false
    private var pendingContinuation: (() -> Void)?
    private var toastTask: DispatchWorkItem?
    private var accessibleChargeTask: DispatchWorkItem?
    private var latestFruit: Fruit?
    private var previousEnergy: Double?
    private var lastEnergyCost = 0
    private var hasShownFruit = false
    private var hasAppeared = false
    private var leaving = false
    private var pendingPanel: NativePanelController?
    private var notifications: [NSObjectProtocol] = []
    private var controls: [HeldActionButton] { [left, right, jump, claw, charge, dashButton] }

    init(stage: StageDefinition, store: NativeSaveStore) {
        self.stage = stage
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { [.bottom, .left, .right] }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = NativeTheme.ink
        view.accessibilityIdentifier = "native-game"
        gameView.translatesAutoresizingMaskIntoConstraints = false
        gameView.ignoresSiblingOrder = true
        gameView.isMultipleTouchEnabled = true
        gameView.preferredFramesPerSecond = 60
        gameView.isAccessibilityElement = false
        view.addSubview(gameView)
        NSLayoutConstraint.activate([
            gameView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            gameView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            gameView.topAnchor.constraint(equalTo: view.topAnchor),
            gameView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        buildHUD()
        buildControls()
        observeInterruptions()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard !leaving, gameView.bounds.width > 0 else { return }
        if game == nil {
            loadGame()
        } else if game.size != gameView.bounds.size {
            game.size = gameView.bounds.size
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        hasAppeared = true
        becomeFirstResponder()
        if let panel = pendingPanel {
            pendingPanel = nil
            DispatchQueue.main.async { [weak self] in self?.presentPanel(panel) }
        }
    }

    private func loadGame() {
        pendingContinuation = nil
        previousEnergy = nil
        lastEnergyCost = 0
        game = GameScene(stage: stage, store: store)
        game.gameDelegate = self
        game.size = gameView.bounds.size
        game.scaleMode = .resizeFill
        gameView.presentScene(game)
    }

    private func buildHUD() {
        let top = UIStackView()
        top.axis = .horizontal
        top.spacing = 12
        top.alignment = .center
        top.isLayoutMarginsRelativeArrangement = true
        top.layoutMargins = UIEdgeInsets(top: 5, left: 12, bottom: 5, right: 5)
        top.backgroundColor = NativeTheme.ink.withAlphaComponent(0.78)
        top.layer.cornerRadius = 17
        top.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(top)

        let life = UIStackView(arrangedSubviews: [hearts, energy])
        life.axis = .vertical
        life.spacing = 5
        hearts.textColor = UIColor(red: 1, green: 0.68, blue: 0.7, alpha: 1)
        hearts.accessibilityIdentifier = "hud-hearts"
        energy.progressTintColor = NativeTheme.gold
        energy.trackTintColor = UIColor.white.withAlphaComponent(0.17)
        energy.accessibilityLabel = "呼嚕能量"
        energy.accessibilityIdentifier = "hud-energy"
        life.widthAnchor.constraint(greaterThanOrEqualToConstant: 104).isActive = true
        top.addArrangedSubview(life)
        fruitButton = NativeTheme.button("原生雪球", symbol: "pawprint.fill", id: "control-fruit") { [weak self] in self?.game?.cycleFruit() }
        fruitButton.accessibilityHint = "切換已取得的元素形態"
        top.addArrangedSubview(fruitButton)
        loot.textColor = .white
        loot.accessibilityIdentifier = "hud-collections"
        top.addArrangedSubview(loot)
        let spacer = UIView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        top.addArrangedSubview(spacer)
        let pause = NativeTheme.button("暫停", symbol: "pause.fill", id: "control-pause") { [weak self] in self?.showPause() }
        top.addArrangedSubview(pause)

        bossHUD.axis = .vertical
        bossHUD.spacing = 5
        bossHUD.backgroundColor = NativeTheme.ink.withAlphaComponent(0.8)
        bossHUD.isLayoutMarginsRelativeArrangement = true
        bossHUD.layoutMargins = UIEdgeInsets(top: 7, left: 12, bottom: 9, right: 12)
        bossHUD.layer.cornerRadius = 10
        bossHUD.translatesAutoresizingMaskIntoConstraints = false
        bossHUD.addArrangedSubview(bossTitle)
        bossHUD.addArrangedSubview(bossHealth)
        bossTitle.textColor = .white
        bossTitle.textAlignment = .center
        bossHealth.progressTintColor = UIColor(red: 1, green: 0.57, blue: 0.43, alpha: 1)
        bossHealth.trackTintColor = UIColor.white.withAlphaComponent(0.17)
        bossHealth.accessibilityLabel = "魔王生命"
        bossHealth.accessibilityIdentifier = "hud-boss-health"
        bossHUD.isHidden = true
        view.addSubview(bossHUD)

        toastLabel.textColor = .white
        toastLabel.textAlignment = .center
        toastLabel.backgroundColor = NativeTheme.ink.withAlphaComponent(0.83)
        toastLabel.layer.cornerRadius = 12
        toastLabel.clipsToBounds = true
        toastLabel.alpha = 0
        toastLabel.translatesAutoresizingMaskIntoConstraints = false
        toastLabel.accessibilityIdentifier = "game-toast"
        view.addSubview(toastLabel)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            top.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 12),
            top.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -12),
            top.topAnchor.constraint(equalTo: safe.topAnchor, constant: 5),
            bossHUD.topAnchor.constraint(equalTo: top.bottomAnchor, constant: 6),
            bossHUD.centerXAnchor.constraint(equalTo: safe.centerXAnchor),
            bossHUD.widthAnchor.constraint(equalTo: safe.widthAnchor, multiplier: 0.43),
            toastLabel.centerXAnchor.constraint(equalTo: safe.centerXAnchor),
            toastLabel.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -100),
            toastLabel.widthAnchor.constraint(lessThanOrEqualTo: safe.widthAnchor, multiplier: 0.68),
            toastLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 40)
        ])
    }

    private func buildControls() {
        left.accessibilityIdentifier = "control-left"
        right.accessibilityIdentifier = "control-right"
        jump.accessibilityIdentifier = "control-jump"
        claw.accessibilityIdentifier = "control-attack"
        charge.accessibilityIdentifier = "control-charge"
        dashButton.accessibilityIdentifier = "control-dash"
        left.onHoldChanged = { [weak self] _ in self?.updateMovement() }
        right.onHoldChanged = { [weak self] _ in self?.updateMovement() }
        jump.onHoldChanged = { [weak self] held in
            guard let self else { return }
            self.game?.setJump(held || self.keys.contains("jump"))
        }
        claw.onHoldChanged = { [weak self] held in if held { self?.game?.attack() } }
        charge.onHoldChanged = { [weak self] held in
            guard let self else { return }
            self.game?.setCharge(held || self.keys.contains("charge"))
        }
        charge.onCancel = { [weak self] in self?.game?.cancelCharge() }
        charge.accessibilityHint = "按住集氣，放開發射。拖出按鈕取消。"
        charge.accessibilityCustomActions = [UIAccessibilityCustomAction(name: "滿蓄力攻擊", target: self, selector: #selector(accessibleChargedAttack))]
        dashButton.onHoldChanged = { [weak self] held in if held { self?.game?.dash() } }
        let movement = UIStackView(arrangedSubviews: [left, right])
        movement.axis = .horizontal
        movement.spacing = 8
        let actions = UIStackView(arrangedSubviews: [dashButton, claw, charge, jump])
        actions.axis = .horizontal
        actions.alignment = .bottom
        actions.spacing = 7
        movement.translatesAutoresizingMaskIntoConstraints = false
        actions.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(movement)
        view.addSubview(actions)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            movement.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 12),
            movement.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -9),
            actions.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -12),
            actions.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -9)
        ])
    }

    @objc private func accessibleChargedAttack() -> Bool {
        guard presentedViewController == nil, pendingPanel == nil else { return false }
        accessibleChargeTask?.cancel()
        game?.setCharge(true)
        let task = DispatchWorkItem { [weak self] in self?.game?.setCharge(false) }
        accessibleChargeTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.25, execute: task)
        return true
    }

    private func updateMovement() {
        let isLeft = left.held || keys.contains("left")
        let isRight = right.held || keys.contains("right")
        game?.setMovement(CGFloat((isRight ? 1 : 0) - (isLeft ? 1 : 0)))
    }

    private func clearInput() {
        accessibleChargeTask?.cancel()
        keys.removeAll()
        game?.cancelCharge()
        for control in controls { control.cancelHold() }
        game?.setMovement(0)
        game?.setJump(false)
    }

    private func observeInterruptions() {
        let center = NotificationCenter.default
        for name in [UIApplication.willResignActiveNotification, UIScene.willDeactivateNotification] {
            notifications.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.pauseForInterruption()
            })
        }
        notifications.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.interrupted else { return }
            self.interrupted = false
            if self.presentedViewController == nil { self.showPause() }
        })
        notifications.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let self, let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            if type == .began {
                self.audioInterrupted = true
                self.pauseForInterruption()
                if UIApplication.shared.applicationState == .active { self.showPause() }
            } else if type == .ended {
                self.audioInterrupted = false
            }
        })
    }

    private func pauseForInterruption() {
        interruptionRevision += 1
        interrupted = true
        game?.pauseGame()
        clearInput()
        game?.persist()
    }

    private func showPause() {
        guard presentedViewController == nil, pendingPanel == nil, game != nil else { return }
        game.pauseGame()
        clearInput()
        let panel = NativePanelController(title: "雪球休息一下", message: "進度已保留。準備好再繼續，遊戲不會自行開始。")
        panel.addButton("繼續冒險", symbol: "play.fill", primary: true, id: "pause-resume") { [weak self, weak panel] in
            guard let self else { return }
            guard !self.audioInterrupted, UIApplication.shared.applicationState == .active else {
                UIAccessibility.post(notification: .announcement, argument: "音訊仍在中斷，請稍後再繼續。")
                return
            }
            let revision = self.interruptionRevision
            let continuation = self.pendingContinuation ?? { [weak self] in self?.game?.resumeGame() }
            panel?.dismiss(animated: true) {
                self.continueAfterDismissal(continuation, requestedAt: revision)
            }
        }
        panel.addButton("重新挑戰這一關", symbol: "arrow.counterclockwise", id: "pause-retry") { [weak self, weak panel] in
            panel?.dismiss(animated: true) { self?.restartStage() }
        }
        panel.addButton("返回飛船", symbol: "house.fill", id: "pause-menu") { [weak self, weak panel] in
            panel?.dismiss(animated: false) { self?.returnToMenu() }
        }
        presentPanel(panel)
    }

    private func restartStage() {
        game?.persist()
        clearInput()
        guard store.startStage(stage.id) else { return }
        hasShownFruit = false
        loadGame()
    }

    private func returnToMenu() {
        leaving = true
        pendingContinuation = nil
        game?.pauseGame()
        clearInput()
        game?.persist()
        store.flush()
        gameView.presentScene(nil)
        game = nil
        dismiss(animated: true)
    }

    func gameScene(_ scene: GameScene, didUpdate hud: GameHUDState) {
        hearts.text = String(repeating: "♥", count: max(0, hud.hearts)) + String(repeating: "♡", count: max(0, hud.maxHearts - hud.hearts))
        hearts.accessibilityLabel = "生命"
        hearts.accessibilityValue = "\(hud.hearts) / \(hud.maxHearts) 顆心"
        energy.progress = Float(hud.energy / max(1, hud.maxEnergy))
        energy.accessibilityValue = "\(Int(hud.energy)) / \(Int(hud.maxEnergy))"
        if let previousEnergy, previousEnergy - hud.energy > 3 {
            lastEnergyCost = Int((previousEnergy - hud.energy).rounded())
        }
        previousEnergy = hud.energy
        loot.text = "魚乾 \(hud.fish)\n星星 \(hud.stars) / 3"
        charge.progress = hud.charging ? hud.chargeRatio : 0
        charge.accessibilityValue = hud.charging ? "集氣 \(Int(hud.chargeRatio * 100))%"
            : lastEnergyCost > 0 ? "準備集氣；上次消耗 \(lastEnergyCost) 能量" : "準備集氣"
        if !hasShownFruit || latestFruit != hud.fruit {
            latestFruit = hud.fruit
            hasShownFruit = true
            fruitButton.configuration?.title = NativeTheme.fruitName(hud.fruit)
            fruitButton.configuration?.image = UIImage(systemName: NativeTheme.fruitSymbol(hud.fruit))
            fruitButton.accessibilityValue = NativeTheme.fruitName(hud.fruit)
        }
        bossHUD.isHidden = hud.bossName == nil
        bossTitle.text = "\(hud.bossName ?? "")  ·  第 \(hud.bossPhase) 階段"
        bossHealth.progress = Float(hud.bossHealthRatio)
        bossHealth.accessibilityValue = "\(Int(hud.bossHealthRatio * 100))%"
    }

    func gameScene(_ scene: GameScene, showDialogue speaker: String, lines: [String], completion: @escaping () -> Void) {
        clearInput()
        let panel = NativePanelController(title: speaker, message: lines.joined(separator: "\n\n"))
        panel.addButton("準備好了", symbol: "pawprint.fill", primary: true, id: "dialogue-next") { [weak self, weak panel] in
            guard let self else { return }
            let revision = self.interruptionRevision
            panel?.dismiss(animated: true) {
                self.continueAfterDismissal(completion, requestedAt: revision)
            }
        }
        presentPanel(panel)
    }

    private func continueAfterDismissal(_ continuation: @escaping () -> Void, requestedAt revision: Int) {
        guard !leaving else { return }
        guard revision == interruptionRevision, !audioInterrupted,
              UIApplication.shared.applicationState == .active else {
            // Preserve dialogue/ending callbacks, but never let an old tap override a newer call or lock.
            pendingContinuation = continuation
            interrupted = true
            game?.pauseGame()
            clearInput()
            if UIApplication.shared.applicationState == .active { showPause() }
            return
        }
        pendingContinuation = nil
        interrupted = false
        continuation()
        becomeFirstResponder()
    }

    func gameScene(_ scene: GameScene, didComplete stage: StageDefinition) {
        clearInput()
        let next = StageDefinition.all.first { $0.index == stage.index + 1 }
        let message = next == nil
            ? "七位朋友都回到 SNOW-01 了。夜墨也加入了巡邏隊，回家的路上不再孤單。\n\n\(stage.reward)"
            : "\(stage.bossName) 已加入星貓巡邏隊！\n\n\(stage.reward)"
        let panel = NativePanelController(title: next == nil ? "一起回家吧！" : "第 \(stage.index) 關完成", message: message)
        if let next {
            panel.addButton("下一站：\(next.title)", symbol: "arrow.right.circle.fill", primary: true, id: "complete-next") { [weak self, weak panel] in
                panel?.dismiss(animated: true) {
                    guard let self, self.store.startStage(next.id) else { return }
                    self.stage = next
                    self.hasShownFruit = false
                    self.loadGame()
                }
            }
        }
        panel.addButton("再玩這一關", symbol: "arrow.counterclockwise", id: "complete-replay") { [weak self, weak panel] in
            panel?.dismiss(animated: true) { self?.restartStage() }
        }
        panel.addButton(next == nil ? "返回飛船，自由巡邏" : "返回飛船", symbol: "house.fill", primary: next == nil, id: "complete-menu") { [weak self, weak panel] in
            panel?.dismiss(animated: false) { self?.returnToMenu() }
        }
        presentPanel(panel)
    }

    private func presentPanel(_ panel: NativePanelController) {
        guard !leaving else { return }
        guard hasAppeared, view.window != nil else {
            pendingPanel = panel
            return
        }
        guard presentedViewController == nil else { return }
        present(panel, animated: true)
    }

    func gameScene(_ scene: GameScene, toast message: String) {
        toastTask?.cancel()
        toastLabel.text = "  \(message)  "
        toastLabel.alpha = 1
        UIAccessibility.post(notification: .announcement, argument: message)
        let task = DispatchWorkItem { [weak self] in self?.toastLabel.alpha = 0 }
        toastTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5, execute: task)
    }

    func gameScene(_ scene: GameScene, feedback event: GameFeedback) {
        guard store.state.settings.haptics else { return }
        switch event {
        case .jump: UIImpactFeedbackGenerator(style: .soft).impactOccurred(intensity: 0.45)
        case .hit: UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .hurt: UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case .heal: UINotificationFeedbackGenerator().notificationOccurred(.success)
        case .charged: UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        case .victory: UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    private func keyName(_ key: UIKey) -> String {
        switch key.keyCode {
        case .keyboardLeftArrow: return "left"
        case .keyboardRightArrow: return "right"
        case .keyboardSpacebar: return "jump"
        case .keyboardEscape: return "pause"
        case .keyboardLeftShift, .keyboardRightShift: return "dash"
        default:
            switch key.charactersIgnoringModifiers.lowercased() {
            case "a": return "left"
            case "d": return "right"
            case "j", "e": return "attack"
            case "k": return "charge"
            case "q": return "fruit"
            default: return ""
            }
        }
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard presentedViewController == nil else { super.pressesBegan(presses, with: event); return }
        for press in presses {
            guard let key = press.key else { continue }
            let name = keyName(key)
            guard !name.isEmpty, !keys.contains(name) else { continue }
            keys.insert(name)
            switch name {
            case "jump": game?.setJump(true)
            case "attack": game?.attack()
            case "charge": game?.setCharge(true)
            case "dash": game?.dash()
            case "fruit": game?.cycleFruit()
            case "pause": showPause()
            default: break
            }
        }
        updateMovement()
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        for press in presses {
            guard let key = press.key else { continue }
            let name = keyName(key)
            keys.remove(name)
            if name == "jump" { game?.setJump(jump.held) }
            if name == "charge" { game?.setCharge(charge.held) }
        }
        updateMovement()
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) { clearInput() }

    deinit {
        notifications.forEach { NotificationCenter.default.removeObserver($0) }
        toastTask?.cancel()
        accessibleChargeTask?.cancel()
    }
}
