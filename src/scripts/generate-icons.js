/**
 * Generate simple PWA icons using sharp.
 * Run: node scripts/generate-icons.js
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

async function generateIcon(size) {
  // Blue square with white package emoji-style label
  const svg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#2563eb"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
          font-size="${size * 0.5}" font-family="Arial, sans-serif" fill="white">📦</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, `icon-${size}.png`));

  console.log(`Created icon-${size}.png`);
}

await generateIcon(192);
await generateIcon(512);
console.log("Done!");
