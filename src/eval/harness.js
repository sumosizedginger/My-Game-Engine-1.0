/**
 * My Game Engine 1.0 — A0 Evaluation Harness
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Orchestrates automated browser validation, machine-readable reporting,
 * deterministic capture, and diagnostic/telemetry collection.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRevisionInfo } from './revision.js';
import { runBrowserEvaluation } from './browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

/**
 * Extracts and categorizes diagnostic records.
 *
 * @param {Array<object>} records - Raw diagnostic records.
 * @returns {object} Categorized diagnostics report.
 */
export function processDiagnostics(records = []) {
  const fatal = records.filter((r) => r.severity === 'FATAL');
  const degrade = records.filter((r) => r.severity === 'DEGRADE');
  const quarantine = records.filter((r) => r.severity === 'QUARANTINE');
  const codes = Array.from(new Set(records.map((r) => r.code).filter(Boolean)));

  return {
    totalCount: records.length,
    fatalCount: fatal.length,
    degradeCount: degrade.length,
    quarantineCount: quarantine.length,
    codes,
    hasErrors: fatal.length > 0 || records.some((r) => r.severity === 'ERROR')
  };
}

/**
 * Checks if target server is ready to serve requests.
 */
async function isServerReady(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Ensures server is reachable, spawning a local Vite server if not already active.
 */
async function ensureServer(url) {
  if (await isServerReady(url)) {
    return { process: null };
  }

  const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const serverProcess = spawn(process.execPath, [viteBin, '--port', '5173', '--strictPort'], {
    cwd: rootDir,
    stdio: 'ignore'
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await isServerReady(url)) {
      return { process: serverProcess };
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  try {
    serverProcess.kill();
  } catch {}
  throw new Error(`Timeout waiting for local server at ${url}`);
}

/**
 * Runs a complete evaluation pass.
 *
 * @param {object} options
 * @param {string} [options.url='http://localhost:5173/?controlled=1'] - Evaluation URL.
 * @param {string} [options.captureName='phase0_boot_fixture'] - Capture identifier.
 * @param {object} [options.viewport={ width: 1280, height: 720 }] - Viewport size.
 * @param {string} [options.outputDir='artifacts'] - Directory to save reports and captures.
 * @returns {Promise<object>} Machine-readable evaluation report.
 */
export async function runEvaluation({
  url = 'http://localhost:5173/?controlled=1',
  captureName = 'phase0_boot_fixture',
  viewport = { width: 1280, height: 720 },
  outputDir = path.join(rootDir, 'artifacts')
} = {}) {
  const startTime = performance.now();

  // 1. Ensure server is active (reuses existing dev server or spawns transient server)
  const server = await ensureServer(url);

  try {
    // 2. Revision identity
    const revision = getRevisionInfo(rootDir);

    // 3. Automated browser evaluation
    const browserResult = await runBrowserEvaluation({
      url,
      viewport,
      captureScreenshot: true
    });

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    // 4. Diagnostics collection
    const rawDiagnostics = browserResult.bootProof?.diagnosticsRecords || [
      { severity: 'INFO', code: 'BOOT_INIT', subsystem: 'runtime' },
      { severity: 'INFO', code: 'BOOT_COMPLETE', subsystem: 'runtime' }
    ];
    const diagnostics = processDiagnostics(rawDiagnostics);

    // 5. Capture processing (deterministic hash and metadata)
    const captures = [];
    if (browserResult.screenshotBuffer) {
      const capturesDir = path.join(outputDir, 'captures');
      fs.mkdirSync(capturesDir, { recursive: true });

      const captureFilename = `${captureName}.png`;
      const capturePath = path.join(capturesDir, captureFilename);
      fs.writeFileSync(capturePath, browserResult.screenshotBuffer);

      const sha256 = crypto.createHash('sha256').update(browserResult.screenshotBuffer).digest('hex');

      captures.push({
        name: captureName,
        revision: revision.commit,
        viewport,
        format: 'png',
        outputPath: path.relative(rootDir, capturePath).replace(/\\/g, '/'),
        sha256,
        byteSize: browserResult.screenshotBuffer.length
      });
    }

    // 6. Verification checks
    const checks = {
      boot: browserResult.httpStatus === 200 && Boolean(browserResult.bootProof),
      runtimeMode: Boolean(browserResult.bootProof?.checks?.runtimeBoot),
      fullEngineSeam: Boolean(browserResult.bootProof?.checks?.fullEngineSeam),
      purity: Boolean(browserResult.bootProof?.checks?.purityCheck),
      noConsoleErrors: browserResult.consoleErrors.length === 0,
      noPageErrors: browserResult.pageErrors.length === 0,
      noFailedRequests: browserResult.failedRequests.length === 0,
      domStatusPass: browserResult.domDetails?.bootStatus === 'PASS'
    };

    const status = Object.values(checks).every(Boolean) && !diagnostics.hasErrors ? 'PASS' : 'FAIL';

    // 7. Minimal telemetry
    const telemetry = {
      bootSuccess: checks.boot,
      evaluationDurationMs: durationMs,
      diagnosticCount: diagnostics.totalCount,
      captureCount: captures.length,
      failedRequestCount: browserResult.failedRequests.length,
      consoleErrorCount: browserResult.consoleErrors.length,
      pageErrorCount: browserResult.pageErrors.length
    };

    const report = {
      schemaVersion: '1.0.0',
      harness: 'A0-Evaluation-Harness',
      status,
      timestamp: new Date().toISOString(),
      revision,
      checks,
      diagnostics,
      telemetry,
      captures,
      browserDetails: {
        url,
        httpStatus: browserResult.httpStatus,
        dom: browserResult.domDetails,
        consoleErrors: browserResult.consoleErrors,
        consoleWarnings: browserResult.consoleWarnings,
        pageErrors: browserResult.pageErrors,
        failedRequests: browserResult.failedRequests
      }
    };

    // Save report artifact
    fs.mkdirSync(outputDir, { recursive: true });
    const reportPath = path.join(outputDir, 'evaluation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    return report;
  } finally {
    if (server.process) {
      try {
        server.process.kill();
      } catch {}
    }
  }
}
