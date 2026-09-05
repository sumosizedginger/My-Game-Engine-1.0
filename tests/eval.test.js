import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRevisionInfo } from '../src/eval/revision.js';
import { processDiagnostics, runEvaluation } from '../src/eval/harness.js';
import { compareEvaluationResults } from '../src/eval/compare.js';
import { runBrowserEvaluation } from '../src/eval/browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('revision identity extracts local git commit, branch, and status without network', () => {
  const rev = getRevisionInfo(rootDir);

  assert.ok(rev.commit, 'Should have commit SHA');
  assert.match(rev.commit, /^[0-9a-f]{40}$/, 'Commit SHA must be a 40-character hex string');
  assert.ok(typeof rev.branch === 'string' && rev.branch.length > 0, 'Branch must be a non-empty string');
  assert.equal(typeof rev.clean, 'boolean', 'Clean status must be a boolean');
});

test('structured diagnostic processing correctly classifies severities and extracts codes', () => {
  const cleanRecords = [
    { severity: 'INFO', code: 'BOOT_INIT', subsystem: 'runtime' },
    { severity: 'INFO', code: 'BOOT_COMPLETE', subsystem: 'runtime' },
    { severity: 'WARN', code: 'MEM_HIGH', subsystem: 'memory' }
  ];

  const cleanResult = processDiagnostics(cleanRecords);
  assert.equal(cleanResult.totalCount, 3);
  assert.equal(cleanResult.fatalCount, 0);
  assert.equal(cleanResult.degradeCount, 0);
  assert.equal(cleanResult.quarantineCount, 0);
  assert.deepEqual(cleanResult.codes, ['BOOT_INIT', 'BOOT_COMPLETE', 'MEM_HIGH']);
  assert.equal(cleanResult.hasErrors, false);

  const errorRecords = [
    { severity: 'FATAL', code: 'CORE_PANIC', subsystem: 'runtime' },
    { severity: 'DEGRADE', code: 'RENDER_FALLBACK', subsystem: 'renderer' },
    { severity: 'QUARANTINE', code: 'SCRIPT_TIMEOUT', subsystem: 'script' }
  ];

  const errorResult = processDiagnostics(errorRecords);
  assert.equal(errorResult.fatalCount, 1);
  assert.equal(errorResult.degradeCount, 1);
  assert.equal(errorResult.quarantineCount, 1);
  assert.equal(errorResult.hasErrors, true);
});

test('A0 evaluation harness produces complete machine-readable report with captures', async () => {
  const report = await runEvaluation({
    url: 'http://localhost:5173/?controlled=1',
    captureName: 'test_phase0_fixture'
  });

  assert.equal(report.schemaVersion, '1.0.0');
  assert.equal(report.harness, 'A0-Evaluation-Harness');
  assert.equal(report.status, 'PASS');

  // Verify revision
  assert.ok(report.revision?.commit);
  assert.match(report.revision.commit, /^[0-9a-f]{40}$/);

  // Verify checks
  assert.equal(report.checks.boot, true);
  assert.equal(report.checks.runtimeMode, true);
  assert.equal(report.checks.fullEngineSeam, true);
  assert.equal(report.checks.purity, true);
  assert.equal(report.checks.noConsoleErrors, true);
  assert.equal(report.checks.noPageErrors, true);
  assert.equal(report.checks.noFailedRequests, true);
  assert.equal(report.checks.domStatusPass, true);

  // Verify telemetry
  assert.equal(report.telemetry.bootSuccess, true);
  assert.ok(typeof report.telemetry.evaluationDurationMs === 'number');
  assert.equal(report.telemetry.captureCount, 1);
  assert.equal(report.telemetry.consoleErrorCount, 0);

  // Verify captures
  assert.ok(Array.isArray(report.captures));
  assert.equal(report.captures.length, 1);
  const capture = report.captures[0];
  assert.equal(capture.name, 'test_phase0_fixture');
  assert.match(capture.sha256, /^[0-9a-f]{64}$/);
  assert.ok(capture.byteSize > 0);

  // Verify capture file written to disk
  const captureFilePath = path.join(rootDir, capture.outputPath);
  assert.ok(fs.existsSync(captureFilePath), 'Screenshot file must exist on disk');
  const diskBytes = fs.readFileSync(captureFilePath);
  assert.equal(diskBytes.length, capture.byteSize);
});

test('repeated evaluation runs demonstrate deterministic repeatability and result comparison', async () => {
  const runA = await runEvaluation({
    url: 'http://localhost:5173/?controlled=1',
    captureName: 'repeatability_test_fixture'
  });

  const runB = await runEvaluation({
    url: 'http://localhost:5173/?controlled=1',
    captureName: 'repeatability_test_fixture'
  });

  const comparison = compareEvaluationResults(runA, runB);
  assert.equal(comparison.matches, true, `Runs must match: ${comparison.differences.join('; ')}`);
  assert.equal(comparison.differences.length, 0);

  // Verify capture hash is bit-for-bit identical
  assert.equal(runA.captures[0].sha256, runB.captures[0].sha256);
  assert.equal(runA.captures[0].byteSize, runB.captures[0].byteSize);
});

test('compareEvaluationResults reliably detects status and check discrepancies', () => {
  const base = {
    status: 'PASS',
    revision: { commit: 'abc1234567890123456789012345678901234567' },
    checks: { boot: true, purity: true },
    diagnostics: { fatalCount: 0, codes: ['BOOT_INIT'], hasErrors: false },
    captures: [{ name: 'cap1', sha256: 'hash1', viewport: { width: 800, height: 600 } }],
    telemetry: { bootSuccess: true, diagnosticCount: 1, failedRequestCount: 0, consoleErrorCount: 0, pageErrorCount: 0 }
  };

  const modified = {
    ...base,
    checks: { boot: true, purity: false }
  };

  const comp = compareEvaluationResults(base, modified);
  assert.equal(comp.matches, false);
  assert.ok(comp.differences.some((d) => d.includes('Check mismatch for "purity"')));
});

test('browser evaluation failure behavior reports error on unreachable destination', async () => {
  // Use invalid port where nothing is listening
  await assert.rejects(
    () =>
      runBrowserEvaluation({
        url: 'http://127.0.0.1:59999/',
        timeout: 1000
      }),
    /net::ERR_CONNECTION_REFUSED|TimeoutError|timed out/
  );
});
