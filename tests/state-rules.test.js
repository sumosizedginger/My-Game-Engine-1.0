import test from 'node:test';
import assert from 'node:assert/strict';

import { createStateManager } from '../src/runtime/state.js';
import { createRuleEngine } from '../src/runtime/rules.js';

test('state reset rejects undeclared targets without changing state, variables or notifications', () => {
  const state = createStateManager({ initialState: 'A', validStates: ['A', 'B'], initialVars: { score: 1 } });
  state.transition('B');
  state.setVar('extra', 2);
  const calls = [];
  state.onStateChange(() => calls.push('state'));
  state.onVarChange('score', () => calls.push('score'));
  for (let i = 0; i < 3; i++) {
    assert.throws(() => state.reset('INVALID', { score: 99 }), /Invalid state reset.*undeclared state/);
    assert.equal(state.getState(), 'B');
    assert.deepEqual(state.getAllVars(), { score: 1, extra: 2 });
    assert.deepEqual(calls, []);
  }
  state.reset('A', { score: 3 });
  assert.equal(state.getState(), 'A');
  assert.deepEqual(state.getAllVars(), { score: 3 });
  assert.deepEqual(calls, []);
  assert.equal(state.transition('B'), true);
  assert.deepEqual(calls, ['state']);
});

test('default and repeated resets preserve initial state and variables without notification', () => {
  for (const config of [undefined, { initialState: 'A', validStates: ['A', 'B'], initialVars: { score: 1 } }]) {
    const state = createStateManager(config);
    const initial = state.getState(), vars = state.getAllVars();
    state.transition(config ? 'B' : 'PLAYING');
    state.setVar('extra', 99);
    const notifications = [];
    state.onStateChange(() => notifications.push('state'));
    state.onVarChange('extra', () => notifications.push('variable'));
    for (let i = 0; i < 3; i++) {
      state.reset();
      assert.equal(state.getState(), initial);
      assert.deepEqual(state.getAllVars(), vars);
      assert.deepEqual(notifications, []);
    }
  }
});

test('state listener self-unsubscribe preserves later listeners and subsequent transitions', () => {
  const state = createStateManager({ initialState: 'A', validStates: ['A', 'B'] });
  const seen = [];
  const off = state.onStateChange(() => { seen.push('first'); off(); });
  state.onStateChange((next, previous) => seen.push([next, previous]));
  state.onStateChange(() => seen.push('third'));
  state.transition('B');
  assert.deepEqual(seen, ['first', ['B', 'A'], 'third']);
  off(); off();
  state.transition('A');
  assert.deepEqual(seen, ['first', ['B', 'A'], 'third', ['A', 'B'], 'third']);
  assert.equal(state.transition('A'), false);
  assert.equal(seen.length, 5);
});

test('state dispatch snapshots eligibility: removals and additions apply next notification', () => {
  const state = createStateManager({ initialState: 'A', validStates: ['A', 'B'] });
  const seen = [];
  let added = false;
  state.onStateChange(() => {
    seen.push('first');
    offSecond();
    if (!added) { added = true; state.onStateChange(() => seen.push('new')); }
  });
  const offSecond = state.onStateChange(() => seen.push('second'));
  state.onStateChange(() => seen.push('third'));
  state.transition('B');
  assert.deepEqual(seen, ['first', 'second', 'third']);
  seen.length = 0;
  state.transition('A');
  assert.deepEqual(seen, ['first', 'third', 'new']);
});

test('state unsubscribe is idempotent even when the same callback has another registration', () => {
  const state = createStateManager({ initialState: 'A', validStates: ['A', 'B'] });
  let calls = 0;
  const callback = () => calls++;
  const first = state.onStateChange(callback), second = state.onStateChange(callback);
  first(); first();
  state.transition('B');
  assert.equal(calls, 1);
  second(); second();
  state.transition('A');
  assert.equal(calls, 1);
  const order = [];
  const shared = () => order.push('shared');
  state.onStateChange(shared);
  state.onStateChange(() => order.push('middle'));
  const last = state.onStateChange(shared);
  last(); last();
  state.transition('B');
  assert.deepEqual(order, ['shared', 'middle']);
});

test('state listener errors retain existing reporting and do not stop later listeners', t => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const state = createStateManager({ initialState: 'A', validStates: ['A', 'B'] });
  const failure = new Error('listener failure');
  let later = 0;
  state.onStateChange(() => { throw failure; });
  state.onStateChange(() => later++);
  assert.equal(state.transition('B'), true);
  assert.equal(later, 1);
  assert.deepEqual(errors, [['[StateManager] State listener error:', failure]]);
});

test('state manager: handles state transitions and rejection of invalid states', () => {
  const sm = createStateManager({
    initialState: 'SERVE',
    validStates: ['SERVE', 'PLAYING', 'PAUSED', 'GAME_OVER']
  });

  assert.equal(sm.getState(), 'SERVE');

  let notifiedNext = null;
  let notifiedPrev = null;
  sm.onStateChange((next, prev) => {
    notifiedNext = next;
    notifiedPrev = prev;
  });

  const transitioned = sm.transition('PLAYING');
  assert.equal(transitioned, true);
  assert.equal(sm.getState(), 'PLAYING');
  assert.equal(notifiedNext, 'PLAYING');
  assert.equal(notifiedPrev, 'SERVE');

  // Undeclared state throws error
  assert.throws(() => {
    sm.transition('FLYING_STATE');
  }, /Invalid state transition/);
});

test('state manager: tracks runtime variables and triggers change listeners', () => {
  const sm = createStateManager({
    initialVars: { 'score.p1': 0, 'score.p2': 0 }
  });

  assert.equal(sm.getVar('score.p1'), 0);

  let updatedVal = null;
  sm.onVarChange('score.p1', (val) => {
    updatedVal = val;
  });

  sm.setVar('score.p1', 1);
  assert.equal(sm.getVar('score.p1'), 1);
  assert.equal(updatedVal, 1);

  sm.incrementVar('score.p1', 2);
  assert.equal(sm.getVar('score.p1'), 3);
  assert.equal(updatedVal, 3);
});

test('rule engine: evaluates declarative WHEN/IF/DO rules', () => {
  const sm = createStateManager({
    initialVars: { score: 0, max: 5 }
  });
  const rules = createRuleEngine({ stateManager: sm });

  let pointScored = false;
  let gameOverTriggered = false;

  // Rule 1: On score event, increment score
  rules.addRule({
    name: 'increment_score',
    event: 'SCORE_EVENT',
    action: () => {
      pointScored = true;
      sm.incrementVar('score', 1);
      rules.trigger('CHECK_SCORE');
    }
  });

  // Rule 2: If score >= max, trigger game over
  rules.addRule({
    name: 'game_over_check',
    event: 'CHECK_SCORE',
    condition: () => sm.getVar('score') >= sm.getVar('max'),
    action: () => {
      gameOverTriggered = true;
    }
  });

  // Trigger score event when score is 0
  rules.trigger('SCORE_EVENT');
  assert.equal(pointScored, true);
  assert.equal(sm.getVar('score'), 1);
  assert.equal(gameOverTriggered, false);

  // Set score to 4, trigger again -> score becomes 5, condition met, game over triggered
  sm.setVar('score', 4);
  rules.trigger('SCORE_EVENT');
  assert.equal(sm.getVar('score'), 5);
  assert.equal(gameOverTriggered, true);
});
