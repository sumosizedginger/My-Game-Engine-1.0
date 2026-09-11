/**
 * My Game Engine 1.0 — Cross-Runtime MeshIR Determinism Probe
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * EVALUATION TOOLING. Node-only.
 *
 * Math.sin and Math.cos are not bit-pinned by the ECMAScript specification,
 * while the MeshIR hash operates over exact encoded bytes. Cross-runtime byte
 * identity is therefore an OPEN QUESTION that this probe answers with evidence
 * rather than an assumption.
 *
 *   Generate CINDER in Node    -> canonical encoding -> hash A
 *   Generate CINDER in browser -> canonical encoding -> hash B
 *   A === B ?
 *
 * On divergence this reports the exact differing byte ranges and stops. The
 * contract is NOT weakened to make the probe pass, no float is silently
 * quantized, and no custom trigonometric approximation is introduced.
 * See `Next step.md` Decision 8 and section 11.
 */

import puppeteer from 'puppeteer-core';
import { buildCinder } from '../../examples/authoring/cinder-mk1/build.js';
import { encodeMesh, meshHash, bytesToHex } from '../geometry/mesh-codec.js';
import { findBrowserExecutable } from './browser.js';
import { ensureServer } from './harness.js';

/**
 * Locates the differing byte ranges between two hex strings.
 *
 * @param {string} hexA
 * @param {string} hexB
 * @param {number} [maxRanges=8]
 * @returns {Array<object>}
 */
export function diffHexRanges(hexA, hexB, maxRanges = 8) {
  const ranges = [];
  const limit = Math.min(hexA.length, hexB.length);
  let start = -1;
  for (let i = 0; i < limit; i += 2) {
    const differs = hexA[i] !== hexB[i] || hexA[i + 1] !== hexB[i + 1];
    if (differs && start === -1) {
      start = i / 2;
    } else if (!differs && start !== -1) {
      ranges.push({ byteStart: start, byteEnd: i / 2 - 1, a: hexA.slice(start * 2, i), b: hexB.slice(start * 2, i) });
      start = -1;
      if (ranges.length >= maxRanges) return ranges;
    }
  }
  if (start !== -1) {
    ranges.push({ byteStart: start, byteEnd: limit / 2 - 1, a: hexA.slice(start * 2, limit), b: hexB.slice(start * 2, limit) });
  }
  if (hexA.length !== hexB.length) {
    ranges.push({ lengthMismatch: true, aBytes: hexA.length / 2, bBytes: hexB.length / 2 });
  }
  return ranges;
}

/**
 * Runs the cross-runtime probe.
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl='http://localhost:5173']
 * @returns {Promise<object>} Probe result.
 */
export async function probeCinderDeterminism({ baseUrl = 'http://localhost:5173' } = {}) {
  // Node side.
  const nodeResult = buildCinder();
  const nodeBytes = encodeMesh(nodeResult.meshIR);
  const nodeHash = meshHash(nodeResult.meshIR);

  // Browser side.
  const url = `${baseUrl}/?preview=cinder`;
  const server = await ensureServer(url);
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.__PREVIEW_LAB__), { timeout: 20000 });

    // ALWAYS pull the full canonical byte stream and compare it directly.
    //
    // Equal hashes plus equal lengths is NOT byte identity. meshHash is a
    // 64-bit non-cryptographic fingerprint: a compact way to NAME a byte
    // stream, never proof that two streams are the same one. The contract is
    // strict byte equality, so bytes are what gets compared.
    const browserSide = await page.evaluate(() => ({
      meshHash: window.__PREVIEW_LAB__.meshHash,
      byteLength: window.__PREVIEW_LAB__.meshByteLength,
      hex: window.__PREVIEW_LAB__.getMeshBytesHex(),
      userAgent: navigator.userAgent
    }));

    const nodeHex = bytesToHex(nodeBytes);
    const identical = nodeHex === browserSide.hex;
    const hashesAgree = nodeHash === browserSide.meshHash;

    const result = {
      identical,
      comparison: 'byte-for-byte over the canonical MeshIR encoding',
      bytesCompared: nodeBytes.length,
      node: {
        hash: nodeHash,
        byteLength: nodeBytes.length,
        runtime: `node ${process.version}`
      },
      browser: {
        hash: browserSide.meshHash,
        byteLength: browserSide.byteLength,
        runtime: browserSide.userAgent
      },
      // Reported separately, so a fingerprint agreeing while the bytes differ
      // would surface as its own finding rather than passing silently.
      hashesAgree,
      hashAgreesButBytesDiffer: hashesAgree && !identical,
      divergence: null
    };

    if (!identical) {
      result.divergence = {
        ranges: diffHexRanges(nodeHex, browserSide.hex),
        likelySource:
          'Transcendental results (Math.sin / Math.cos in createCylinderMesh and profile generation) ' +
          'are not bit-pinned across engine builds. Compare the differing byte offsets against the ' +
          'attribute block layout in src/geometry/mesh-codec.js to identify which attribute diverged.',
        doNot: [
          'Do not quantize floats silently.',
          'Do not weaken the determinism contract to make this pass.',
          'Do not introduce custom trigonometric approximations without human review.'
        ]
      };
    }

    return result;
  } finally {
    await browser.close();
    if (server.process) {
      try { server.process.kill(); } catch { /* already gone */ }
    }
  }
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('probe-cinder.js')) {
  probeCinderDeterminism()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.identical) {
        console.log('\n✔ Cross-runtime MeshIR determinism: Node and browser canonical bytes agree.');
        process.exit(0);
      }
      console.error('\n✖ STOP CONDITION TRIGGERED: canonical MeshIR bytes diverge across runtimes.');
      console.error('  Return for architectural review. Do not weaken the contract.');
      process.exit(1);
    })
    .catch((error) => {
      console.error('\n✖ Probe failed to run:', error.message);
      process.exit(2);
    });
}
