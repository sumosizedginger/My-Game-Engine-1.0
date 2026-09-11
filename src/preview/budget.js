/**
 * My Game Engine 1.0 — Preview Safety Budget
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Preview budgets FAIL CLOSED. A budget that logs a warning and renders anyway
 * is not a budget. A prior external procedural graphics experiment produced
 * enough runtime complexity to severely degrade Chrome; the engine must refuse
 * a pathological preview rather than attempt it because generated code asked.
 *
 * Thresholds are explicit implementation configuration, NOT constitutional
 * universal constants. See `Next step.md` section 7.11.
 */

import { createDiagnostic } from '../runtime/index.js';

/**
 * Default preview thresholds.
 *
 * Derived from measurement of accepted proofs in this repository, not invented:
 *   - heaviest single accepted geometry: Proof C world terrain, 32,768 triangles
 *     across 16,641 vertices;
 *   - accepted humanoid character: 2,576 triangles across 1,401 vertices;
 *   - CINDER MK-I target from the work order: roughly 8,000 triangles across
 *     approximately 6 runtime meshes and 4 material families.
 *
 * maxTriangles is set at roughly 7.6x the heaviest measured single geometry, so
 * an asset far richer than CINDER still previews while genuinely pathological
 * generation is refused. Revise these against measurement, never against
 * convenience.
 */
export const PREVIEW_BUDGET_DEFAULTS = Object.freeze({
  maxTriangles: 250000,
  maxVertices: 500000,
  maxParts: 256,
  maxMaterials: 32,
  maxDrawCalls: 256,
  maxDpr: 2,
  maxGenerationMs: 2000
});

/** Human-readable stat labels used in violation messages. */
const LIMIT_TO_STAT = Object.freeze({
  maxTriangles: 'triangles',
  maxVertices: 'vertices',
  maxParts: 'parts',
  maxMaterials: 'materials',
  maxDrawCalls: 'drawCalls',
  maxDpr: 'dpr',
  maxGenerationMs: 'generationMs'
});

/**
 * Evaluates measured stats against a budget.
 *
 * Reports rather than throws, so callers can inspect every violation at once.
 * `enforcePreviewBudget` is the fail-closed variant.
 *
 * @param {object} stats - Measured values keyed by stat name.
 * @param {object} [budget=PREVIEW_BUDGET_DEFAULTS]
 * @returns {{withinBudget: boolean, violations: Array<object>, budget: object, stats: object}}
 */
export function evaluatePreviewBudget(stats, budget = PREVIEW_BUDGET_DEFAULTS) {
  const violations = [];

  for (const [limitName, statName] of Object.entries(LIMIT_TO_STAT)) {
    const limit = budget[limitName];
    const measured = stats[statName];
    if (limit === undefined || measured === undefined || measured === null) continue;
    if (!Number.isFinite(measured)) {
      violations.push(createDiagnostic({
        severity: 'ERROR',
        code: 'PREVIEW_BUDGET_UNMEASURABLE',
        step: 'budget',
        subsystem: 'preview',
        message: `Stat "${statName}" is not a finite number and cannot be checked against ${limitName}`,
        data: { statName, measured }
      }));
      continue;
    }
    if (measured > limit) {
      violations.push(createDiagnostic({
        severity: 'ERROR',
        code: 'PREVIEW_BUDGET_EXCEEDED',
        step: 'budget',
        subsystem: 'preview',
        message: `${statName} ${measured} exceeds ${limitName} ${limit}`,
        data: { statName, measured, limitName, limit }
      }));
    }
  }

  return {
    withinBudget: violations.length === 0,
    violations,
    budget,
    stats: { ...stats }
  };
}

/**
 * Fail-closed budget enforcement. Throws on any violation.
 *
 * @param {object} stats
 * @param {object} [budget=PREVIEW_BUDGET_DEFAULTS]
 * @returns {object} The budget report.
 */
export function enforcePreviewBudget(stats, budget = PREVIEW_BUDGET_DEFAULTS) {
  const report = evaluatePreviewBudget(stats, budget);
  if (!report.withinBudget) {
    const detail = report.violations.map((v) => v.message).join('; ');
    const error = new Error(
      `Preview refused: budget exceeded. ${detail}. ` +
      'The preview budget fails closed by design; it does not degrade silently.'
    );
    error.diagnostics = report.violations;
    error.budgetReport = report;
    throw error;
  }
  return report;
}
