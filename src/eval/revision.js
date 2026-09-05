/**
 * My Game Engine 1.0 — Evaluation Revision Identity
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Extracts exact local git revision identity without network or remote dependencies.
 */

import { execSync } from 'node:child_process';

/**
 * Retrieves the local repository revision info.
 *
 * @param {string} [cwd=process.cwd()] - Working directory.
 * @returns {{ commit: string, branch: string, clean: boolean }}
 */
export function getRevisionInfo(cwd = process.cwd()) {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    let branch = '';
    try {
      branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      branch = 'HEAD';
    }
    const status = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const clean = status.length === 0;

    return {
      commit,
      branch: branch || 'HEAD',
      clean
    };
  } catch (error) {
    return {
      commit: 'unknown',
      branch: 'unknown',
      clean: false,
      error: error.message
    };
  }
}
