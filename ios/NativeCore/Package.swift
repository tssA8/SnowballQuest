// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SnowballCore",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [.library(name: "SnowballCore", targets: ["SnowballCore"])],
    targets: [
        .target(name: "SnowballCore"),
        .testTarget(name: "SnowballCoreTests", dependencies: ["SnowballCore"])
    ]
)
