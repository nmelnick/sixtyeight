import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(
  readFileSync(path.join(rootDir, "package.json"), "utf8"),
);

writeFileSync(
  path.join(rootDir, "src", "version.ts"),
  `export const VERSION = "${pkg.version}";\n`,
);
