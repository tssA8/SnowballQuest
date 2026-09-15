import UIKit
import SnowballCore

final class NativeMenuViewController: UIViewController {
    private let store: NativeSaveStore
    private let gradient = CAGradientLayer()
    private let destination = NativeTheme.label("", size: 15)
    private let status = NativeTheme.label("", size: 14)

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
        gradient.colors = [NativeTheme.mint.cgColor, NativeTheme.cream.cgColor]
        gradient.startPoint = CGPoint(x: 0, y: 0)
        gradient.endPoint = CGPoint(x: 1, y: 1)
        view.layer.insertSublayer(gradient, at: 0)

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        let columns = UIStackView()
        columns.axis = .horizontal
        columns.alignment = .center
        columns.spacing = 28
        columns.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(columns)

        let hero = UIStackView()
        hero.axis = .vertical
        hero.spacing = 10
        hero.alignment = .leading
        hero.addArrangedSubview(NativeTheme.label("SNOW-01 ・ 星貓巡邏隊", size: 12, weight: .bold))
        let title = NativeTheme.label("雪球大冒險", size: 37, weight: .heavy)
        title.accessibilityTraits = .header
        hero.addArrangedSubview(title)
        let image = UIImageView(image: GameArt.image(key: "snowball-combat", frame: 0))
        image.contentMode = .scaleAspectFit
        image.accessibilityLabel = "準備出發的白貓雪球"
        image.isAccessibilityElement = true
        image.widthAnchor.constraint(equalToConstant: 110).isActive = true
        image.heightAnchor.constraint(equalToConstant: 88).isActive = true
        hero.addArrangedSubview(image)
        hero.addArrangedSubview(NativeTheme.label("吃果實、救朋友，\n一起找到回家的路。", size: 16))
        hero.addArrangedSubview(status)

        let actions = UIStackView()
        actions.axis = .vertical
        actions.spacing = 9
        actions.addArrangedSubview(destination)
        actions.addArrangedSubview(NativeTheme.button("繼續出勤", symbol: "play.fill", primary: true, id: "menu-continue") { [weak self] in
            guard let self else { return }
            self.launch(self.store.state.currentStage, restart: false)
        })
        actions.addArrangedSubview(NativeTheme.button("出勤星圖", symbol: "map.fill", id: "menu-stages") { [weak self] in self?.showStages() })
        actions.addArrangedSubview(NativeTheme.button("飛船同伴", symbol: "person.3.fill", id: "menu-crew") { [weak self] in self?.showCrew() })
        actions.addArrangedSubview(NativeTheme.button("設定與操作", symbol: "slider.horizontal.3", id: "menu-settings") { [weak self] in self?.showSettings() })
        columns.addArrangedSubview(hero)
        columns.addArrangedSubview(actions)

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            scroll.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 20),
            scroll.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -20),
            scroll.topAnchor.constraint(equalTo: safe.topAnchor, constant: 12),
            scroll.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12),
            columns.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            columns.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            columns.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            columns.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            columns.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor),
            columns.heightAnchor.constraint(greaterThanOrEqualTo: scroll.frameLayoutGuide.heightAnchor),
            hero.widthAnchor.constraint(equalTo: columns.widthAnchor, multiplier: 0.48)
        ])
        refreshStatus()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        gradient.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refreshStatus()
    }

    private func refreshStatus() {
        let stage = StageDefinition.find(store.state.currentStage)
        destination.text = "第 \(stage.index) 關  \(stage.title)"
        status.text = "已救回 \(store.state.cleared.count) / 7 位朋友"
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
