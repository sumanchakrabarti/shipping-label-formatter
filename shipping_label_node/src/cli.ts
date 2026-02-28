#!/usr/bin/env node

/**
 * CLI for label-resize-print (Node.js version).
 *
 * Node.js port of shipping_label_py/label_resize_print/cli.py
 */

import { Command } from "commander";
import { DEFAULT_DPI, SUPPORTED_EXTS, resizeLabel } from "./core.js";
import type { FitMode } from "./core.js";

interface CliOptions {
  output?: string;
  dpi: string;
  fit: string;
  crop: boolean; // --no-crop sets this to false
}

const program = new Command();

program
  .name("label-resize-print")
  .description(
    "Resize shipping labels to 4×6 and output a 2-up landscape letter PDF.",
  )
  .argument(
    "<input>",
    `First label file (supported: ${[...SUPPORTED_EXTS].sort().join(", ")})`,
  )
  .argument("[input2]", "Optional second label file for the right side")
  .option("-o, --output <path>", "Output PDF path (default: <input>_label.pdf)")
  .option(
    "-d, --dpi <number>",
    `Output DPI (default: ${DEFAULT_DPI})`,
    String(DEFAULT_DPI),
  )
  .option(
    "-f, --fit <mode>",
    "Resize mode: fit | fill | stretch (default: fit)",
    "fit",
  )
  .option(
    "--no-crop",
    "Disable automatic cropping to the label's black border",
  )
  .action(
    async (
      input: string,
      input2: string | undefined,
      opts: CliOptions,
    ) => {
      try {
        const output = await resizeLabel({
          inputPath: input,
          outputPath: opts.output,
          inputPath2: input2,
          dpi: parseInt(opts.dpi, 10),
          fitMode: opts.fit as FitMode,
          autoCrop: opts.crop,
        });
        console.log(`Label saved to: ${output}`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exit(1);
      }
    },
  );

program.parse();
