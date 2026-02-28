"""Command-line interface for label-resize-print."""

import argparse
import sys

from label_resize_print.core import (
    DEFAULT_DPI,
    SUPPORTED_EXTS,
    resize_label,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="label-resize-print",
        description="Resize shipping labels to 4x6 and output a 2-up landscape letter PDF.",
    )

    parser.add_argument(
        "input",
        help=f"First label file (supported: {', '.join(sorted(SUPPORTED_EXTS))})",
    )
    parser.add_argument(
        "input2",
        nargs="?",
        default=None,
        help="Optional second label file for the right side of the page",
    )
    parser.add_argument(
        "-o", "--output",
        help="Output PDF path (default: <input>_label.pdf)",
    )
    parser.add_argument(
        "-d", "--dpi",
        type=int,
        default=DEFAULT_DPI,
        help=f"Output DPI (default: {DEFAULT_DPI})",
    )
    parser.add_argument(
        "-f", "--fit",
        choices=["fit", "fill", "stretch"],
        default="fit",
        help="Resize mode: fit (preserve ratio, white margins), "
             "fill (preserve ratio, crop excess), "
             "stretch (ignore ratio). Default: fit",
    )
    parser.add_argument(
        "-p", "--page",
        type=int,
        default=0,
        help="For PDF input, page number to extract (0-indexed, default: 0)",
    )
    parser.add_argument(
        "--no-crop",
        action="store_true",
        default=False,
        help="Disable automatic cropping to the label's black border",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None):
    args = parse_args(argv)

    try:
        output = resize_label(
            input_path=args.input,
            output_path=args.output,
            input_path_2=args.input2,
            dpi=args.dpi,
            fit_mode=args.fit,
            page_num=args.page,
            auto_crop=not args.no_crop,
        )
        print(f"Label saved to: {output}")
    except (FileNotFoundError, ValueError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
