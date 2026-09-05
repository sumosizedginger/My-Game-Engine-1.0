/**
 * My Game Engine 1.0 — Evaluation Result Comparison
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Compares two evaluation results for deterministic repeatability.
 */

/**
 * Compares two evaluation result objects and returns differences.
 *
 * @param {object} a - First evaluation result.
 * @param {object} b - Second evaluation result.
 * @returns {{ matches: boolean, differences: string[] }}
 */
export function compareEvaluationResults(a, b) {
  const differences = [];

  if (!a || !b) {
    return { matches: false, differences: ['One or both evaluation results are null or undefined'] };
  }

  // 1. Status comparison
  if (a.status !== b.status) {
    differences.push(`Status mismatch: "${a.status}" vs "${b.status}"`);
  }

  // 2. Revision comparison
  if (a.revision?.commit !== b.revision?.commit) {
    differences.push(`Revision commit mismatch: "${a.revision?.commit}" vs "${b.revision?.commit}"`);
  }

  // 3. Checks comparison
  const checksA = a.checks || {};
  const checksB = b.checks || {};
  const allCheckKeys = new Set([...Object.keys(checksA), ...Object.keys(checksB)]);
  for (const key of allCheckKeys) {
    if (checksA[key] !== checksB[key]) {
      differences.push(`Check mismatch for "${key}": ${checksA[key]} vs ${checksB[key]}`);
    }
  }

  // 4. Diagnostics comparison
  if (a.diagnostics?.hasErrors !== b.diagnostics?.hasErrors) {
    differences.push(`Diagnostics hasErrors mismatch: ${a.diagnostics?.hasErrors} vs ${b.diagnostics?.hasErrors}`);
  }
  if (a.diagnostics?.fatalCount !== b.diagnostics?.fatalCount) {
    differences.push(`Diagnostics fatalCount mismatch: ${a.diagnostics?.fatalCount} vs ${b.diagnostics?.fatalCount}`);
  }
  if (a.diagnostics?.degradeCount !== b.diagnostics?.degradeCount) {
    differences.push(`Diagnostics degradeCount mismatch: ${a.diagnostics?.degradeCount} vs ${b.diagnostics?.degradeCount}`);
  }
  if (a.diagnostics?.quarantineCount !== b.diagnostics?.quarantineCount) {
    differences.push(`Diagnostics quarantineCount mismatch: ${a.diagnostics?.quarantineCount} vs ${b.diagnostics?.quarantineCount}`);
  }

  const codesA = (a.diagnostics?.codes || []).slice().sort();
  const codesB = (b.diagnostics?.codes || []).slice().sort();
  if (JSON.stringify(codesA) !== JSON.stringify(codesB)) {
    differences.push(`Diagnostic codes mismatch: [${codesA.join(', ')}] vs [${codesB.join(', ')}]`);
  }

  // 5. Captures comparison (stable hash and metadata)
  const capturesA = a.captures || [];
  const capturesB = b.captures || [];
  if (capturesA.length !== capturesB.length) {
    differences.push(`Capture count mismatch: ${capturesA.length} vs ${capturesB.length}`);
  } else {
    for (let i = 0; i < capturesA.length; i++) {
      const capA = capturesA[i];
      const capB = capturesB[i];
      if (capA.name !== capB.name) {
        differences.push(`Capture[${i}] name mismatch: "${capA.name}" vs "${capB.name}"`);
      }
      if (capA.sha256 !== capB.sha256) {
        differences.push(`Capture[${i}] "${capA.name}" sha256 mismatch: "${capA.sha256}" vs "${capB.sha256}"`);
      }
      if (capA.viewport?.width !== capB.viewport?.width || capA.viewport?.height !== capB.viewport?.height) {
        differences.push(
          `Capture[${i}] viewport mismatch: ${JSON.stringify(capA.viewport)} vs ${JSON.stringify(capB.viewport)}`
        );
      }
    }
  }

  // 6. Telemetry deterministic counts (ignoring duration elapsed)
  const telemA = a.telemetry || {};
  const telemB = b.telemetry || {};
  const deterministicTelemetryKeys = [
    'bootSuccess',
    'diagnosticCount',
    'failedRequestCount',
    'consoleErrorCount',
    'pageErrorCount'
  ];
  for (const key of deterministicTelemetryKeys) {
    if (telemA[key] !== telemB[key]) {
      differences.push(`Telemetry "${key}" mismatch: ${telemA[key]} vs ${telemB[key]}`);
    }
  }

  return {
    matches: differences.length === 0,
    differences
  };
}
