function clonePlan(plan) {
  return plan ? { activity: plan.activity, regionId: plan.regionId } : null;
}

function isValidPlan(plan, config) {
  const activity = config.activities.find((item) => item.id === plan?.activity);
  return Boolean(activity && activity.regionIds.includes(plan.regionId));
}

export function createInitialState() {
  return {
    pomodoroEnabled: true,
    phase: 'planning',
    nextPlan: null,
    activePlan: null,
    lastCompletedPlan: null,
    secondsRemaining: null,
  };
}

export function setNextPlan(state, plan, config) {
  if (state.phase === 'work') return { ok: false, reason: 'management-locked' };
  if (!isValidPlan(plan, config)) return { ok: false, reason: 'invalid-plan' };

  return { ok: true, state: { ...state, nextPlan: clonePlan(plan) } };
}

export function setPomodoroEnabled(state, enabled) {
  if (state.phase === 'work') return { ok: false, reason: 'work-in-progress' };

  return {
    ok: true,
    state: {
      ...state,
      pomodoroEnabled: enabled,
      phase: enabled ? 'planning' : 'free',
      secondsRemaining: null,
      activePlan: null,
    },
  };
}

export function startWork(state, config) {
  if (!state.pomodoroEnabled) return { ok: false, reason: 'pomodoro-disabled' };
  if (state.phase === 'work') return { ok: false, reason: 'work-in-progress' };
  if (state.phase === 'rest') return { ok: false, reason: 'rest-in-progress' };
  if (!isValidPlan(state.nextPlan, config)) return { ok: false, reason: 'plan-required' };

  return {
    ok: true,
    state: {
      ...state,
      phase: 'work',
      activePlan: clonePlan(state.nextPlan),
      secondsRemaining: config.timer.workSeconds,
    },
  };
}

export function advanceSecond(state, config) {
  if (state.phase !== 'work' && state.phase !== 'rest') return { ok: true, state };

  if (state.secondsRemaining > 1) {
    return { ok: true, state: { ...state, secondsRemaining: state.secondsRemaining - 1 } };
  }

  if (state.phase === 'work') {
    return {
      ok: true,
      state: {
        ...state,
        phase: 'rest',
        activePlan: null,
        lastCompletedPlan: clonePlan(state.activePlan),
        secondsRemaining: config.timer.restSeconds,
      },
    };
  }

  return { ok: true, state: { ...state, phase: 'planning', secondsRemaining: null } };
}
