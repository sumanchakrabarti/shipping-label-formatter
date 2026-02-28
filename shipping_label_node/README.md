# Shipping Label Formatter — Node.js (TypeScript)

A Node.js/TypeScript port of the Python shipping label formatter. Takes shipping label images or PDFs, auto-crops to the black border, resizes to 4×6, and outputs a print-ready 2-up landscape letter PDF (8.5×11").

## Features

- **Web UI** — drag-and-drop two labels, preview layout, download PDF
- **CLI** — process labels from the command line
- **Auto-crop** — detects the black border rectangle and crops to it (8 px outward padding)
- **2-up layout** — places 1 or 2 labels side-by-side on a landscape letter page
- **Fit modes** — Fit (white margins), Fill (crop excess), or Stretch
- **PDF input** — rasterises PDF labels via MuPDF (WASM)
- **PWA** — installable on iOS/Android home screens
- **Full TypeScript** — strict mode, exported types, declaration files

## Quick Start

```bash
yarn install
yarn start          # starts web server on http://localhost:3000
yarn dev            # starts with --watch for hot reload
```

## CLI Usage

```bash
yarn cli label1.png                          # one label
yarn cli label1.png label2.pdf               # two labels side-by-side
yarn cli label.png -o output.pdf --dpi 150   # custom output + DPI
yarn cli label.png --no-crop --fit fill       # skip auto-crop, fill mode
```

## Build & Type Check

```bash
yarn typecheck     # type-check without emitting
yarn build         # compile to dist/ (JS + declarations + source maps)
```

## Debugging in VS Code

Open the `shipping_label_node` folder in VS Code. The included `.vscode/launch.json` provides:

| Configuration              | Description                                  |
|---------------------------|----------------------------------------------|
| **Start Web Server**       | Launch the app with debugger attached         |
| **Start Web Server (Dev)** | Launch with `--watch` for hot reload + debug  |
| **Run CLI**                | Run the CLI (prompts for label file path)     |
| **Attach to Process**      | Attach to a running `yarn debug` process      |

To debug from the terminal: `yarn debug` starts the app with `--inspect` on port 9229, then use the **Attach to Process** configuration.

## Dependencies

| Package    | Purpose                          |
|------------|----------------------------------|
| `sharp`    | Image processing (crop, resize)  |
| `mupdf`    | PDF rasterisation (WASM, no native deps) |
| `pdf-lib`  | PDF creation                     |
| `express`  | Web server                       |
| `multer`   | File upload middleware            |
| `commander`| CLI argument parsing             |
| `tsx`      | TypeScript execution (dev)       |
| `typescript` | Type checking & compilation    |

## Environment Variables

| Variable | Default   | Description        |
|----------|-----------|--------------------|
| `PORT`   | `3000`    | Web server port    |
| `HOST`   | `0.0.0.0` | Web server host   |
