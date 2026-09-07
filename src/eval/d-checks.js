export const D_CHECKS=Object.freeze(['dTrackGeneration','dVehicleMotion','dAnalogInput','dBarrierCollision','dCheckpointProgress','dRaceFinish','dControlledCamera']);
export function dTargetChecks(result) {
  return {dBoot:result?.httpStatus===200&&Boolean(result?.dProof),
    ...Object.fromEntries(D_CHECKS.map(key=>[key,result?.dProof?.checks?.[key]===true])),dPageProofSuccess:result?.dProof?.success===true};
}
