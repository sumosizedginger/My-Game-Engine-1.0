/**
 * My Game Engine 1.0 — Motion Forge: Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Unified barrel export for Motion Forge subsystem.
 * Follows ARCHITECTURE.md §20.3 & §22 and MOTION_FORGE.md.
 */

import {
  MOTION_PARAMETER_BOUNDS,
  MOTION_PRESETS,
  resolveMotionParameters,
  createMotionDefinition
} from './definition.js';
import { solveTwoBoneIK } from './ik.js';
import { computeGaitFootPlacement } from './grounding.js';
import { createLocomotionEvaluator } from './generator.js';
import { commitRootMotionIntent } from './root-motion.js';

export {
  MOTION_PARAMETER_BOUNDS,
  MOTION_PRESETS,
  resolveMotionParameters,
  createMotionDefinition,
  solveTwoBoneIK,
  computeGaitFootPlacement,
  createLocomotionEvaluator,
  commitRootMotionIntent
};
