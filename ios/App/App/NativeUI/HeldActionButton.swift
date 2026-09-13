import UIKit

/// Each control tracks its own finger, so movement, jumping and charging can overlap.
final class HeldActionButton: UIControl {
    var onHoldChanged: ((Bool) -> Void)?
    var onCancel: (() -> Void)?
    private(set) var held = false
    private let icon = UIImageView()
    private let caption = UILabel()
    private let ring = CAShapeLayer()
    private let backgroundRing = CAShapeLayer()
    var progress: Double = 0 {
        didSet {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            ring.strokeEnd = CGFloat(min(1, max(0, progress)))
            CATransaction.commit()
        }
    }

    init(title: String, symbol: String, diameter: CGFloat = 64, accent: UIColor = .white) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        isMultipleTouchEnabled = false
        isExclusiveTouch = false
        accessibilityLabel = title
        accessibilityTraits = .button
        isAccessibilityElement = true
        backgroundColor = NativeTheme.ink.withAlphaComponent(0.76)
        layer.borderWidth = 1.5
        layer.borderColor = accent.withAlphaComponent(0.8).cgColor
        icon.image = UIImage(systemName: symbol)
        icon.tintColor = accent
        icon.contentMode = .scaleAspectFit
        caption.text = title
        caption.textColor = .white
        caption.font = .systemFont(ofSize: 12, weight: .semibold)
        caption.textAlignment = .center
        caption.adjustsFontSizeToFitWidth = true
        caption.minimumScaleFactor = 0.65
        icon.translatesAutoresizingMaskIntoConstraints = false
        caption.translatesAutoresizingMaskIntoConstraints = false
        addSubview(icon)
        addSubview(caption)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: diameter),
            heightAnchor.constraint(equalToConstant: diameter),
            icon.centerXAnchor.constraint(equalTo: centerXAnchor),
            icon.topAnchor.constraint(equalTo: topAnchor, constant: diameter * 0.17),
            icon.heightAnchor.constraint(equalToConstant: diameter * 0.35),
            icon.widthAnchor.constraint(equalTo: icon.heightAnchor),
            caption.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            caption.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            caption.topAnchor.constraint(equalTo: icon.bottomAnchor, constant: 2),
            caption.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: 7)
        ])
        for shape in [backgroundRing, ring] {
            shape.fillColor = UIColor.clear.cgColor
            shape.lineWidth = 4
            shape.lineCap = .round
            layer.addSublayer(shape)
        }
        backgroundRing.strokeColor = UIColor.white.withAlphaComponent(0.12).cgColor
        ring.strokeColor = NativeTheme.gold.cgColor
        ring.strokeEnd = 0
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.width / 2
        let path = UIBezierPath(arcCenter: CGPoint(x: bounds.midX, y: bounds.midY),
                                radius: bounds.width / 2 - 4, startAngle: -.pi / 2,
                                endAngle: .pi * 1.5, clockwise: true).cgPath
        backgroundRing.path = path
        ring.path = path
    }

    private func changeHold(_ value: Bool) {
        guard held != value else { return }
        held = value
        backgroundColor = value ? NativeTheme.teal.withAlphaComponent(0.95) : NativeTheme.ink.withAlphaComponent(0.76)
        onHoldChanged?(value)
    }

    override func beginTracking(_ touch: UITouch, with event: UIEvent?) -> Bool {
        guard isEnabled else { return false }
        changeHold(true)
        return true
    }

    override func continueTracking(_ touch: UITouch, with event: UIEvent?) -> Bool {
        guard bounds.contains(touch.location(in: self)) else {
            if held { onCancel?() }
            changeHold(false)
            return false
        }
        return true
    }

    override func endTracking(_ touch: UITouch?, with event: UIEvent?) {
        if let touch, !bounds.contains(touch.location(in: self)), held { onCancel?() }
        changeHold(false)
    }
    override func cancelTracking(with event: UIEvent?) { cancelHold() }
    func cancelHold() {
        if held { onCancel?() }
        changeHold(false)
    }

    override func accessibilityActivate() -> Bool {
        guard isEnabled else { return false }
        changeHold(true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in self?.changeHold(false) }
        return true
    }
}
