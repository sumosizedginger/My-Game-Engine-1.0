import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REQUIRED_BOOTSTRAP_DOCS = [
  'README.md',
  'CONSTITUTION.md',
  'PRD.md',
  'ARCHITECTURE.md',
  'CONTEXT.md',
  'ROADMAP.md',
  'AGENTS.md',
  'HANDOFF_PROTOCOL.md',
  'DEPENDENCY_POLICY.md',
  'DEFINITION_OF_DONE.md',
  'TESTING_AND_VALIDATION.md',
  'DOCUMENTATION_MAP.md',
  'CLAUDE.md',
  'GEMINI.md'
];

test('all 14 bootstrap documentation files exist in root and are non-empty', () => {
  for (const doc of REQUIRED_BOOTSTRAP_DOCS) {
    const filePath = path.join(rootDir, doc);
    assert.ok(fs.existsSync(filePath), `Expected bootstrap document ${doc} to exist`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 0, `Expected ${doc} to be non-empty`);
  }
});

test('Node 24.20.0 is consistently pinned across .nvmrc, .node-version, and package.json', () => {
  const nvmrc = fs.readFileSync(path.join(rootDir, '.nvmrc'), 'utf8').trim();
  const nodeVersion = fs.readFileSync(path.join(rootDir, '.node-version'), 'utf8').trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.equal(nvmrc, '24.20.0', '.nvmrc must pin 24.20.0');
  assert.equal(nodeVersion, '24.20.0', '.node-version must pin 24.20.0');
  assert.equal(pkg.engines?.node, '24.20.0', 'package.json engines.node must pin 24.20.0');
});

test('package.json defines canonical identity, Vite 8.2.2 devDependency, and required exports', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.equal(pkg.name, '@sumosizedginger/my-game-engine-1.0');
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.repository?.url, 'https://github.com/sumosizedginger/My-Game-Engine-1.0.git');
  assert.equal(pkg.devDependencies?.vite, '8.2.2');

  assert.equal(pkg.exports?.['.'], './src/index.js');
  assert.equal(pkg.exports?.['./runtime'], './src/runtime/index.js');
  assert.equal(pkg.exports?.['./full'], './src/full/index.js');
});
