/**
 * My Game Engine 1.0 — Evaluation Harness (Extended for Proof A & Proof B1)
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Orchestrates automated browser validation, machine-readable reporting,
 * deterministic capture, and diagnostic/telemetry collection.
 * Evaluates Phase 0 Boot Proof, Proof A Pong Game, and Proof B1 Motion Truth.
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRevisionInfo } from './revision.js';
import { runBrowserEvaluation } from './browser.js';
import { cTargetChecks } from './c-checks.js';
import { dTargetChecks } from './d-checks.js';
import { sceneTargetChecks } from './scene-checks.js';

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
export async function ensureServer(url) {
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
 * @param {string} [options.url] - Specific evaluation URL. If omitted, evaluates full suite (Phase 0 + Proof A + Proof B1).
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
      let capName = options.captureName;
      if (!capName) {
        if (phase0Url.includes('proof=d')) capName = 'proof_d_racing_fixture';
        else if (phase0Url.includes('proof=c')) capName = 'proof_c_world_fixture';
        else if (phase0Url.includes('proof=b2')) capName = 'proof_b2_combat_fixture';
        else if (phase0Url.includes('proof=b1')) capName = 'proof_b1_motion_fixture';
        else if (phase0Url.includes('game=pong')) capName = 'proof_a_pong_fixture';
        else capName = 'phase0_boot_fixture';
      }
      captures.push(saveCapture(outputDir, capName, revision.commit, viewport, browserResult.screenshotBuffer));
    }

    // Baseline checks
    const checks = {
      boot: browserResult.httpStatus === 200 && (Boolean(browserResult.bootProof) || Boolean(browserResult.pongProof) || Boolean(browserResult.b1Proof) || Boolean(browserResult.b2Proof) || Boolean(browserResult.cProof) || Boolean(browserResult.dProof)),
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

    let pongResult = null;
    let b1Result = null;
    let b2Result = null;

    // 4. If running standard full suite, evaluate Proof A Pong, Proof B1 Motion, AND Proof B2 Combat
    if (!isCustomSingleTarget) {
      // 4a. Proof A Pong
      const pongUrl = 'http://localhost:5173/?game=pong&controlled=1';
      pongResult = await runBrowserEvaluation({
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

      // 4b. Proof B1 Motion Truth
      const b1Url = 'http://localhost:5173/?proof=b1&controlled=1';
      b1Result = await runBrowserEvaluation({
        url: b1Url,
        viewport,
        captureScreenshot: true
      });

      if (b1Result.screenshotBuffer) {
        captures.push(saveCapture(outputDir, 'proof_b1_motion_fixture', revision.commit, viewport, b1Result.screenshotBuffer));
      }

      checks.b1Boot = b1Result.httpStatus === 200 && Boolean(b1Result.b1Proof);
      checks.b1CharacterGeneration = Boolean(b1Result.b1Proof?.checks?.hasGeometry && b1Result.b1Proof?.checks?.hasSkeleton && b1Result.b1Proof?.checks?.skinningNormalized);
      checks.b1MotionExecution = Boolean(b1Result.b1Proof?.checks?.phaseAdvanced && b1Result.b1Proof?.checks?.speedValid && b1Result.b1Proof?.checks?.pelvisDynamic);
      checks.b1GroundingCheck = Boolean(b1Result.b1Proof?.checks?.groundingValid);

      if (b1Result.consoleErrors.length > 0) checks.noConsoleErrors = false;
      if (b1Result.pageErrors.length > 0) checks.noPageErrors = false;
      if (b1Result.failedRequests.length > 0) checks.noFailedRequests = false;

      allConsoleErrors.push(...b1Result.consoleErrors);
      allPageErrors.push(...b1Result.pageErrors);
      allFailedRequests.push(...b1Result.failedRequests);

      if (b1Result.b1Proof?.diagnosticsRecords) {
        rawDiagnostics.push(...b1Result.b1Proof.diagnosticsRecords);
      }

      // 4c. Proof B2 Combat Room
      const b2Url = 'http://localhost:5173/?proof=b2&controlled=1';
      b2Result = await runBrowserEvaluation({
        url: b2Url,
        viewport,
        captureScreenshot: true
      });

      if (b2Result.screenshotBuffer) {
        captures.push(saveCapture(outputDir, 'proof_b2_combat_fixture', revision.commit, viewport, b2Result.screenshotBuffer));
      }

      checks.b2Boot = b2Result.httpStatus === 200 && Boolean(b2Result.b2Proof);
      checks.b2RoomGeneration = Boolean(b2Result.b2Proof?.checks?.b2RoomGeneration);
      checks.b2MaterialGeneration = Boolean(b2Result.b2Proof?.checks?.b2MaterialGeneration);
      checks.b2CharacterIntegration = Boolean(b2Result.b2Proof?.checks?.b2CharacterIntegration);
      checks.b2PlayerMovement = Boolean(b2Result.b2Proof?.checks?.b2PlayerMovement);
      checks.b2CombatExecution = Boolean(b2Result.b2Proof?.checks?.b2CombatExecution);
      checks.b2WinState = Boolean(b2Result.b2Proof?.checks?.b2WinState);
      checks.b2PageProofSuccess = Boolean(b2Result.b2Proof?.success);

      if (b2Result.consoleErrors.length > 0) checks.noConsoleErrors = false;
      if (b2Result.pageErrors.length > 0) checks.noPageErrors = false;
      if (b2Result.failedRequests.length > 0) checks.noFailedRequests = false;

      allConsoleErrors.push(...b2Result.consoleErrors);
      allPageErrors.push(...b2Result.pageErrors);
      allFailedRequests.push(...b2Result.failedRequests);

      if (b2Result.b2Proof?.diagnosticsRecords) {
        rawDiagnostics.push(...b2Result.b2Proof.diagnosticsRecords);
      }
    } else if (phase0Url.includes('proof=b2') && browserResult.b2Proof) {
      checks.b2Boot = true;
      checks.b2RoomGeneration = Boolean(browserResult.b2Proof.checks?.b2RoomGeneration);
      checks.b2MaterialGeneration = Boolean(browserResult.b2Proof.checks?.b2MaterialGeneration);
      checks.b2CharacterIntegration = Boolean(browserResult.b2Proof.checks?.b2CharacterIntegration);
      checks.b2PlayerMovement = Boolean(browserResult.b2Proof.checks?.b2PlayerMovement);
      checks.b2CombatExecution = Boolean(browserResult.b2Proof.checks?.b2CombatExecution);
      checks.b2WinState = Boolean(browserResult.b2Proof.checks?.b2WinState);
      checks.b2PageProofSuccess = Boolean(browserResult.b2Proof.success);
      if (browserResult.b2Proof.diagnosticsRecords) {
        rawDiagnostics.push(...browserResult.b2Proof.diagnosticsRecords);
      }
    } else if (phase0Url.includes('proof=b1') && browserResult.b1Proof) {
      checks.b1Boot = true;
      checks.b1CharacterGeneration = Boolean(browserResult.b1Proof.checks?.hasGeometry && browserResult.b1Proof.checks?.hasSkeleton && browserResult.b1Proof.checks?.skinningNormalized);
      checks.b1MotionExecution = Boolean(browserResult.b1Proof.checks?.phaseAdvanced && browserResult.b1Proof.checks?.speedValid && browserResult.b1Proof.checks?.pelvisDynamic);
      checks.b1GroundingCheck = Boolean(browserResult.b1Proof.checks?.groundingValid);
      if (browserResult.b1Proof.diagnosticsRecords) {
        rawDiagnostics.push(...browserResult.b1Proof.diagnosticsRecords);
      }
    } else if (phase0Url.includes('game=pong') && browserResult.pongProof) {
      checks.pongBoot = true;
      checks.pongGameplay = Boolean(browserResult.pongProof.checks?.movedUp && browserResult.pongProof.checks?.inPlaying);
      checks.pongScoring = Boolean(browserResult.pongProof.checks?.scoredPoint && browserResult.pongProof.checks?.domScoreUpdated);
      if (browserResult.pongProof.diagnosticsRecords) {
        rawDiagnostics.push(...browserResult.pongProof.diagnosticsRecords);
      }
    }

    let cResult = null;
    if (!isCustomSingleTarget || phase0Url.includes('proof=c')) {
      cResult = isCustomSingleTarget ? browserResult : await runBrowserEvaluation({ url: 'http://localhost:5173/?proof=c&controlled=1', viewport });
      Object.assign(checks, cTargetChecks(cResult));
      if (!isCustomSingleTarget) {
        if (cResult.screenshotBuffer) captures.push(saveCapture(outputDir, 'proof_c_world_fixture', revision.commit, viewport, cResult.screenshotBuffer));
        allConsoleErrors.push(...cResult.consoleErrors); allPageErrors.push(...cResult.pageErrors); allFailedRequests.push(...cResult.failedRequests);
      }
      if (cResult.consoleErrors.length) checks.noConsoleErrors = false;
      if (cResult.pageErrors.length) checks.noPageErrors = false;
      if (cResult.failedRequests.length) checks.noFailedRequests = false;
      rawDiagnostics.push(...(cResult.cProof?.diagnosticsRecords || []));
    }

    let dResult = null;
    if (!isCustomSingleTarget || phase0Url.includes('proof=d')) {
      dResult = isCustomSingleTarget ? browserResult : await runBrowserEvaluation({ url: 'http://localhost:5173/?proof=d&controlled=1', viewport });
      Object.assign(checks, dTargetChecks(dResult));
      if (!isCustomSingleTarget) {
        if (dResult.screenshotBuffer) captures.push(saveCapture(outputDir, 'proof_d_racing_fixture', revision.commit, viewport, dResult.screenshotBuffer));
        allConsoleErrors.push(...dResult.consoleErrors); allPageErrors.push(...dResult.pageErrors); allFailedRequests.push(...dResult.failedRequests);
      }
      if (dResult.consoleErrors.length) checks.noConsoleErrors = false;
      if (dResult.pageErrors.length) checks.noPageErrors = false;
      if (dResult.failedRequests.length) checks.noFailedRequests = false;
      rawDiagnostics.push(...(dResult.dProof?.diagnosticsRecords || []));
    }

    let sceneResult = null;
    if (!isCustomSingleTarget || phase0Url.includes('scene=')) {
      sceneResult = isCustomSingleTarget ? browserResult : await runBrowserEvaluation({ url: 'http://localhost:5173/?scene=subterra&controlled=1', viewport });
      Object.assign(checks, sceneTargetChecks(sceneResult));
      if (!isCustomSingleTarget) {
        if (sceneResult.screenshotBuffer) captures.push(saveCapture(outputDir, 'scene_subterra_cell_fixture', revision.commit, viewport, sceneResult.screenshotBuffer));
        allConsoleErrors.push(...sceneResult.consoleErrors); allPageErrors.push(...sceneResult.pageErrors); allFailedRequests.push(...sceneResult.failedRequests);
      }
      if (sceneResult.consoleErrors.length) checks.noConsoleErrors = false;
      if (sceneResult.pageErrors.length) checks.noPageErrors = false;
      if (sceneResult.failedRequests.length) checks.noFailedRequests = false;
      rawDiagnostics.push(...(sceneResult.sceneProof?.diagnosticsRecords || []));
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

    const combinedDom = {
      ...browserResult.domDetails,
      b1Phase: b1Result?.domDetails?.b1Phase || browserResult.domDetails?.b1Phase || '',
      b1Speed: b1Result?.domDetails?.b1Speed || browserResult.domDetails?.b1Speed || '',
      b1Contact: b1Result?.domDetails?.b1Contact || browserResult.domDetails?.b1Contact || '',
      b2Banner: b2Result?.domDetails?.b2Banner || browserResult.domDetails?.b2Banner || '',
      b2PlayerHp: b2Result?.domDetails?.b2PlayerHp || browserResult.domDetails?.b2PlayerHp || '',
      b2EnemyHp: b2Result?.domDetails?.b2EnemyHp || browserResult.domDetails?.b2EnemyHp || '',
      b2Hits: b2Result?.domDetails?.b2Hits || browserResult.domDetails?.b2Hits || ''
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
        url: isCustomSingleTarget ? phase0Url : 'http://localhost:5173/ (Full Suite: Phase 0 + Proof A + Proof B1 + Proof B2 + Proof C + Proof D)',
        httpStatus: browserResult.httpStatus,
        dom: combinedDom,
        targets: {
          phase0: {
            url: phase0Url,
            httpStatus: browserResult.httpStatus,
            bootProof: browserResult.bootProof,
            dom: browserResult.domDetails
          },
          pong: pongResult ? {
            url: 'http://localhost:5173/?game=pong&controlled=1',
            httpStatus: pongResult.httpStatus,
            pongProof: pongResult.pongProof,
            dom: pongResult.domDetails
          } : null,
          b1: b1Result ? {
            url: 'http://localhost:5173/?proof=b1&controlled=1',
            httpStatus: b1Result.httpStatus,
            b1Proof: b1Result.b1Proof,
            dom: b1Result.domDetails
          } : null,
          c: cResult ? { url: cResult.url, httpStatus: cResult.httpStatus, cProof: cResult.cProof } : null,
          d: dResult ? { url: dResult.url, httpStatus: dResult.httpStatus, dProof: dResult.dProof } : null,
          b2: b2Result ? {
            url: 'http://localhost:5173/?proof=b2&controlled=1',
            httpStatus: b2Result.httpStatus,
            b2Proof: b2Result.b2Proof,
            dom: b2Result.domDetails
          } : null
        },
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

/**
 * Convenience helper to evaluate Proof B1 Motion Truth specifically.
 */
export async function runProofB1Evaluation(options = {}) {
  return runEvaluation({
    url: 'http://localhost:5173/?proof=b1&controlled=1',
    captureName: 'proof_b1_motion_fixture',
    ...options
  });
}
