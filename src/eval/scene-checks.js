/**
 * My Game Engine 1.0 — Scene Composition Evaluator Checks
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Maps the browser-side scene proof onto the evaluator's flat check record,
 * following the shape `c-checks.js` and `d-checks.js` already use.
 *
 * Every check is a strict `=== true`. A missing proof must read as FAIL, never
 * as a truthy object.
 */

export const SCENE_CHECKS = Object.freeze([
  'sceneComposition',
  'sceneHierarchy',
  'sceneWorldTransforms',
  'scenePresentation',
  'sceneUnload',
  'sceneReloadIdentity',
  'sceneHandleRenewal',
  'sceneNoLeak'
]);

/**
 * @param {object} result - Browser evaluation result.
 * @returns {object} Flat check record.
 */
export function sceneTargetChecks(result) {
  return {
    sceneBoot: result?.httpStatus === 200 && Boolean(result?.sceneProof),
    ...Object.fromEntries(SCENE_CHECKS.map((key) => [key, result?.sceneProof?.checks?.[key] === true])),
    scenePageProofSuccess: result?.sceneProof?.success === true
  };
}
