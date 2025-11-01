// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MolamID",
    platforms: [
        .iOS(.v14),
        .macOS(.v11)
    ],
    products: [
        .library(
            name: "MolamID",
            targets: ["MolamID"]
        )
    ],
    targets: [
        .target(
            name: "MolamID",
            dependencies: []
        ),
        .testTarget(
            name: "MolamIDTests",
            dependencies: ["MolamID"]
        )
    ]
)
