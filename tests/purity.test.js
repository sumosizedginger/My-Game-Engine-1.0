import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as runtimeModule from '../src/runtime/index.js';
import * as fullModule from '../src/full/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const FORBIDDEN_FUTURE_NAMES = [
  'Kiln',
  'kiln',
  'compile',
  'GeometryForge',
  'CharacterForge',
  'MotionForge',
  'MaterialForge',
  'WorldForge',
  'SkeletonForge'
];

test('runtime/full purity: runtime entry point contains zero compiler or Forge exports', () => {
  for (const name of FORBIDDEN_FUTURE_NAMES) {
    assert.equal(
      name in runtimeModule,
      false,
      `engine/runtime must not export unearned future system: ${name}`
    );
  }
});

test('runtime/full purity: full engine entry point contains zero premature Kiln or Forge exports', () => {
  for (const name of FORBIDDEN_FUTURE_NAMES) {
    assert.equal(
      name in fullModule,
      false,
      `engine/full must not prematurely export unearned future system: ${name}`
    );
  }
});

test('runtime/full purity: runtime source code does not import from full engine', () => {
  const runtimeSource = fs.readFileSync(
    path.join(rootDir, 'src', 'runtime', 'index.js'),
    'utf8'
  );

  assert.equal(
    runtimeSource.includes('../full'),
    false,
    'src/runtime must not import from src/full'
  );
  assert.equal(
    runtimeSource.includes('Kiln'),
    false,
    'src/runtime source must not mention Kiln'
  );
});

test('runtime/full purity: full engine re-exports runtime capability without duplication', () => {
  assert.equal(fullModule.createRuntime, runtimeModule.createRuntime);
  assert.equal(fullModule.instantiate, runtimeModule.instantiate);
  assert.equal(fullModule.createDiagnostic, runtimeModule.createDiagnostic);
  assert.equal(fullModule.ENGINE_NAME, runtimeModule.ENGINE_NAME);
  assert.equal(fullModule.CANONICAL_REPOSITORY, runtimeModule.CANONICAL_REPOSITORY);

  // But preserves distinct entry points
  assert.equal(runtimeModule.ENTRY_POINT, 'engine/runtime');
  assert.equal(fullModule.ENTRY_POINT, 'engine/full');
});
