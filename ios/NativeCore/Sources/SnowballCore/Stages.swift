import Foundation

public enum Fruit: String, Codable, CaseIterable, Sendable {
    case fire, wind, water, lightning, earth

    public var title: String {
        switch self {
        case .fire: return "火焰"
        case .wind: return "風"
        case .water: return "水"
        case .lightning: return "雷電"
        case .earth: return "大地"
        }
    }

    public var textureKey: String { self == .fire ? "fire-fruit" : "fruit-\(rawValue)" }
}

public enum StageID: String, Codable, CaseIterable, Sendable {
    case home, rooftop, basement, parking, foundations, floor13, nightark
}

public struct StageDefinition: Equatable, Sendable {
    public let id: StageID
    public let index: Int
    public let title: String
    public let bossName: String
    public let bossKey: String
    public let fruit: Fruit?
    public let enemyKinds: [String]
    public let intro: [String]
    public let reconcile: [String]
    public let reward: String
    public let color: UInt32

    public var bossHealth: Double { id == .home ? 660 : Double(600 + index * 30) }
    public var next: StageID? { index < Self.all.count ? Self.all[index].id : nil }

    public static func find(_ id: StageID) -> StageDefinition {
        // Every StageID is represented by the static campaign below.
        all.first(where: { $0.id == id })!
    }

    public static let all: [StageDefinition] = [
        StageDefinition(id: .home, index: 1, title: "沙發底下的警報", bossName: "扳手", bossKey: "boss-wrench",
                        fruit: .fire, enemyKinds: ["vacuum", "mouse"],
                        intro: ["SNOW-01 少了一個零件，訊號來自陽台。", "扳手的掃地機戰甲失控了！往右前進，按住集氣鍵，鬆開就能發射集氣攻擊。"],
                        reconcile: ["戰甲終於停下來了！原來我們找的是同一個零件。", "我是扳手。飛船交給我修理，一起回家吧。"],
                        reward: "火焰果實永久解鎖 · 攻擊力提升 · 扳手加入飛船", color: 0xeab788),
        StageDefinition(id: .rooftop, index: 2, title: "天台風暴", bossName: "風翎", bossKey: "boss-galeplume",
                        fruit: .wind, enemyKinds: ["pigeon", "pigeon"],
                        intro: ["鴿子艦長風翎把天台當成星際降落場，整棟樓都捲進了氣旋。", "沿屋頂向右找他。上升氣流可以送你到高處，下面的路也能直接通往魔王。"],
                        reconcile: ["這裡不是降落場？難怪我的導航一直說「曬衣區」。", "氣旋停止了。我會替 SNOW-01 看好航線，也幫你找出藏起來的支線。"],
                        reward: "風果實永久解鎖 · 空中控制提升 · 風翎加入飛船", color: 0xa1d9d3),
        StageDefinition(id: .basement, index: 3, title: "地下水世界", bossName: "波波", bossKey: "boss-bobo",
                        fruit: .water, enemyKinds: ["slime", "slime"],
                        intro: ["地下室正在淹水！金魚王子波波把大樓用水抽進了水族飛船。", "踩著管線向右走。水池會托住雪球，水果實能讓水中的上浮更輕鬆。"],
                        reconcile: ["我的飛船只是沒燃料了……不是故意把你們家淹掉的。", "扳手答應幫我修水族機甲。我要加入巡邏隊，把水送回大家家裡。"],
                        reward: "水果實永久解鎖 · 生命上限增加 · 波波加入飛船", color: 0x72c5db),
        StageDefinition(id: .parking, index: 4, title: "停電停車場", bossName: "伏特", bossKey: "boss-volt",
                        fruit: .lightning, enemyKinds: ["beetle", "vacuum"],
                        intro: ["停車場全黑了。雷電星柯基伏特正在借整棟樓的電替飛船充電！", "地面電纜亮黃時準備跳開，亮藍時正在放電。雷電與大地形態可以安全通過。"],
                        reconcile: ["汪！我只想充到百分之百……原來你們都沒電了？", "我把備用電池借給 SNOW-01。接下來輪到我幫大家充電！"],
                        reward: "雷電果實永久解鎖 · 能量上限與回復提升 · 伏特加入飛船", color: 0xf4db77),
        StageDefinition(id: .foundations, index: 5, title: "地基大震動", bossName: "土豆", bossKey: "boss-tato",
                        fruit: .earth, enemyKinds: ["mole", "mole"],
                        intro: ["地底礦坑一直震動。倉鼠礦工土豆相信這裡的礦石能救他的乾枯星球。", "沿根脈往右找到土豆。大地形態可以震碎高處的裂紋岩牆，開出藏星星的捷徑。"],
                        reconcile: ["夜墨說，只要挖出星核，我的星球就會長出植物……", "原來我被騙了。先把這裡修好，再和你一起找真正能救大家的方法。"],
                        reward: "大地果實永久解鎖 · 失衡傷害提升 · 土豆加入飛船", color: 0xc9aa7b),
        StageDefinition(id: .floor13, index: 6, title: "十三樓泡泡龍之家", bossName: "泡泡龍媽媽", bossKey: "boss-bubble",
                        fruit: nil, enemyKinds: ["dragon", "shadow"],
                        intro: ["泡泡龍媽媽以為雪球偷了龍蛋，其實是影子毛球把蛋藏進電梯井。", "小鈴已啟用五元素快速切換與連攜。乘泡泡探索上方，向右找到龍媽媽並解除控制。"],
                        reconcile: ["我的孩子！原來是那些影子把龍蛋藏了起來。對不起，雪球。", "控制訊號消失了。讓我們一家一起加入飛船，這次換我們保護你。"],
                        reward: "元素連攜永久解鎖 · 泡泡龍一家加入 · 魔王戰救援", color: 0xe9b7d6),
        StageDefinition(id: .nightark, index: 7, title: "夜空中的回家路", bossName: "夜墨", bossKey: "boss-nightink",
                        fruit: nil, enemyKinds: ["shadow", "pigeon", "beetle"],
                        intro: ["夜墨啟動永夜方舟，要把社區藏進永遠不會天亮的假家。", "六組同伴和小鈴都在。沿星橋向右，準備充滿呼嚕能量，用星貓爆發關閉歸巢星核。"],
                        reconcile: ["我只是……不想再等一個永遠不會回來的人。", "雪球替夜墨留了一個位置。SNOW-01 的船艙很擠，但巡邏隊還放得下一位新朋友。"],
                        reward: "星貓爆發永久解鎖 · 夜墨加入巡邏隊 · 自由巡邏模式", color: 0xa496ec)
    ]
}
