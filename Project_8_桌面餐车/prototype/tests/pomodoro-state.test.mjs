import assert from 'node:assert/strict';
import test from 'node:test';

import { CONFIG } from '../js/config.mjs';
import {
  advanceSecond,
  createInitialState,
  setNextPlan,
  setPomodoroEnabled,
  startWork,
} from '../js/pomodoro-state.mjs';

test('requires a valid plan before a pomodoro work stage can start', () => {
  const initial = createInitialState(CONFIG);

  assert.deepEqual(startWork(initial, CONFIG), { ok: false, reason: 'plan-required' });

  const planned = setNextPlan(initial, { activity: 'travel', regionId: 'forest' }, CONFIG).state;
  const started = startWork(planned, CONFIG);

  assert.equal(started.ok, true);
  assert.equal(started.state.phase, 'work');
  assert.deepEqual(started.state.activePlan, { activity: 'travel', regionId: 'forest' });
  assert.equal(started.state.secondsRemaining, CONFIG.timer.workSeconds);
});

test('moves from work to rest and returns to planning after rest', () => {
  const configured = setNextPlan(
    createInitialState(CONFIG),
    { activity: 'operate', regionId: 'market' },
    CONFIG,
  ).state;
  let state = startWork(configured, CONFIG).state;

  for (let second = 0; second < CONFIG.timer.workSeconds; second += 1) {
    state = advanceSecond(state, CONFIG).state;
  }

  assert.equal(state.phase, 'rest');
  assert.deepEqual(state.lastCompletedPlan, { activity: 'operate', regionId: 'market' });
  assert.equal(state.activePlan, null);

  for (let second = 0; second < CONFIG.timer.restSeconds; second += 1) {
    state = advanceSecond(state, CONFIG).state;
  }

  assert.equal(state.phase, 'planning');
  assert.equal(state.secondsRemaining, null);
});

test('locks plan changes and pomodoro disabling during work', () => {
  const planned = setNextPlan(
    createInitialState(CONFIG),
    { activity: 'travel', regionId: 'forest' },
    CONFIG,
  ).state;
  const working = startWork(planned, CONFIG).state;

  assert.deepEqual(
    setNextPlan(working, { activity: 'operate', regionId: 'market' }, CONFIG),
    { ok: false, reason: 'management-locked' },
  );
  assert.deepEqual(setPomodoroEnabled(working, false, CONFIG), { ok: false, reason: 'work-in-progress' });
});

test('allows scheduling during rest but does not allow rest to be skipped', () => {
  const planned = setNextPlan(
    createInitialState(CONFIG),
    { activity: 'travel', regionId: 'forest' },
    CONFIG,
  ).state;
  let state = startWork(planned, CONFIG).state;

  for (let second = 0; second < CONFIG.timer.workSeconds; second += 1) {
    state = advanceSecond(state, CONFIG).state;
  }

  const rescheduled = setNextPlan(state, { activity: 'operate', regionId: 'market' }, CONFIG);

  assert.equal(rescheduled.ok, true);
  assert.deepEqual(startWork(rescheduled.state, CONFIG), { ok: false, reason: 'rest-in-progress' });
});

test('disabling pomodoro enters free management without automatic work', () => {
  const disabled = setPomodoroEnabled(createInitialState(CONFIG), false, CONFIG);

  assert.equal(disabled.ok, true);
  assert.equal(disabled.state.phase, 'free');
  assert.equal(disabled.state.pomodoroEnabled, false);
  assert.equal(startWork(disabled.state, CONFIG).reason, 'pomodoro-disabled');
});
