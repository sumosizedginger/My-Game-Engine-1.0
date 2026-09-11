import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const APPROVED_NODE_VERSION = '24.21.0';

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

test('approved Node version is consistently pinned across executable configs and canonical documentation', () => {
  // 1. Executable repository configuration
  const nvmrc = fs.readFileSync(path.join(rootDir, '.nvmrc'), 'utf8').trim();
  const nodeVersion = fs.readFileSync(path.join(rootDir, '.node-version'), 'utf8').trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.equal(nvmrc, APPROVED_NODE_VERSION, `.nvmrc must pin ${APPROVED_NODE_VERSION}`);
  assert.equal(nodeVersion, APPROVED_NODE_VERSION, `.node-version must pin ${APPROVED_NODE_VERSION}`);
  assert.equal(pkg.engines?.node, APPROVED_NODE_VERSION, `package.json engines.node must pin ${APPROVED_NODE_VERSION}`);

  // 2. Canonical toolchain-governing documentation
  const docsToCheck = [
    { file: 'README.md', pattern: `Node ${APPROVED_NODE_VERSION}` },
    { file: 'PRD.md', pattern: `Node ${APPROVED_NODE_VERSION}` },
    { file: 'ROADMAP.md', pattern: `Node \`${APPROVED_NODE_VERSION}\`` },
    { file: 'AGENTS.md', pattern: `- Node: \`${APPROVED_NODE_VERSION}\`` },
    { file: 'DEPENDENCY_POLICY.md', pattern: `\`Node ${APPROVED_NODE_VERSION}\`` }
  ];

  for (const { file, pattern } of docsToCheck) {
    const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
    assert.ok(
      content.includes(pattern),
      `${file} must document approved Node target ${APPROVED_NODE_VERSION} (expected pattern: "${pattern}")`
    );
  }
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
