export {}; // force module scope

// Runs every scripts/test-*.ts script in one shot and reports a combined
// pass/fail summary. Intended to run at the end of each PR/commit (see
// .github/workflows/regression.yml) so a change that breaks previously-fixed
// behavior gets flagged before it merges, not after.
//
// These are plain pure-function scripts (no test framework, no database) by
// design - see the "Testing" section in README.md for why, and add a new
// test-*.ts here (plus a require in TEST_SCRIPTS below) whenever you fix a
// bug or add logic worth protecting against regression.

import { execFileSync } from "node:child_process";
import path from "node:path";

const TEST_SCRIPTS = [
  "test-order-parsing.ts",
  "test-billing-math.ts",
  "test-line-total.ts",
  "test-cross-tenant-isolation.ts",
  "test-error-extraction.ts",
  "test-order-categories.ts",
  "test-ledger-overdue.ts",
];

let failedScripts: string[] = [];
// Invoke tsx's CLI directly via `node` rather than shelling out to `npx` -
// sidesteps Windows requiring cmd.exe to resolve npx.cmd, and needing
// shell:true (which node flags as a footgun even with static args).
const tsxCli = require.resolve("tsx/cli");

for (const script of TEST_SCRIPTS) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n=== ${script} ===`);
  try {
    const output = execFileSync(process.execPath, [tsxCli, scriptPath], { encoding: "utf-8", stdio: "pipe" });
    process.stdout.write(output);
  } catch (err: any) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    failedScripts.push(script);
  }
}

console.log("\n===================================");
if (failedScripts.length === 0) {
  console.log(`✅ All ${TEST_SCRIPTS.length} regression scripts passed.`);
} else {
  console.log(`❌ ${failedScripts.length}/${TEST_SCRIPTS.length} regression scripts FAILED: ${failedScripts.join(", ")}`);
  process.exit(1);
}
