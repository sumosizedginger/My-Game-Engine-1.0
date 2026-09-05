import test from 'node:test';
import assert from 'node:assert/strict';

import { createStateManager } from '../src/runtime/state.js';
import { createRuleEngine } from '../src/runtime/rules.js';

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
