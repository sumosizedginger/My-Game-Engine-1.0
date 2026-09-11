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

/**
 * Limits that FAIL CLOSED. Exceeding one refuses the preview outright.
 *
 * `maxDrawCalls` is checked against a PREDICTED draw-call count, not a measured
 * one, because the check must happen before any renderer resource is allocated.
 * The prediction is sound for the current architecture — a Previewable is one
 * Mesh carrying one geometry group per part, and a renderer issues one draw
 * call per group — and `tests/preview-browser.test.js` asserts the prediction
 * matches the renderer's own measured count. If that architecture ever changes
 * to multiple meshes or instancing, the prediction must be revisited.
 */
export const FAIL_CLOSED_LIMITS = Object.freeze({
  maxTriangles: 'triangles',
  maxVertices: 'vertices',
  maxParts: 'parts',
  maxMaterials: 'materials',
  maxDrawCalls: 'drawCalls',
  maxGenerationMs: 'generationMs'
});

/**
 * Limits applied as explicit safe DEGRADATION rather than refusal.
 *
 * `maxDpr` is a clamp: a high-density display does not make an asset
 * pathological, it just makes it expensive to rasterize, so the correct
 * response is to render at a bounded pixel ratio and SAY SO. The clamp is
 * reported through a diagnostic carrying both the requested and effective
 * value; it is never silent, and it is never advertised as fail-closed.
 */
export const DEGRADATION_LIMITS = Object.freeze({
  maxDpr: 'dpr'
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

  for (const [limitName, statName] of Object.entries(FAIL_CLOSED_LIMITS)) {
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
    failClosedDimensions: Object.keys(FAIL_CLOSED_LIMITS),
    degradationDimensions: Object.keys(DEGRADATION_LIMITS),
    stats: { ...stats }
  };
}

/**
 * Applies the device-pixel-ratio clamp and reports it.
 *
 * Returns both the requested and the effective value plus a diagnostic when a
 * clamp actually occurred, so degradation is always visible in evidence rather
 * than inferred from a surprising pixel count.
 *
 * @param {number} requestedDpr
 * @param {object} [budget=PREVIEW_BUDGET_DEFAULTS]
 * @returns {{requestedDpr: number, effectiveDpr: number, clamped: boolean, diagnostic: object|null}}
 */
export function resolveDevicePixelRatio(requestedDpr, budget = PREVIEW_BUDGET_DEFAULTS) {
  const requested = Number.isFinite(requestedDpr) && requestedDpr > 0 ? requestedDpr : 1;
  const effective = Math.min(requested, budget.maxDpr);
  const clamped = effective < requested;

  return {
    requestedDpr: requested,
    effectiveDpr: effective,
    clamped,
    diagnostic: clamped
      ? createDiagnostic({
        severity: 'INFO',
        code: 'PREVIEW_DPR_CLAMPED',
        step: 'budget',
        subsystem: 'preview',
        message: `Device pixel ratio clamped from ${requested} to ${effective} by the preview budget`,
        data: { requestedDpr: requested, effectiveDpr: effective, maxDpr: budget.maxDpr }
      })
      : null
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
