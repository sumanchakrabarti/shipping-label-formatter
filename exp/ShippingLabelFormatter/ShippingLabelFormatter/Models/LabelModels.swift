import Foundation
import UIKit

/// Fit mode for resizing labels into the 4×6 target area.
enum FitMode: String, CaseIterable, Identifiable {
    case fit = "Fit"
    case fill = "Fill"
    case stretch = "Stretch"

    var id: String { rawValue }

    var description: String {
        switch self {
        case .fit: return "Preserve ratio, white margins"
        case .fill: return "Preserve ratio, crop excess"
        case .stretch: return "Stretch to fill"
        }
    }
}

/// Represents a label slot (left or right) on the page.
struct LabelSlot: Identifiable {
    let id: Int // 0 = left, 1 = right
    var image: UIImage?
    var fileName: String?
}
