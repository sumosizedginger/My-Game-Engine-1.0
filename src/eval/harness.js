/**
 * My Game Engine 1.0 — A0 Evaluation Harness (Extended for Proof A)
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Orchestrates automated browser validation, machine-readable reporting,
 * deterministic capture, and diagnostic/telemetry collection.
 * Evaluates both Phase 0 Boot Proof and Proof A Pong Game.
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
 * Saves a screenshot buffer as a deterministic capture record.
 */
function saveCapture(outputDir, captureName, revisionCommit, viewport, buffer) {
  const capturesDir = path.join(outputDir, 'captures');
  fs.mkdirSync(capturesDir, { recursive: true });

  const captureFilename = `${captureName}.png`;
  const capturePath = path.join(capturesDir, captureFilename);
  fs.writeFileSync(capturePath, buffer);

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    name: captureName,
    revision: revisionCommit,
    viewport,
    format: 'png',
    outputPath: path.relative(rootDir, capturePath).replace(/\\/g, '/'),
    sha256,
    byteSize: buffer.length
  };
}

/**
 * Runs evaluation on target(s).
 *
 * @param {object} [options={}]
 * @param {string} [options.url] - Specific evaluation URL. If omitted, evaluates full suite (Phase 0 + Proof A).
 * @param {string} [options.captureName] - Specific capture name.
 * @param {object} [options.viewport={ width: 1280, height: 720 }] - Viewport size.
 * @param {string} [options.outputDir='artifacts'] - Artifacts directory.
 * @returns {Promise<object>} Evaluation report.
 */
export async function runEvaluation(options = {}) {
  const startTime = performance.now();
  const isCustomSingleTarget = Boolean(options.url || options.captureName);

  const phase0Url = options.url || 'http://localhost:5173/?controlled=1';
  const viewport = options.viewport || { width: 1280, height: 720 };
  const outputDir = options.outputDir || path.join(rootDir, 'artifacts');

  // 1. Ensure server is active
  const server = await ensureServer(phase0Url);

  try {
    // 2. Revision identity
    const revision = getRevisionInfo(rootDir);
    const captures = [];

    // 3. Evaluate primary target (Phase 0 Boot Proof or custom URL)
    const browserResult = await runBrowserEvaluation({
      url: phase0Url,
      viewport,
      captureScreenshot: true
    });

    if (browserResult.screenshotBuffer) {
      const capName = options.captureName || (phase0Url.includes('game=pong') ? 'proof_a_pong_fixture' : 'phase0_boot_fixture');
      captures.push(saveCapture(outputDir, capName, revision.commit, viewport, browserResult.screenshotBuffer));
    }

    // Baseline checks
    const checks = {
      boot: browserResult.httpStatus === 200 && (Boolean(browserResult.bootProof) || Boolean(browserResult.pongProof)),
      runtimeMode: browserResult.bootProof ? Boolean(browserResult.bootProof.checks?.runtimeBoot) : true,
      fullEngineSeam: browserResult.bootProof ? Boolean(browserResult.bootProof.checks?.fullEngineSeam) : true,
      purity: browserResult.bootProof ? Boolean(browserResult.bootProof.checks?.purityCheck) : true,
      noConsoleErrors: browserResult.consoleErrors.length === 0,
      noPageErrors: browserResult.pageErrors.length === 0,
      noFailedRequests: browserResult.failedRequests.length === 0,
      domStatusPass: browserResult.bootProof ? browserResult.domDetails?.bootStatus === 'PASS' : true
    };

    let allConsoleErrors = [...browserResult.consoleErrors];
    let allPageErrors = [...browserResult.pageErrors];
    let allFailedRequests = [...browserResult.failedRequests];

    let rawDiagnostics = browserResult.bootProof?.diagnosticsRecords || [
      { severity: 'INFO', code: 'BOOT_INIT', subsystem: 'runtime' },
      { severity: 'INFO', code: 'BOOT_COMPLETE', subsystem: 'runtime' }
    ];

    // 4. If running standard full suite, also evaluate Proof A Pong
    if (!isCustomSingleTarget) {
      const pongUrl = 'http://localhost:5173/?game=pong&controlled=1';
      const pongResult = await runBrowserEvaluation({
        url: pongUrl,
        viewport,
        captureScreenshot: true
      });

      if (pongResult.screenshotBuffer) {
        captures.push(saveCapture(outputDir, 'proof_a_pong_fixture', revision.commit, viewport, pongResult.screenshotBuffer));
      }

      checks.pongBoot = pongResult.httpStatus === 200 && Boolean(pongResult.pongProof);
      checks.pongGameplay = Boolean(pongResult.pongProof?.checks?.movedUp && pongResult.pongProof?.checks?.inPlaying);
      checks.pongScoring = Boolean(pongResult.pongProof?.checks?.scoredPoint && pongResult.pongProof?.checks?.domScoreUpdated);

      if (pongResult.consoleErrors.length > 0) checks.noConsoleErrors = false;
      if (pongResult.pageErrors.length > 0) checks.noPageErrors = false;
      if (pongResult.failedRequests.length > 0) checks.noFailedRequests = false;

      allConsoleErrors.push(...pongResult.consoleErrors);
      allPageErrors.push(...pongResult.pageErrors);
      allFailedRequests.push(...pongResult.failedRequests);

      if (pongResult.pongProof?.diagnosticsRecords) {
        rawDiagnostics.push(...pongResult.pongProof.diagnosticsRecords);
      }
    } else if (phase0Url.includes('game=pong') && browserResult.pongProof) {
      checks.pongBoot = true;
      checks.pongGameplay = Boolean(browserResult.pongProof.checks?.movedUp && browserResult.pongProof.checks?.inPlaying);
      checks.pongScoring = Boolean(browserResult.pongProof.checks?.scoredPoint && browserResult.pongProof.checks?.domScoreUpdated);
      if (browserResult.pongProof.diagnosticsRecords) {
        rawDiagnostics.push(...browserResult.pongProof.diagnosticsRecords);
      }
    }

    const diagnostics = processDiagnostics(rawDiagnostics);
    const status = Object.values(checks).every(Boolean) && !diagnostics.hasErrors ? 'PASS' : 'FAIL';
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    const telemetry = {
      bootSuccess: checks.boot,
      evaluationDurationMs: durationMs,
      diagnosticCount: diagnostics.totalCount,
      captureCount: captures.length,
      failedRequestCount: allFailedRequests.length,
      consoleErrorCount: allConsoleErrors.length,
      pageErrorCount: allPageErrors.length
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
        url: isCustomSingleTarget ? phase0Url : 'http://localhost:5173/ (Full Suite: Phase 0 + Proof A)',
        httpStatus: browserResult.httpStatus,
        dom: browserResult.domDetails,
        consoleErrors: allConsoleErrors,
        pageErrors: allPageErrors,
        failedRequests: allFailedRequests
      }
    };

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

/**
 * Convenience helper to evaluate Proof A Pong specifically.
 */
export async function runProofAEvaluation(options = {}) {
  return runEvaluation({
    url: 'http://localhost:5173/?game=pong&controlled=1',
    captureName: 'proof_a_pong_fixture',
    ...options
  });
}
