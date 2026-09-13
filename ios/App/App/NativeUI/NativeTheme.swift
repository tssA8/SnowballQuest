import UIKit
import SnowballCore

enum NativeTheme {
    static let ink = UIColor(red: 0.14, green: 0.22, blue: 0.25, alpha: 1)
    static let mint = UIColor(red: 0.73, green: 0.89, blue: 0.82, alpha: 1)
    static let cream = UIColor(red: 1, green: 0.97, blue: 0.9, alpha: 1)
    static let teal = UIColor(red: 0.14, green: 0.42, blue: 0.4, alpha: 1)
    static let gold = UIColor(red: 1, green: 0.77, blue: 0.38, alpha: 1)

    static func label(_ text: String, size: CGFloat = 17, weight: UIFont.Weight = .regular) -> UILabel {
        let label = UILabel()
        label.text = text
        label.textColor = ink
        label.font = UIFontMetrics.default.scaledFont(for: .systemFont(ofSize: size, weight: weight), maximumPointSize: size * 1.5)
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }

    static func button(_ title: String, symbol: String? = nil, primary: Bool = false,
                       id: String? = nil, action: @escaping () -> Void) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.baseBackgroundColor = primary ? teal : UIColor.white.withAlphaComponent(0.8)
        config.baseForegroundColor = primary ? .white : ink
        config.cornerStyle = .large
        config.contentInsets = NSDirectionalEdgeInsets(top: 11, leading: 18, bottom: 11, trailing: 18)
        config.image = symbol.flatMap { UIImage(systemName: $0) }
        config.imagePadding = 10
        let button = UIButton(configuration: config, primaryAction: UIAction { _ in action() })
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        button.titleLabel?.adjustsFontSizeToFitWidth = true
        button.titleLabel?.minimumScaleFactor = 0.75
        button.accessibilityIdentifier = id
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
        return button
    }

    static func fruitName(_ fruit: Fruit?) -> String {
        guard let fruit else { return "原生雪球" }
        switch fruit.rawValue {
        case "fire": return "火焰"
        case "wind": return "旋風"
        case "water": return "水波"
        case "lightning": return "雷電"
        case "earth": return "大地"
        default: return "原生雪球"
        }
    }

    static func fruitSymbol(_ fruit: Fruit?) -> String {
        switch fruit?.rawValue {
        case "fire": return "flame.fill"
        case "wind": return "wind"
        case "water": return "drop.fill"
        case "lightning": return "bolt.fill"
        case "earth": return "leaf.fill"
        default: return "pawprint.fill"
        }
    }
}

/// A small, scrollable native sheet. Its content remains reachable on compact iPhones.
final class NativePanelController: UIViewController {
    let content = UIStackView()
    private let heading: String
    private let message: String?
    private let panel = UIView()

    init(title: String, message: String? = nil) {
        heading = title
        self.message = message
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
        modalTransitionStyle = .crossDissolve
        isModalInPresentation = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }
    override var prefersStatusBarHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.56)
        view.accessibilityViewIsModal = true
        panel.backgroundColor = NativeTheme.cream
        panel.layer.cornerRadius = 24
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)
        let scroll = UIScrollView()
        scroll.alwaysBounceVertical = false
        scroll.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(scroll)
        content.axis = .vertical
        content.spacing = 12
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)
        let titleLabel = NativeTheme.label(heading, size: 25, weight: .bold)
        titleLabel.accessibilityTraits = .header
        content.insertArrangedSubview(titleLabel, at: 0)
        if let message { content.insertArrangedSubview(NativeTheme.label(message, size: 16), at: 1) }
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            panel.centerXAnchor.constraint(equalTo: safe.centerXAnchor),
            panel.centerYAnchor.constraint(equalTo: safe.centerYAnchor),
            panel.widthAnchor.constraint(lessThanOrEqualToConstant: 690),
            panel.topAnchor.constraint(greaterThanOrEqualTo: safe.topAnchor, constant: 12),
            panel.bottomAnchor.constraint(lessThanOrEqualTo: safe.bottomAnchor, constant: -12),
            scroll.topAnchor.constraint(equalTo: panel.topAnchor, constant: 22),
            scroll.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 24),
            scroll.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -24),
            scroll.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -22),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            content.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)
        ])
        let preferredWidth = panel.widthAnchor.constraint(equalTo: safe.widthAnchor, multiplier: 0.83)
        preferredWidth.priority = .defaultHigh
        preferredWidth.isActive = true
        // Prefer the content's height, but allow scrolling when the device is shorter.
        let fit = scroll.heightAnchor.constraint(equalTo: content.heightAnchor)
        fit.priority = .defaultHigh
        fit.isActive = true
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIAccessibility.post(notification: .screenChanged, argument: content.arrangedSubviews.first)
    }

    func addButton(_ title: String, symbol: String? = nil, primary: Bool = false,
                   id: String? = nil, action: @escaping () -> Void) {
        content.addArrangedSubview(NativeTheme.button(title, symbol: symbol, primary: primary, id: id, action: action))
    }
}
