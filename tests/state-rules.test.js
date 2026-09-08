import test from 'node:test';
import assert from 'node:assert/strict';

import { createStateManager } from '../src/runtime/state.js';
import { createRuleEngine } from '../src/runtime/rules.js';

test('variable self-unsubscribe preserves eligible listeners and value/previous arguments', () => {
  const sm = createStateManager({ initialVars: { score: 0 } });
  const seen = [], values = [];
  const offA = sm.onVarChange('score', () => { seen.push('A'); offA(); });
  sm.onVarChange('score', (value, previous) => {
    seen.push('B'); values.push([value, previous, sm.getVar('score')]);
  });
  sm.setVar('score', 1);
  assert.deepEqual(seen, ['A', 'B']);
  seen.length = 0;
  sm.setVar('score', 2);
  assert.deepEqual(seen, ['B']);
  assert.deepEqual(values, [[1, 0, 1], [2, 1, 2]]);
});

test('variable cross-unsubscribe affects subsequent notifications only', () => {
  const sm = createStateManager(), seen = [];
  sm.onVarChange('score', () => { seen.push('A'); offB(); });
  const offB = sm.onVarChange('score', () => seen.push('B'));
  sm.onVarChange('score', () => seen.push('C'));
  sm.setVar('score', 1);
  assert.deepEqual(seen, ['A', 'B', 'C']);
  for (const value of [2, 3, 3]) {
    seen.length = 0;
    sm.setVar('score', value);
    assert.deepEqual(seen, ['A', 'C']);
  }
});

test('variable additions wait until next notification and remain ordered through later removal', () => {
  const sm = createStateManager(), seen = [];
  let offC;
  const offA = sm.onVarChange('score', () => {
    seen.push('A');
    if (!offC) offC = sm.onVarChange('score', () => seen.push('C'));
  });
  const offB = sm.onVarChange('score', () => seen.push('B'));
  sm.setVar('score', 1);
  assert.deepEqual(seen, ['A', 'B']);
  seen.length = 0; sm.setVar('score', 2);
  assert.deepEqual(seen, ['A', 'B', 'C']);
  offA(); offA(); offB();
  seen.length = 0; sm.setVar('score', 3);
  assert.deepEqual(seen, ['C']);
  offC(); offC();
  seen.length = 0; sm.setVar('score', 4);
  assert.deepEqual(seen, []);
});

test('duplicate variable callbacks have independent ordered and idempotent registrations', () => {
  const sm = createStateManager(), seen = [];
  const fn = () => seen.push('shared');
  const off1 = sm.onVarChange('score', fn), off2 = sm.onVarChange('score', fn);
  off1(); off1();
  sm.setVar('score', 1);
  assert.deepEqual(seen, ['shared']);
  off2(); off2();
  seen.length = 0; sm.setVar('score', 2);
  assert.deepEqual(seen, []);
  sm.onVarChange('score', fn);
  sm.onVarChange('score', () => seen.push('middle'));
  const offLast = sm.onVarChange('score', fn);
  offLast(); offLast();
  sm.setVar('score', 3);
  assert.deepEqual(seen, ['shared', 'middle']);
});

test('variable listener errors retain reporting and do not prevent later eligible callbacks', t => {
  const errors = [], seen = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const sm = createStateManager({ initialVars: { score: 0 } });
  const failure = new Error('variable listener failure');
  sm.onVarChange('score', () => { throw failure; });
  sm.onVarChange('score', (value, previous) => seen.push([value, previous]));
  sm.setVar('score', 1);
  assert.deepEqual(seen, [[1, 0]]);
  assert.equal(sm.getVar('score'), 1);
  assert.deepEqual(errors, [['[StateManager] Var listener error on score:', failure]]);
});

test('variable subscription mutations remain isolated by key', () => {
  const sm = createStateManager(), seen = [];
  const shared = (value, previous) => seen.push([value, previous]);
  const offA = sm.onVarChange('A', () => { seen.push('A'); offA(); });
  const offSharedA = sm.onVarChange('A', shared);
  const offSharedB = sm.onVarChange('B', shared);
  sm.setVar('A', 10);
  assert.deepEqual(seen, ['A', [10, undefined]]);
  offSharedA(); offSharedA();
  seen.length = 0;
  sm.setVar('B', 20); sm.setVar('A', 11); sm.setVar('B', 21);
  assert.deepEqual(seen, [[20, undefined], [21, 20]]);
  offSharedB(); offSharedB();
  seen.length = 0; sm.setVar('B', 22);
  assert.deepEqual(seen, []);
});

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
