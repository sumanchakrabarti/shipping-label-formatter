import UIKit
import PDFKit
import CoreGraphics

/// Core label processing: auto-crop, resize, and 2-up PDF generation.
/// Port of the Python core.py logic to Swift using CoreGraphics/UIKit.
class LabelProcessor {

    // MARK: - Constants

    static let pageWidthInches: CGFloat = 11.0   // Landscape letter
    static let pageHeightInches: CGFloat = 8.5
    static let labelWidthInches: CGFloat = 4.0
    static let labelHeightInches: CGFloat = 6.0
    static let defaultDPI: CGFloat = 300.0
    static let borderThreshold: UInt8 = 80
    static let cropPadding: Int = 8

    // MARK: - Load Image from PDF

    /// Rasterize the first page of a PDF into a UIImage.
    static func loadImageFromPDF(data: Data, dpi: CGFloat = defaultDPI) -> UIImage? {
        guard let provider = CGDataProvider(data: data as CFData),
              let pdfDoc = CGPDFDocument(provider),
              let page = pdfDoc.page(at: 1) else { return nil }

        let pageRect = page.getBoxRect(.mediaBox)
        let scale = dpi / 72.0
        let width = Int(pageRect.width * scale)
        let height = Int(pageRect.height * scale)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let context = CGContext(
            data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: width * 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // White background
        context.setFillColor(UIColor.white.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        context.scaleBy(x: scale, y: scale)
        context.drawPDFPage(page)

        guard let cgImage = context.makeImage() else { return nil }
        return UIImage(cgImage: cgImage)
    }

    // MARK: - Auto-Crop

    /// Detect the black border rectangle and crop to it (with padding).
    static func autoCrop(_ image: UIImage) -> UIImage {
        guard let cgImage = image.cgImage else { return image }

        let width = cgImage.width
        let height = cgImage.height

        guard let context = CGContext(
            data: nil, width: width, height: height,
            bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return image }

        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        guard let pixelData = context.data else { return image }
        let data = pixelData.bindMemory(to: UInt8.self, capacity: width * height * 4)

        // Helper: get grayscale brightness at (x, y)
        func brightness(_ x: Int, _ y: Int) -> UInt8 {
            let offset = (y * width + x) * 4
            let r = UInt16(data[offset])
            let g = UInt16(data[offset + 1])
            let b = UInt16(data[offset + 2])
            return UInt8((r * 299 + g * 587 + b * 114) / 1000)
        }

        func isDark(_ x: Int, _ y: Int) -> Bool {
            brightness(x, y) < borderThreshold
        }

        // Find bounding box of all dark pixels
        var minX = width, minY = height, maxX = 0, maxY = 0
        for y in 0..<height {
            for x in 0..<width {
                if isDark(x, y) {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                }
            }
        }

        guard maxX > minX, maxY > minY else { return image }

        let boxW = maxX - minX
        let boxH = maxY - minY

        // Sanity check: must be a meaningful portion
        guard boxW * boxH >= width * height / 20 else { return image }

        // Scan inward to skip past the solid border lines
        func rowIsBorder(_ y: Int) -> Bool {
            var darkCount = 0
            for x in minX..<maxX {
                if isDark(x, y) { darkCount += 1 }
            }
            return darkCount > boxW / 2
        }

        func colIsBorder(_ x: Int) -> Bool {
            var darkCount = 0
            for y in minY..<maxY {
                if isDark(x, y) { darkCount += 1 }
            }
            return darkCount > boxH / 2
        }

        var top = minY
        for y in minY..<min(minY + min(boxH / 2, 100), height) {
            if !rowIsBorder(y) { top = y; break }
        }

        var bottom = maxY
        for y in stride(from: maxY, to: max(maxY - min(boxH / 2, 100), 0), by: -1) {
            if !rowIsBorder(y) { bottom = y + 1; break }
        }

        var left = minX
        for x in minX..<min(minX + min(boxW / 2, 100), width) {
            if !colIsBorder(x) { left = x; break }
        }

        var right = maxX
        for x in stride(from: maxX, to: max(maxX - min(boxW / 2, 100), 0), by: -1) {
            if !colIsBorder(x) { right = x + 1; break }
        }

        // Expand outward so a bit of the border remains visible
        left = max(left - cropPadding, 0)
        top = max(top - cropPadding, 0)
        right = min(right + cropPadding, width)
        bottom = min(bottom + cropPadding, height)

        let cropRect = CGRect(x: left, y: top, width: right - left, height: bottom - top)
        guard let cropped = cgImage.cropping(to: cropRect) else { return image }
        return UIImage(cgImage: cropped)
    }

    // MARK: - Resize

    /// Resize an image to fit 4×6 label dimensions at the given DPI.
    static func resizeToLabel(_ image: UIImage, fitMode: FitMode, dpi: CGFloat = defaultDPI) -> UIImage {
        let targetW = labelWidthInches * dpi
        let targetH = labelHeightInches * dpi
        let targetSize = CGSize(width: targetW, height: targetH)

        let srcW = image.size.width * image.scale
        let srcH = image.size.height * image.scale

        let renderer = UIGraphicsImageRenderer(size: targetSize)

        return renderer.image { ctx in
            // White background
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: targetSize))

            switch fitMode {
            case .stretch:
                image.draw(in: CGRect(origin: .zero, size: targetSize))

            case .fill:
                let scale = max(targetW / srcW, targetH / srcH)
                let newW = srcW * scale
                let newH = srcH * scale
                let x = (targetW - newW) / 2
                let y = (targetH - newH) / 2
                image.draw(in: CGRect(x: x, y: y, width: newW, height: newH))

            case .fit:
                let scale = min(targetW / srcW, targetH / srcH)
                let newW = srcW * scale
                let newH = srcH * scale
                let x = (targetW - newW) / 2
                let y = (targetH - newH) / 2
                image.draw(in: CGRect(x: x, y: y, width: newW, height: newH))
            }
        }
    }

    // MARK: - 2-Up PDF

    /// Generate a landscape letter PDF (11×8.5") with 1 or 2 labels side by side.
    static func generate2UpPDF(labels: [UIImage]) -> Data {
        let pageW = pageWidthInches * 72  // PDF uses 72 points/inch
        let pageH = pageHeightInches * 72
        let labelW = labelWidthInches * 72
        let labelH = labelHeightInches * 72
        let halfW = pageW / 2

        let xLeft = (halfW - labelW) / 2
        let xRight = halfW + (halfW - labelW) / 2
        let yOffset = (pageH - labelH) / 2

        let pdfData = NSMutableData()
        let pageRect = CGRect(x: 0, y: 0, width: pageW, height: pageH)

        UIGraphicsBeginPDFContextToData(pdfData, pageRect, nil)
        UIGraphicsBeginPDFPage()

        for (i, label) in labels.prefix(2).enumerated() {
            let x = i == 0 ? xLeft : xRight
            let drawRect = CGRect(x: x, y: yOffset, width: labelW, height: labelH)
            label.draw(in: drawRect)
        }

        UIGraphicsEndPDFContext()
        return pdfData as Data
    }

    // MARK: - Full Pipeline

    /// Process one or two label images through the full pipeline.
    static func processLabels(
        images: [UIImage],
        autoCrop: Bool = true,
        fitMode: FitMode = .fit,
        dpi: CGFloat = defaultDPI
    ) -> Data {
        let processed = images.map { img -> UIImage in
            var result = img
            if autoCrop {
                result = self.autoCrop(result)
            }
            result = resizeToLabel(result, fitMode: fitMode, dpi: dpi)
            return result
        }
        return generate2UpPDF(labels: processed)
    }
}
