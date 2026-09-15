import UIKit
import SnowballCore

final class NativeMenuViewController: UIViewController {
    private let store: NativeSaveStore
    private let titleArtwork = UIImageView()
    private let startButton = UIButton(type: .custom)
    private let continueButton = UIButton(type: .custom)
    private let tools = UIStackView()

    init(store: NativeSaveStore = NativeSaveStore()) {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-testing") {
            let suite = "SnowballQuest.NativeUITesting"
            let isolatedDefaults = UserDefaults(suiteName: suite)!
            isolatedDefaults.removePersistentDomain(forName: suite)
            self.store = NativeSaveStore(defaults: isolatedDefaults)
            let arguments = ProcessInfo.processInfo.arguments
            if let flag = arguments.firstIndex(of: "-stage"), flag + 1 < arguments.count,
               let id = StageID(rawValue: arguments[flag + 1]) {
                for stage in StageDefinition.all {
                    if stage.id == id { break }
                    self.store.complete(stage.id)
                }
                _ = self.store.startStage(id)
            }
            if arguments.contains("-near-fruit") {
                var run = self.store.state.run
                run.checkpointX = 420
                self.store.updateRun(run)
            }
        } else {
            self.store = store
        }
        #else
        self.store = store
        #endif
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    override var prefersStatusBarHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.accessibilityIdentifier = "native-menu"
        view.backgroundColor = UIColor(hex: 0x121c37)
        titleArtwork.image = GameArt.image(key: "title-screen")
        titleArtwork.contentMode = .scaleAspectFit
        titleArtwork.accessibilityIdentifier = "menu-title-artwork"
        titleArtwork.accessibilityLabel = "Snowball Quest：雪球與 SNOW-01 準備出勤"
        titleArtwork.isAccessibilityElement = true
        view.addSubview(titleArtwork)

        // The supplied illustration already contains the labels. Accessible native
        // controls follow those exact image rectangles, including letterboxing.
        startButton.accessibilityIdentifier = "menu-stages"
        startButton.accessibilityLabel = "開始出勤，選擇關卡"
        startButton.accessibilityHint = "開啟出勤星圖，不會刪除進度"
        startButton.addAction(UIAction { [weak self] _ in self?.showStages() }, for: .touchUpInside)
        continueButton.accessibilityIdentifier = "menu-continue"
        continueButton.accessibilityLabel = "繼續出勤"
        continueButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.launch(self.store.state.currentStage, restart: false)
        }, for: .touchUpInside)
        for button in [startButton, continueButton] {
            button.layer.cornerRadius = 12
            button.addAction(UIAction { [weak button] _ in button?.backgroundColor = .white.withAlphaComponent(0.16) }, for: .touchDown)
            button.addAction(UIAction { [weak button] _ in button?.backgroundColor = .clear }, for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit])
            view.addSubview(button)
        }
        tools.axis = .horizontal; tools.spacing = 8; tools.distribution = .fillEqually
        tools.addArrangedSubview(NativeTheme.button("同伴", symbol: "person.3.fill", id: "menu-crew") { [weak self] in self?.showCrew() })
        tools.addArrangedSubview(NativeTheme.button("設定", symbol: "slider.horizontal.3", id: "menu-settings") { [weak self] in self?.showSettings() })
        for case let button as UIButton in tools.arrangedSubviews {
            var configuration = button.configuration
            configuration?.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10)
            configuration?.imagePadding = 6
            configuration?.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
            configuration?.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
                var result = attributes
                result.font = .systemFont(ofSize: 14, weight: .semibold)
                return result
            }
            configuration?.titleLineBreakMode = .byClipping
            button.configuration = configuration
            button.titleLabel?.numberOfLines = 1
        }
        view.addSubview(tools)
        refreshStatus()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let image = titleArtwork.image else { return }
        let scale = min(view.bounds.width / image.size.width, view.bounds.height / image.size.height)
        let width = image.size.width * scale, height = image.size.height * scale
        let picture = CGRect(x: (view.bounds.width - width) / 2, y: (view.bounds.height - height) / 2, width: width, height: height)
        titleArtwork.frame = picture
        func hitArea(_ source: CGRect) -> CGRect {
            let box = CGRect(x: picture.minX + source.minX * scale, y: picture.minY + source.minY * scale,
                             width: source.width * scale, height: source.height * scale)
            return box.insetBy(dx: -max(0, 48 - box.width) / 2, dy: -max(0, 48 - box.height) / 2)
        }
        startButton.frame = hitArea(CGRect(x: 527, y: 757, width: 305, height: 99))
        continueButton.frame = hitArea(CGRect(x: 862, y: 757, width: 307, height: 99))
        let safe = view.safeAreaLayoutGuide.layoutFrame
        tools.frame = CGRect(x: safe.minX + 10, y: safe.minY + 8, width: min(196, safe.width * 0.32), height: 48)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshStatus()
    }

    private func refreshStatus() {
        let stage = StageDefinition.find(store.state.currentStage)
        continueButton.accessibilityValue = "第 \(stage.index) 關，\(stage.title)；已救回 \(store.state.cleared.count) 位朋友"
    }

    private func launch(_ id: StageID, restart: Bool) {
        if restart && !store.startStage(id) { return }
        let game = GameViewController(stage: StageDefinition.find(id), store: store)
        game.modalPresentationStyle = .fullScreen
        present(game, animated: true)
    }

    private func showStages() {
        let panel = NativePanelController(title: "出勤星圖", message: "完成一關就能前往下一站。重玩保留果實與同伴。")
        for stage in StageDefinition.all {
            let unlocked = store.state.unlockedStages.contains(stage.id)
            let cleared = store.state.cleared.contains(stage.id)
            let symbol = cleared ? "checkmark.seal.fill" : (unlocked ? "play.circle.fill" : "lock.fill")
            let button = NativeTheme.button("\(stage.index). \(stage.title)", symbol: symbol,
                                           primary: unlocked && stage.id == store.state.currentStage,
                                           id: "stage-\(stage.id.rawValue)") { [weak self, weak panel] in
                panel?.dismiss(animated: true) { self?.launch(stage.id, restart: true) }
            }
            button.isEnabled = unlocked
            button.alpha = unlocked ? 1 : 0.5
            button.accessibilityHint = unlocked ? "重新開始這一關，保留永久能力" : "先完成上一關即可開放"
            panel.content.addArrangedSubview(button)
        }
        panel.addButton("返回飛船", id: "panel-close") { [weak panel] in panel?.dismiss(animated: true) }
        present(panel, animated: true)
    }

    private func showCrew() {
        let panel = NativePanelController(title: "飛船同伴", message: "每一次和解，都讓 SNOW-01 多一位朋友。")
        for stage in StageDefinition.all {
            let joined = store.state.cleared.contains(stage.id)
            let row = UIStackView()
            row.axis = .horizontal
            row.alignment = .center
            row.spacing = 14
            let portrait = UIImageView(image: GameArt.image(key: stage.bossKey, frame: 0))
            portrait.contentMode = .scaleAspectFit
            portrait.alpha = joined ? 1 : 0.28
            portrait.widthAnchor.constraint(equalToConstant: 52).isActive = true
            portrait.heightAnchor.constraint(equalToConstant: 52).isActive = true
            row.addArrangedSubview(portrait)
            row.addArrangedSubview(NativeTheme.label("\(stage.bossName)  ·  \(joined ? "已加入" : "等待相遇")\n\(joined ? stage.reward : "前往第 \(stage.index) 關找找看")", size: 15))
            panel.content.addArrangedSubview(row)
        }
        let fruits = store.state.fruits.map { NativeTheme.fruitName($0) }.joined(separator: "、")
        panel.content.addArrangedSubview(NativeTheme.label("元素收藏：\(fruits.isEmpty ? "冒險中會遇見第一顆果實" : fruits)", size: 15, weight: .semibold))
        panel.addButton("返回飛船", primary: true, id: "panel-close") { [weak panel] in panel?.dismiss(animated: true) }
        present(panel, animated: true)
    }

    private func showSettings() {
        let panel = NativePanelController(title: "設定與操作")
        addSetting("背景音樂", id: "setting-music", value: store.state.settings.music, to: panel) { $0.music = $1 }
        addSetting("遊戲音效", id: "setting-sound", value: store.state.settings.sound, to: panel) { $0.sound = $1 }
        addSetting("觸覺回饋", id: "setting-haptics", value: store.state.settings.haptics, to: panel) { $0.haptics = $1 }
        addSetting("減少動態效果", id: "setting-motion", value: store.state.settings.reducedMotion, to: panel) { $0.reducedMotion = $1 }
        panel.content.addArrangedSubview(NativeTheme.label("左右鍵移動；按住跳躍可跳得更高。肉球攻擊不耗能，集氣按住約 1.2 秒再放開能穿甲。拖出集氣鍵即可取消。愛心罐頭靠近就會回復 2 顆心。\n\n也能連接鍵盤：方向鍵／A、D 移動，空白鍵跳躍，J 攻擊，K 集氣，Shift 衝刺，Q 切换果實，Esc 暫停。", size: 15))
        panel.addButton("完成", primary: true, id: "panel-close") { [weak panel] in panel?.dismiss(animated: true) }
        present(panel, animated: true)
    }

    private func addSetting(_ title: String, id: String, value: Bool, to panel: NativePanelController,
                            update: @escaping (inout NativeSettings, Bool) -> Void) {
        let row = UIStackView()
        row.axis = .horizontal
        row.spacing = 16
        row.alignment = .center
        let toggle = UISwitch()
        toggle.isOn = value
        toggle.onTintColor = NativeTheme.teal
        toggle.accessibilityIdentifier = id
        toggle.accessibilityLabel = title
        toggle.addAction(UIAction { [weak self, weak toggle] _ in
            guard let self, let toggle else { return }
            var settings = self.store.state.settings
            update(&settings, toggle.isOn)
            self.store.updateSettings(settings)
        }, for: .valueChanged)
        row.addArrangedSubview(NativeTheme.label(title, size: 17, weight: .medium))
        row.addArrangedSubview(toggle)
        row.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        panel.content.addArrangedSubview(row)
    }
}
