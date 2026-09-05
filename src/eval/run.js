/**
 * My Game Engine 1.0 — A0 Evaluation CLI
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Command-line entry point for running the A0 Evaluation Harness.
 */

import { runEvaluation } from './harness.js';

async function main() {
  console.log('--- My Game Engine 1.0 : A0 Evaluation Harness ---');
  try {
    const report = await runEvaluation();
    console.log(JSON.stringify({
      status: report.status,
      revision: report.revision,
      checks: report.checks,
      diagnostics: report.diagnostics,
      telemetry: report.telemetry,
      captures: report.captures
    }, null, 2));

    if (report.status === 'PASS') {
      console.log('\n✔ A0 Evaluation PASSED.');
      process.exit(0);
    } else {
      console.error('\n✖ A0 Evaluation FAILED.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✖ Fatal evaluation harness error:', error.message);
    process.exit(1);
  }
}

main();
