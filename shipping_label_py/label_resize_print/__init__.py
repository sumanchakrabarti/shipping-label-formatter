"""
Label Resize & Print

Accepts a shipping label (image or PDF), resizes it to standard label
dimensions, and outputs a print-ready PDF.

Works as a web app (desktop + iOS) or CLI tool.
"""

from label_resize_print.core import resize_label, load_image_from_pdf

__all__ = ["resize_label", "load_image_from_pdf"]
