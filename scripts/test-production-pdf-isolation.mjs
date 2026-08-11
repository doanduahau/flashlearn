import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required for the production PDF isolation gate.");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeBlocker = path.join(scriptDirectory, "block-pdf-runtime.cjs");
const inheritedNodeOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [inheritedNodeOptions, `--require=${runtimeBlocker}`].filter(Boolean).join(" ");

const child = spawn(
  process.execPath,
  [npmCliPath, "run", "test:e2e", "--", "tests/e2e/pdf-runtime-isolation.spec.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      FLASHLEARN_E2E_BLOCK_PDF_RUNTIME: "1",
      NODE_OPTIONS: nodeOptions,
    },
  },
);

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
