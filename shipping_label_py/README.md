# Label Resize & Print

A cross-platform app that takes a postal shipping label (image or PDF), resizes it to standard label dimensions, and outputs a print-ready PDF. Works on desktop and iOS.

## Installation

```bash
pip install -r requirements.txt
```

## Web App (Desktop + iOS)

Start the web server:

```bash
python -m label_resize_print.app
```

Then open **http://localhost:5000** in your browser.

### Access from iOS

1. Make sure your computer and iPhone are on the same Wi-Fi network
2. Find your computer's local IP (e.g., `192.168.1.42`)
3. Open **http://192.168.1.42:5000** in Safari on your iPhone
4. Tap the **Share** button → **Add to Home Screen** to install it as an app

## CLI Usage

```bash
# Basic: resize a label image to 4x6" (default) and save as PDF
python -m label_resize_print.cli label.png

# Specify output file
python -m label_resize_print.cli label.png -o my_label.pdf

# Resize a PDF shipping label
python -m label_resize_print.cli shipping_label.pdf

# Use a different label size
python -m label_resize_print.cli label.png -s 4x8

# Custom size in inches
python -m label_resize_print.cli label.png -s 3.5x5

# Change DPI (default: 300)
python -m label_resize_print.cli label.png -d 150

# Change fit mode
python -m label_resize_print.cli label.png -f fill    # crop to fill
python -m label_resize_print.cli label.png -f stretch  # stretch to fit

# Extract a specific page from a multi-page PDF
python -m label_resize_print.cli labels.pdf -p 1
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `input` | Input image or PDF file | *(required)* |
| `-o, --output` | Output PDF path | `<input>_label.pdf` |
| `-s, --size` | Label size (`4x6`, `4x8`, `2x7`, `letter`, or custom `WxH`) | `4x6` |
| `-d, --dpi` | Output resolution | `300` |
| `-f, --fit` | Resize mode: `fit`, `fill`, or `stretch` | `fit` |
| `-p, --page` | PDF page to extract (0-indexed) | `0` |

## Supported Input Formats

- **Images:** PNG, JPG/JPEG, BMP, TIFF, WebP
- **PDF:** Single or multi-page PDF files

## Fit Modes

- **fit** — Scale to fit within the label, preserving aspect ratio. Adds white margins if needed.
- **fill** — Scale to fill the label, preserving aspect ratio. Crops any overflow.
- **stretch** — Stretch to exactly match the label size (may distort).

## Python API

```python
from label_resize_print import resize_label

output_path = resize_label("shipping_label.png", label_size="4x6")
print(f"Saved to {output_path}")
```
