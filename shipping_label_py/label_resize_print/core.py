"""Core image processing and PDF generation logic."""

import os
from PIL import Image, ImageFilter, ImageOps
import fitz  # PyMuPDF
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


# Common label sizes in inches (width, height)
LABEL_SIZES = {
    "4x6": (4, 6),
    "4x8": (4, 8),
    "2x7": (2, 7),
    "letter": (8.5, 11),
}

DEFAULT_LABEL_SIZE = "4x6"
DEFAULT_DPI = 300

SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif", ".webp"}
SUPPORTED_PDF_EXTS = {".pdf"}
SUPPORTED_EXTS = SUPPORTED_IMAGE_EXTS | SUPPORTED_PDF_EXTS


def load_image(input_path: str) -> Image.Image:
    """Load an image from a file path. Supports common image formats and PDF."""
    ext = os.path.splitext(input_path)[1].lower()

    if ext in SUPPORTED_IMAGE_EXTS:
        return Image.open(input_path).convert("RGB")
    elif ext in SUPPORTED_PDF_EXTS:
        return load_image_from_pdf(input_path)
    else:
        raise ValueError(
            f"Unsupported file format '{ext}'. "
            f"Supported formats: {', '.join(sorted(SUPPORTED_EXTS))}"
        )


def load_image_from_pdf(pdf_path: str, page_num: int = 0, dpi: int = DEFAULT_DPI) -> Image.Image:
    """Extract a page from a PDF as a PIL Image.

    Args:
        pdf_path: Path to the PDF file.
        page_num: Page number to extract (0-indexed).
        dpi: Resolution for rasterizing the PDF page.

    Returns:
        PIL Image of the extracted page.
    """
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        raise ValueError(
            f"Page {page_num} does not exist. PDF has {len(doc)} page(s)."
        )

    page = doc[page_num]
    zoom = dpi / 72  # PDF default is 72 DPI
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    doc.close()
    return img


def auto_crop_label(img: Image.Image, border_threshold: int = 80, min_area_ratio: float = 0.05) -> Image.Image:
    """Detect and crop to the shipping label's black border rectangle.

    Converts to grayscale, thresholds to find dark (black border) pixels,
    then finds the bounding box of the largest rectangular region.

    Args:
        img: Source PIL Image.
        border_threshold: Pixel brightness below which is considered "black" (0-255).
        min_area_ratio: Minimum fraction of image area for a valid label region.

    Returns:
        Cropped PIL Image containing just the label.
    """
    gray = img.convert("L")
    w, h = gray.size

    # Create binary mask: black pixels (border) = white in mask
    binary = gray.point(lambda p: 255 if p < border_threshold else 0)

    # Find bounding box of all dark pixels — this captures the outer border
    bbox = binary.getbbox()
    if bbox is None:
        return img  # No dark pixels found, return original

    bx0, by0, bx1, by1 = bbox
    box_w = bx1 - bx0
    box_h = by1 - by0

    # Sanity check: the detected region should be a meaningful portion of the image
    if (box_w * box_h) < (w * h * min_area_ratio):
        return img

    # Now scan inward from each edge of the bounding box to find the inner
    # content boundary (skip past the solid black border lines).
    # We look for the first row/column that is mostly non-black.

    def row_is_border(y: int, x0: int, x1: int) -> bool:
        """Check if a row within the bbox is mostly dark (part of the border)."""
        row_pixels = list(gray.crop((x0, y, x1, y + 1)).getdata())
        dark_count = sum(1 for p in row_pixels if p < border_threshold)
        return dark_count > len(row_pixels) * 0.5

    def col_is_border(x: int, y0: int, y1: int) -> bool:
        """Check if a column within the bbox is mostly dark (part of the border)."""
        col_pixels = list(gray.crop((x, y0, x + 1, y1)).getdata())
        dark_count = sum(1 for p in col_pixels if p < border_threshold)
        return dark_count > len(col_pixels) * 0.5

    # Scan from top
    top = by0
    for y in range(by0, by0 + min(box_h // 2, 100)):
        if not row_is_border(y, bx0, bx1):
            top = y
            break

    # Scan from bottom
    bottom = by1
    for y in range(by1 - 1, by1 - min(box_h // 2, 100), -1):
        if not row_is_border(y, bx0, bx1):
            bottom = y + 1
            break

    # Scan from left
    left = bx0
    for x in range(bx0, bx0 + min(box_w // 2, 100)):
        if not col_is_border(x, by0, by1):
            left = x
            break

    # Scan from right
    right = bx1
    for x in range(bx1 - 1, bx1 - min(box_w // 2, 100), -1):
        if not col_is_border(x, by0, by1):
            right = x + 1
            break

    # Expand outward so a bit of the border remains visible
    pad = 8
    left = max(left - pad, 0)
    top = max(top - pad, 0)
    right = min(right + pad, w)
    bottom = min(bottom + pad, h)

    cropped = img.crop((left, top, right, bottom))
    return cropped


def resize_image(
    img: Image.Image,
    label_size: tuple[float, float],
    dpi: int = DEFAULT_DPI,
    fit_mode: str = "fit",
) -> Image.Image:
    """Resize an image to fit the target label dimensions.

    Args:
        img: Source PIL Image.
        label_size: Target size as (width_inches, height_inches).
        dpi: Output resolution in dots per inch.
        fit_mode: How to handle aspect ratio mismatch.
            - "fit": Scale to fit within label, preserving aspect ratio (may have white margins).
            - "fill": Scale to fill the label, cropping excess.
            - "stretch": Stretch to exactly match label dimensions.

    Returns:
        Resized PIL Image at the target DPI.
    """
    target_w = int(label_size[0] * dpi)
    target_h = int(label_size[1] * dpi)

    if fit_mode == "stretch":
        return img.resize((target_w, target_h), Image.LANCZOS)

    src_w, src_h = img.size
    scale_w = target_w / src_w
    scale_h = target_h / src_h

    if fit_mode == "fill":
        scale = max(scale_w, scale_h)
        new_w = int(src_w * scale)
        new_h = int(src_h * scale)
        resized = img.resize((new_w, new_h), Image.LANCZOS)
        # Center crop
        left = (new_w - target_w) // 2
        top = (new_h - target_h) // 2
        return resized.crop((left, top, left + target_w, top + target_h))

    # Default: "fit" — scale to fit within bounds, centered on white background
    scale = min(scale_w, scale_h)
    new_w = int(src_w * scale)
    new_h = int(src_h * scale)
    resized = img.resize((new_w, new_h), Image.LANCZOS)

    result = Image.new("RGB", (target_w, target_h), (255, 255, 255))
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    result.paste(resized, (paste_x, paste_y))
    return result


def save_pdf(img: Image.Image, output_path: str, label_size: tuple[float, float]):
    """Save a PIL Image as a print-ready PDF.

    Args:
        img: The resized label image.
        output_path: Destination file path for the PDF.
        label_size: Label dimensions in inches (width, height).
    """
    page_w = label_size[0] * inch
    page_h = label_size[1] * inch

    # Save image to a temporary file for ReportLab
    temp_img_path = output_path + ".tmp.png"
    img.save(temp_img_path, "PNG")

    try:
        c = canvas.Canvas(output_path, pagesize=(page_w, page_h))
        c.drawImage(temp_img_path, 0, 0, width=page_w, height=page_h)
        c.showPage()
        c.save()
    finally:
        if os.path.exists(temp_img_path):
            os.remove(temp_img_path)


# Landscape letter page: 11" wide × 8.5" tall (standard US letter rotated)
PAGE_WIDTH_IN = 11.0
PAGE_HEIGHT_IN = 8.5
LABEL_W_IN = 4.0
LABEL_H_IN = 6.0


def save_pdf_2up(
    images: list[Image.Image],
    output_path: str,
    dpi: int = DEFAULT_DPI,
):
    """Save one or two label images onto a landscape letter page, side by side.

    Each label is centered in its half of the page (left or right).
    If one image is provided, it goes on the left half.
    If two images are provided, the second goes on the right half.

    Args:
        images: List of 1 or 2 resized label PIL Images.
        output_path: Destination file path for the PDF.
        dpi: Resolution used for the images.
    """
    page_w = PAGE_WIDTH_IN * inch
    page_h = PAGE_HEIGHT_IN * inch
    label_w = LABEL_W_IN * inch
    label_h = LABEL_H_IN * inch

    half_w = page_w / 2

    # Center each label vertically and horizontally within its half
    x_offset_left = (half_w - label_w) / 2
    x_offset_right = half_w + (half_w - label_w) / 2
    y_offset = (page_h - label_h) / 2

    temp_files = []
    try:
        c = canvas.Canvas(output_path, pagesize=(page_w, page_h))

        for i, img in enumerate(images[:2]):
            tmp = output_path + f".tmp{i}.png"
            img.save(tmp, "PNG")
            temp_files.append(tmp)

            x = x_offset_left if i == 0 else x_offset_right
            c.drawImage(tmp, x, y_offset, width=label_w, height=label_h)

        c.showPage()
        c.save()
    finally:
        for tmp in temp_files:
            if os.path.exists(tmp):
                os.remove(tmp)


def _prepare_label(
    input_path: str,
    dpi: int = DEFAULT_DPI,
    fit_mode: str = "fit",
    auto_crop: bool = True,
    page_num: int = 0,
) -> Image.Image:
    """Load, auto-crop, and resize a single label image."""
    img = load_image(input_path)
    if auto_crop:
        img = auto_crop_label(img)
    return resize_image(img, (LABEL_W_IN, LABEL_H_IN), dpi=dpi, fit_mode=fit_mode)


def resize_label(
    input_path: str,
    output_path: str | None = None,
    input_path_2: str | None = None,
    dpi: int = DEFAULT_DPI,
    fit_mode: str = "fit",
    page_num: int = 0,
    auto_crop: bool = True,
    **_ignored,
) -> str:
    """Load one or two shipping labels, resize to 4x6, and save as a 2-up
    landscape letter PDF (11 × 8.5 in) with labels side by side.

    Args:
        input_path: Path to the first label image or PDF.
        output_path: Path for the output PDF. Defaults to input name + '_label.pdf'.
        input_path_2: Optional path to a second label for the right side.
        dpi: Output resolution in dots per inch.
        fit_mode: Resize strategy — 'fit', 'fill', or 'stretch'.
        page_num: For PDF inputs, which page to extract (0-indexed).
        auto_crop: If True, detect and crop to the label's black border.

    Returns:
        Path to the generated output PDF.
    """
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if input_path_2 and not os.path.isfile(input_path_2):
        raise FileNotFoundError(f"Second input file not found: {input_path_2}")

    # Default output path
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_label.pdf"

    # Prepare label(s)
    labels = [_prepare_label(input_path, dpi, fit_mode, auto_crop, page_num)]
    if input_path_2:
        labels.append(_prepare_label(input_path_2, dpi, fit_mode, auto_crop, page_num))

    save_pdf_2up(labels, output_path, dpi=dpi)
    return output_path
