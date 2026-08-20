import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required for the production PDF worker gate.");

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCliPath, ...args], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });
}

await runNpm(["run", "build"]);

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeEntry = path.join(
  rootDirectory,
  ".next",
  "server",
  "app",
  "(app)",
  "sets",
  "create",
  "page.js",
);
const tracePath = `${runtimeEntry}.nft.json`;
const trace = JSON.parse(await readFile(tracePath, "utf8"));
const workerEntry = trace.files.find((file) =>
  /node_modules[\\/]pdf-parse[\\/]dist[\\/]worker[\\/](?:esm[\\/]index\.js|cjs[\\/]index\.cjs)$/.test(
    file,
  ),
);

assert.ok(
  workerEntry,
  "The traced /sets/create import runtime must include pdf-parse's supported worker entry.",
);

const runtimeRequire = createRequire(runtimeEntry);
const { PDFParse } = runtimeRequire("pdf-parse");
const workerRuntime = runtimeRequire("pdf-parse/worker");
const workerData = workerRuntime.getData();

assert.equal(typeof workerData, "string");
assert.ok(workerData.startsWith("data:text/javascript;base64,"));
assert.equal(PDFParse.setWorker(workerData), workerData);

const fixturePath = path.join(rootDirectory, "tests", "fixtures", "documents", "minimal.pdf");
const data = new Uint8Array(await readFile(fixturePath));
const parser = new PDFParse({ data, verbosity: 0 });
let destroyed = false;

try {
  const info = await parser.getInfo();
  const text = await parser.getText({ first: 200 });

  assert.equal(info.total, 1);
  assert.equal(text.pages.length, 1);
  assert.ok(text.pages[0]?.text.includes("He dieu hanh"));
} finally {
  await parser.destroy();
  destroyed = true;
}

assert.equal(destroyed, true);
console.log(
  JSON.stringify({
    tracedWorkerEntry: workerEntry.replaceAll("\\", "/"),
    workerConfigured: true,
    documentLoaded: true,
    textExtracted: true,
    parserDestroyed: destroyed,
  }),
);
