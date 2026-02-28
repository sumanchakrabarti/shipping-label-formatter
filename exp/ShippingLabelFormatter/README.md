# Shipping Label Formatter — iOS App

A native SwiftUI iOS app that takes shipping label images or PDFs, auto-crops to the label border, resizes to 4×6, and outputs a print-ready 2-up landscape letter PDF (8.5×11").

## Features

- **Import from** Photo Library, Files app (images + PDFs), or Camera
- **Auto-crop** — detects the black border rectangle and crops to it
- **2-up layout** — places 1 or 2 labels side-by-side on a landscape letter page
- **Fit modes** — Fit (white margins), Fill (crop excess), or Stretch
- **Share/Print** — outputs a PDF you can AirPrint, save to Files, or share

## Requirements

- iOS 17.0+
- Xcode 15.4+

## Building

1. Open `ShippingLabelFormatter.xcodeproj` in Xcode
2. Select your team under Signing & Capabilities
3. Build and run on a device or simulator

## Architecture

```
ShippingLabelFormatter/
├── ShippingLabelFormatterApp.swift   # App entry point
├── Info.plist                        # Camera/photo permissions
├── Views/
│   ├── ContentView.swift             # Main UI — two drop zones, options, generate button
│   └── LabelViewModel.swift          # State management, import handling, PDF generation
├── Models/
│   └── LabelModels.swift             # FitMode enum, LabelSlot struct
├── Services/
│   └── LabelProcessor.swift          # Core logic — auto-crop, resize, 2-up PDF
└── Assets.xcassets/                  # App icon and assets
```

No external dependencies — uses only UIKit, CoreGraphics, PDFKit, and PhotosUI.
