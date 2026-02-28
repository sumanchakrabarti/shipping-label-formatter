"""Flask web application for label resizing."""

import os
import tempfile

from flask import Flask, render_template, request, send_file, jsonify

from label_resize_print.core import (
    SUPPORTED_EXTS,
    DEFAULT_DPI,
    resize_label,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB max upload


@app.route("/")
def index():
    return render_template(
        "index.html",
        default_dpi=DEFAULT_DPI,
    )


@app.route("/resize", methods=["POST"])
def resize():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTS:
        return jsonify({
            "error": f"Unsupported format '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTS))}"
        }), 400

    dpi = int(request.form.get("dpi", DEFAULT_DPI))
    fit_mode = request.form.get("fit", "fit")
    page_num = int(request.form.get("page", 0))
    auto_crop = request.form.get("auto_crop", "true").lower() == "true"
    label_size = request.form.get("label_size", "4x6")

    tmp_dir = tempfile.mkdtemp()
    input_path = os.path.join(tmp_dir, f"input{ext}")
    output_path = os.path.join(tmp_dir, "label_output.pdf")

    # Check for optional second file
    input_path_2 = None
    file2 = request.files.get("file2")
    if file2 and file2.filename:
        ext2 = os.path.splitext(file2.filename)[1].lower()
        if ext2 in SUPPORTED_EXTS:
            input_path_2 = os.path.join(tmp_dir, f"input2{ext2}")
            file2.save(input_path_2)

    try:
        file.save(input_path)
        resize_label(
            input_path=input_path,
            output_path=output_path,
            input_path_2=input_path_2,
            dpi=dpi,
            fit_mode=fit_mode,
            page_num=page_num,
            auto_crop=auto_crop,
            label_size=label_size,
        )

        base_name = os.path.splitext(file.filename)[0]
        return send_file(
            output_path,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{base_name}_label.pdf",
        )
    except (FileNotFoundError, ValueError) as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Processing failed: {e}"}), 500


@app.route("/manifest.json")
def manifest():
    return jsonify({
        "name": "Label Resize & Print",
        "short_name": "LabelPrint",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#2563eb",
        "icons": [
            {
                "src": "/static/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
            },
            {
                "src": "/static/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
            },
        ],
    })


def run(host="0.0.0.0", port=5000, debug=False):
    """Start the web server."""
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    run(debug=True)
