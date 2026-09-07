export const C_CHECKS = Object.freeze(['cWorldGeneration', 'cFieldDeterminism', 'cTerrainQueryTruth',
  'cVegetationPlacement', 'cVegetationRendering', 'cWorldVolumeQuery', 'cCharacterGrounding', 'cTraversal', 'cCollision']);

// A missing page, missing check, truthy string, or failed page summary fails closed.
export function cTargetChecks(result) {
  return { cBoot: result?.httpStatus === 200 && Boolean(result?.cProof),
    ...Object.fromEntries(C_CHECKS.map(key => [key, result?.cProof?.checks?.[key] === true])),
    cPageProofSuccess: result?.cProof?.success === true };
}
