import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(projectRoot, "node_modules", "@pdftron", "webviewer", "public");
const destination = join(projectRoot, "public", "apryse");

if (!existsSync(source)) {
  console.warn("Apryse assets were not copied because @pdftron/webviewer is not installed.");
  process.exit(0);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
console.log("Copied Apryse WebViewer assets to public/apryse.");
