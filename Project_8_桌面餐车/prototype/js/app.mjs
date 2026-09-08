import { CONFIG } from './config.mjs';
import {
  advanceSecond,
  createInitialState,
  setNextPlan,
  setPomodoroEnabled,
  startWork,
} from './pomodoro-state.mjs';
import { render } from './render.mjs';

const app = document.querySelector('#app');
let state = createInitialState(CONFIG);
let view = 'window';
let intervalId = null;

function syncTimer() {
  const shouldTick = state.phase === 'work' || state.phase === 'rest';

  if (shouldTick && intervalId === null) {
    intervalId = window.setInterval(() => update(advanceSecond(state, CONFIG)), CONFIG.timer.tickMilliseconds);
  }

  if (!shouldTick && intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function update(result) {
  if (result?.state) state = result.state;
  syncTimer();
  render(app, state, CONFIG, view);
}

function advanceTime(milliseconds) {
  let remaining = milliseconds;
  while (remaining >= CONFIG.timer.tickMilliseconds && (state.phase === 'work' || state.phase === 'rest')) {
    remaining -= CONFIG.timer.tickMilliseconds;
    state = advanceSecond(state, CONFIG).state;
  }
  syncTimer();
  render(app, state, CONFIG, view);
}

function selectedActivity() {
  return state.nextPlan?.activity || CONFIG.activities[0].id;
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;

  if (button.id === 'compact-window') {
    view = 'compact';
    update();
    return;
  }

  if (button.id === 'expand-window') {
    view = 'window';
    update();
    return;
  }

  if (button.dataset.activity) {
    const activity = CONFIG.activities.find((item) => item.id === button.dataset.activity);
    update(setNextPlan(state, { activity: activity.id, regionId: activity.regionIds[0] }, CONFIG));
    return;
  }

  if (button.dataset.region) {
    update(setNextPlan(state, { activity: selectedActivity(), regionId: button.dataset.region }, CONFIG));
    return;
  }

  if (button.id === 'start-work') update(startWork(state, CONFIG));
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'pomodoro-toggle') update(setPomodoroEnabled(state, event.target.checked, CONFIG));
});

window.render_game_to_text = () => JSON.stringify({ ...state, view });
window.advanceTime = advanceTime;
window.addEventListener('beforeunload', () => {
  if (intervalId !== null) window.clearInterval(intervalId);
});

update();
