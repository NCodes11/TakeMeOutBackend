import AppKit
import CoreText
import Foundation

private let canvasWidth = 1284
private let canvasHeight = 2778
private let canvasSize = CGSize(width: canvasWidth, height: canvasHeight)

private struct Palette {
  let canvas: NSColor
  let canvasEnd: NSColor
  let ink: NSColor = NSColor(srgbRed: 23 / 255, green: 18 / 255, blue: 50 / 255, alpha: 1)
  let violet: NSColor = NSColor(srgbRed: 91 / 255, green: 72 / 255, blue: 232 / 255, alpha: 1)
  let deepViolet: NSColor = NSColor(srgbRed: 74 / 255, green: 52 / 255, blue: 196 / 255, alpha: 1)
  let lavender: NSColor = NSColor(srgbRed: 230 / 255, green: 225 / 255, blue: 251 / 255, alpha: 1)
  let amber: NSColor = NSColor(srgbRed: 143 / 255, green: 78 / 255, blue: 6 / 255, alpha: 1)
  let white: NSColor = .white
}

private struct CardSpec {
  let outputName: String
  let sourceName: String
  let palette: Palette
  let eyebrow: String
  let headline: String
  let subtitle: String
  let headerIsDark: Bool
  let motif: Motif
}

private enum Motif {
  case halos
  case route
  case timeline
  case discovery
  case share
}

private func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    srgbRed: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

private let outputDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("artifacts/app-store/cards-iphone-6.5", isDirectory: true)
private let sourceDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("artifacts/app-store/iphone-6.5", isDirectory: true)
private let logoURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("src/assets/images/tmo-logo.png")

private let bricolageURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf")
private let interURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf")
private let monoURL = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  .appendingPathComponent("node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf")

private func registerFont(_ url: URL) {
  CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
}

private func font(_ name: String, size: CGFloat) -> CTFont {
  CTFontCreateWithName(name as CFString, size, nil)
}

private func loadImage(_ url: URL) throws -> CGImage {
  guard let image = NSImage(contentsOf: url),
        let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    throw NSError(domain: "TakeMeOutCards", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to open \(url.lastPathComponent)"])
  }
  return cgImage
}

private func roundedRect(_ rect: CGRect, radius: CGFloat) -> CGPath {
  CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

private func drawGradient(_ context: CGContext, from: NSColor, to: NSColor, rect: CGRect, start: CGPoint, end: CGPoint) {
  let space = CGColorSpaceCreateDeviceRGB()
  let gradient = CGGradient(colorsSpace: space, colors: [from.cgColor, to.cgColor] as CFArray, locations: [0, 1])!
  context.saveGState()
  context.addRect(rect)
  context.clip()
  context.drawLinearGradient(gradient, start: start, end: end, options: [])
  context.restoreGState()
}

private func drawText(
  _ text: String,
  font: CTFont,
  color: NSColor,
  rect: CGRect,
  context: CGContext,
  alignment: CTTextAlignment = .left,
  kern: CGFloat = 0,
  lineSpacing: CGFloat = 0
) {
  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = NSTextAlignment(rawValue: Int(alignment.rawValue)) ?? .left
  paragraph.lineBreakMode = .byWordWrapping
  paragraph.lineSpacing = lineSpacing

  let attributes: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: color,
    .kern: kern,
    .paragraphStyle: paragraph,
  ]
  let attributed = NSAttributedString(string: text, attributes: attributes)
  let framesetter = CTFramesetterCreateWithAttributedString(attributed)

  // Core Text uses a lower-left coordinate system. Temporarily restore it while
  // preserving the caller's convenient top-left coordinates for layout.
  context.saveGState()
  context.translateBy(x: 0, y: CGFloat(canvasHeight))
  context.scaleBy(x: 1, y: -1)
  let coreTextRect = CGRect(
    x: rect.minX,
    y: CGFloat(canvasHeight) - rect.maxY,
    width: rect.width,
    height: rect.height
  )
  let path = CGPath(rect: coreTextRect, transform: nil)
  let frame = CTFramesetterCreateFrame(framesetter, CFRangeMake(0, attributed.length), path, nil)
  CTFrameDraw(frame, context)
  context.restoreGState()
}

private func drawScreen(_ image: CGImage, in rect: CGRect, context: CGContext, shadow: NSColor) {
  let path = roundedRect(rect, radius: 56)
  context.saveGState()
  context.setShadow(offset: CGSize(width: 0, height: 18), blur: 34, color: shadow.cgColor)
  context.setFillColor(NSColor.white.cgColor)
  context.addPath(path)
  context.fillPath()
  context.restoreGState()

  context.saveGState()
  context.addPath(path)
  context.clip()
  context.interpolationQuality = .high
  context.translateBy(x: 0, y: rect.minY + rect.maxY)
  context.scaleBy(x: 1, y: -1)
  context.draw(image, in: rect)
  context.restoreGState()

  context.saveGState()
  context.setStrokeColor(NSColor.white.withAlphaComponent(0.95).cgColor)
  context.setLineWidth(5)
  context.addPath(path)
  context.strokePath()
  context.restoreGState()
}

private func drawLogo(_ logo: CGImage, at point: CGPoint, size: CGFloat, labelColor: NSColor, context: CGContext) {
  let imageRect = CGRect(x: point.x, y: point.y, width: size, height: size)
  context.saveGState()
  context.interpolationQuality = .high
  context.translateBy(x: 0, y: imageRect.minY + imageRect.maxY)
  context.scaleBy(x: 1, y: -1)
  context.draw(logo, in: imageRect)
  context.restoreGState()
  drawText(
    "TAKE ME OUT",
    font: font("BricolageGrotesque-ExtraBold", size: 29),
    color: labelColor,
    rect: CGRect(x: point.x + size + 16, y: point.y + 11, width: 330, height: 45),
    context: context,
    kern: -0.25
  )
}

private func drawHalos(_ context: CGContext, palette: Palette) {
  context.saveGState()
  context.setStrokeColor(palette.violet.withAlphaComponent(0.13).cgColor)
  context.setLineWidth(3)
  context.strokeEllipse(in: CGRect(x: -215, y: -340, width: 880, height: 880))
  context.setStrokeColor(palette.violet.withAlphaComponent(0.07).cgColor)
  context.setLineWidth(2)
  context.strokeEllipse(in: CGRect(x: -350, y: -495, width: 1_180, height: 1_180))
  context.strokeEllipse(in: CGRect(x: 760, y: 2_150, width: 510, height: 510))
  context.restoreGState()
}

private func drawRoute(_ context: CGContext, palette: Palette) {
  let path = CGMutablePath()
  path.move(to: CGPoint(x: 893, y: 93))
  path.addCurve(
    to: CGPoint(x: 1_186, y: 410),
    control1: CGPoint(x: 1_166, y: 130),
    control2: CGPoint(x: 1_037, y: 375)
  )
  context.saveGState()
  context.setStrokeColor(NSColor.white.withAlphaComponent(0.27).cgColor)
  context.setLineWidth(3)
  context.setLineDash(phase: 0, lengths: [10, 13])
  context.addPath(path)
  context.strokePath()
  context.setLineDash(phase: 0, lengths: [])
  for point in [CGPoint(x: 907, y: 113), CGPoint(x: 1_048, y: 234), CGPoint(x: 1_141, y: 343), CGPoint(x: 1_186, y: 410)] {
    context.setFillColor(NSColor.white.withAlphaComponent(0.84).cgColor)
    context.fillEllipse(in: CGRect(x: point.x - 11, y: point.y - 11, width: 22, height: 22))
    context.setFillColor(palette.violet.cgColor)
    context.fillEllipse(in: CGRect(x: point.x - 5, y: point.y - 5, width: 10, height: 10))
  }
  context.restoreGState()
}

private func drawTimeline(_ context: CGContext, palette: Palette) {
  context.saveGState()
  let lineX: CGFloat = 93
  context.setStrokeColor(palette.violet.withAlphaComponent(0.45).cgColor)
  context.setLineWidth(3)
  context.move(to: CGPoint(x: lineX, y: 671))
  context.addLine(to: CGPoint(x: lineX, y: 2_520))
  context.strokePath()
  for y in [738, 1_180, 1_622, 2_064] {
    context.setFillColor(palette.violet.cgColor)
    context.fillEllipse(in: CGRect(x: lineX - 12, y: CGFloat(y) - 12, width: 24, height: 24))
    context.setStrokeColor(NSColor.white.withAlphaComponent(0.9).cgColor)
    context.setLineWidth(3)
    context.strokeEllipse(in: CGRect(x: lineX - 7, y: CGFloat(y) - 7, width: 14, height: 14))
  }
  context.setFillColor(palette.amber.cgColor)
  context.fillEllipse(in: CGRect(x: 1_144, y: 522, width: 21, height: 21))
  context.restoreGState()
}

private func drawDiscovery(_ context: CGContext, palette: Palette) {
  context.saveGState()
  context.setStrokeColor(palette.violet.withAlphaComponent(0.16).cgColor)
  context.setLineWidth(3)
  context.strokeEllipse(in: CGRect(x: 827, y: -152, width: 620, height: 620))
  context.setStrokeColor(palette.violet.withAlphaComponent(0.08).cgColor)
  context.setLineWidth(2)
  context.strokeEllipse(in: CGRect(x: 720, y: -259, width: 834, height: 834))

  let pin = CGMutablePath()
  pin.move(to: CGPoint(x: 1_084, y: 83))
  pin.addCurve(
    to: CGPoint(x: 1_003, y: 238),
    control1: CGPoint(x: 1_084, y: 154),
    control2: CGPoint(x: 1_003, y: 238)
  )
  pin.addCurve(
    to: CGPoint(x: 922, y: 83),
    control1: CGPoint(x: 1_003, y: 238),
    control2: CGPoint(x: 922, y: 154)
  )
  pin.addCurve(
    to: CGPoint(x: 1_084, y: 83),
    control1: CGPoint(x: 922, y: -26),
    control2: CGPoint(x: 1_084, y: -26)
  )
  context.setFillColor(palette.violet.withAlphaComponent(0.14).cgColor)
  context.addPath(pin)
  context.fillPath()
  context.setFillColor(palette.violet.withAlphaComponent(0.48).cgColor)
  context.fillEllipse(in: CGRect(x: 977, y: 57, width: 52, height: 52))
  context.restoreGState()
}

private func drawShare(_ context: CGContext, palette: Palette) {
  context.saveGState()
  context.setStrokeColor(NSColor.white.withAlphaComponent(0.24).cgColor)
  context.setLineWidth(3)
  context.setLineDash(phase: 0, lengths: [9, 12])
  let path = CGMutablePath()
  path.move(to: CGPoint(x: 830, y: 118))
  path.addCurve(
    to: CGPoint(x: 1_204, y: 314),
    control1: CGPoint(x: 975, y: 50),
    control2: CGPoint(x: 1_104, y: 393)
  )
  context.addPath(path)
  context.strokePath()
  context.setLineDash(phase: 0, lengths: [])

  for point in [CGPoint(x: 838, y: 118), CGPoint(x: 1_030, y: 170), CGPoint(x: 1_204, y: 314)] {
    context.setFillColor(NSColor.white.withAlphaComponent(0.92).cgColor)
    context.fillEllipse(in: CGRect(x: point.x - 12, y: point.y - 12, width: 24, height: 24))
    context.setFillColor(palette.violet.cgColor)
    context.fillEllipse(in: CGRect(x: point.x - 5, y: point.y - 5, width: 10, height: 10))
  }

  let plane = CGMutablePath()
  plane.move(to: CGPoint(x: 1_073, y: 68))
  plane.addLine(to: CGPoint(x: 1_205, y: 24))
  plane.addLine(to: CGPoint(x: 1_162, y: 155))
  plane.addLine(to: CGPoint(x: 1_132, y: 101))
  plane.closeSubpath()
  context.setFillColor(NSColor.white.withAlphaComponent(0.95).cgColor)
  context.addPath(plane)
  context.fillPath()
  context.restoreGState()
}

private func render(_ spec: CardSpec, logo: CGImage) throws {
  let source = try loadImage(sourceDirectory.appendingPathComponent(spec.sourceName))
  let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.noneSkipLast.rawValue
  guard let context = CGContext(
    data: nil,
    width: canvasWidth,
    height: canvasHeight,
    bitsPerComponent: 8,
    bytesPerRow: canvasWidth * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  ) else {
    throw NSError(domain: "TakeMeOutCards", code: 2, userInfo: [NSLocalizedDescriptionKey: "Unable to create output bitmap"])
  }

  // Adopt a top-left layout coordinate system for all visual elements.
  context.translateBy(x: 0, y: CGFloat(canvasHeight))
  context.scaleBy(x: 1, y: -1)
  drawGradient(
    context,
    from: spec.palette.canvas,
    to: spec.palette.canvasEnd,
    rect: CGRect(origin: .zero, size: canvasSize),
    start: CGPoint(x: 0, y: 0),
    end: CGPoint(x: CGFloat(canvasWidth), y: CGFloat(canvasHeight))
  )

  switch spec.motif {
  case .halos: drawHalos(context, palette: spec.palette)
  case .route: drawRoute(context, palette: spec.palette)
  case .timeline: drawTimeline(context, palette: spec.palette)
  case .discovery: drawDiscovery(context, palette: spec.palette)
  case .share: drawShare(context, palette: spec.palette)
  }

  let textColor = spec.headerIsDark ? spec.palette.white : spec.palette.ink
  let eyebrowColor = spec.headerIsDark ? NSColor.white.withAlphaComponent(0.83) : spec.palette.deepViolet
  let subtitleColor = spec.headerIsDark ? NSColor.white.withAlphaComponent(0.88) : color(0x57516F)

  drawLogo(logo, at: CGPoint(x: 82, y: 68), size: 48, labelColor: textColor, context: context)
  drawText(
    spec.eyebrow,
    font: font("Menlo-Bold", size: 21),
    color: eyebrowColor,
    rect: CGRect(x: 82, y: 163, width: 760, height: 36),
    context: context,
    kern: 3.3
  )
  drawText(
    spec.headline,
    font: font("BricolageGrotesque-ExtraBold", size: 80),
    color: textColor,
    rect: CGRect(x: 82, y: 220, width: 1_068, height: 210),
    context: context,
    lineSpacing: -7
  )
  drawText(
    spec.subtitle,
    font: font("Inter-Regular", size: 29),
    color: subtitleColor,
    rect: CGRect(x: 82, y: 456, width: 970, height: 102),
    context: context,
    lineSpacing: 4
  )

  let screenRect = CGRect(x: 157, y: 640, width: 970, height: 2_100)
  drawScreen(source, in: screenRect, context: context, shadow: spec.palette.deepViolet.withAlphaComponent(0.24))

  guard let renderedImage = context.makeImage() else {
    throw NSError(domain: "TakeMeOutCards", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG"])
  }
  let bitmap = NSBitmapImageRep(cgImage: renderedImage)
  guard let data = bitmap.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else {
    throw NSError(domain: "TakeMeOutCards", code: 3, userInfo: [NSLocalizedDescriptionKey: "Unable to encode PNG"])
  }
  try data.write(to: outputDirectory.appendingPathComponent(spec.outputName), options: Data.WritingOptions.atomic)
}

registerFont(bricolageURL)
registerFont(interURL)
registerFont(monoURL)
try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
let logo = try loadImage(logoURL)

private let cards = [
  CardSpec(
    outputName: "01-make-it-yours.png",
    sourceName: "02-plan-your-day.png",
    palette: Palette(canvas: color(0xF7F6FC), canvasEnd: color(0xEEEAF9)),
    eyebrow: "MAKE IT YOURS",
    headline: "A day that fits\nyour day.",
    subtitle: "Pick the time, vibe, budget, and what you are in the mood for.",
    headerIsDark: false,
    motif: .halos
  ),
  CardSpec(
    outputName: "02-route-ready.png",
    sourceName: "04-route-map.png",
    palette: Palette(canvas: color(0x4A34C4), canvasEnd: color(0x6C5CF0)),
    eyebrow: "YOUR ROUTE, READY",
    headline: "Every stop,\nin the right order.",
    subtitle: "See a practical route before you leave.",
    headerIsDark: true,
    motif: .route
  ),
  CardSpec(
    outputName: "03-more-going.png",
    sourceName: "05-itinerary.png",
    palette: Palette(canvas: color(0xFBF5EF), canvasEnd: color(0xF7F6FC)),
    eyebrow: "MAKE THE DAY HAPPEN",
    headline: "Less planning.\nMore going.",
    subtitle: "Your stops, timing, and directions stay in one place.",
    headerIsDark: false,
    motif: .timeline
  ),
  CardSpec(
    outputName: "04-discover-a-place.png",
    sourceName: "06-place-details.png",
    palette: Palette(canvas: color(0xF8F5FC), canvasEnd: color(0xECE7F8)),
    eyebrow: "DISCOVER A PLACE",
    headline: "Find your next\nfavorite place.",
    subtitle: "See the vibe, rating, price, and timing before you add it to your day.",
    headerIsDark: false,
    motif: .discovery
  ),
  CardSpec(
    outputName: "05-share-the-day.png",
    sourceName: "05-itinerary.png",
    palette: Palette(canvas: color(0x251253), canvasEnd: color(0x604CEA)),
    eyebrow: "SHARE THE DAY",
    headline: "One plan.\nEveryone’s ready.",
    subtitle: "Share the route, timing, and every stop with the people you are meeting.",
    headerIsDark: true,
    motif: .share
  ),
]

for card in cards {
  try render(card, logo: logo)
  print("Created \(card.outputName)")
}
