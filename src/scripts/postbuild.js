/**
 * Post-build script: copies public assets and a production package.json
 * into dist/ so it's self-contained and ready to deploy.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

// --- Copy public/ → dist/public/ ---
const publicSrc = path.join(root, "public");
const publicDst = path.join(dist, "public");

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

if (fs.existsSync(publicSrc)) {
  copyDirSync(publicSrc, publicDst);
  console.log("✔ Copied public/ → dist/public/");
}

// --- Generate production package.json in dist/ ---
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  type: pkg.type,
  main: "app.js",
  scripts: {
    start: "node app.js",
  },
  dependencies: pkg.dependencies,
};
fs.writeFileSync(
  path.join(dist, "package.json"),
  JSON.stringify(prodPkg, null, 2) + "\n",
);
console.log("✔ Generated dist/package.json");

// --- Copy .deployment for Azure App Service ---
const deployment = `[config]\nSCM_DO_BUILD_DURING_DEPLOYMENT=true\n`;
fs.writeFileSync(path.join(dist, ".deployment"), deployment);
console.log("✔ Generated dist/.deployment");
