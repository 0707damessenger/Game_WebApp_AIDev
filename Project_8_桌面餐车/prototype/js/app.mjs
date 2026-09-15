import { CONFIG } from './config.mjs';
import {
  advanceSecond,
  createInitialState,
  setNextPlan,
  setPomodoroEnabled,
  startWork,
} from './pomodoro-state.mjs';
import { render } from './render.mjs';
import {
  advanceTravelSecond,
  createInitialTravelState,
  openChest,
} from './travel-state.mjs';

const app = document.querySelector('#app');
let state = createInitialState(CONFIG);
let travelState = createInitialTravelState(CONFIG);
let menuOpen = false;
let menuPanel = 'arrange';
let intervalId = null;
let noticeTimeoutId = null;
let visibleNoticeId = null;

function isTicking() {
  return state.phase === 'work' || state.phase === 'rest' || (!state.pomodoroEnabled && Boolean(state.activePlan));
}

function syncTimer() {
  const shouldTick = isTicking();

  if (shouldTick && intervalId === null) {
    intervalId = window.setInterval(() => update(advanceGameSecond()), CONFIG.timer.tickMilliseconds);
  }

  if (!shouldTick && intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function advanceGameSecond() {
  if (state.activePlan?.activity === 'travel') {
    travelState = advanceTravelSecond(travelState, state.activePlan, CONFIG).state;
  }
  return advanceSecond(state, CONFIG);
}

function syncNotice() {
  if (!state.notice || state.notice.id === visibleNoticeId) return;

  if (noticeTimeoutId !== null) window.clearTimeout(noticeTimeoutId);
  visibleNoticeId = state.notice.id;
  noticeTimeoutId = window.setTimeout(() => {
    if (state.notice?.id === visibleNoticeId) {
      state = { ...state, notice: null };
      render(app, state, CONFIG, { menuOpen, menuPanel, travelState });
    }
  }, CONFIG.ui.noticeMilliseconds);
}

function update(result) {
  if (result?.state) state = result.state;
  syncTimer();
  syncNotice();
  render(app, state, CONFIG, { menuOpen, menuPanel, travelState });
}

function advanceTime(milliseconds) {
  let remaining = milliseconds;
  while (remaining >= CONFIG.timer.tickMilliseconds && isTicking()) {
    remaining -= CONFIG.timer.tickMilliseconds;
    state = advanceGameSecond().state;
  }
  syncTimer();
  syncNotice();
  render(app, state, CONFIG, { menuOpen, menuPanel, travelState });
}

function selectedActivity() {
  return state.nextPlan?.activity || CONFIG.activities[0].id;
}

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;

  if (button.id === 'menu-toggle') {
    menuOpen = !menuOpen;
    update();
    return;
  }

  if (button.dataset.menuPanel) {
    menuPanel = button.dataset.menuPanel;
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

  if (button.dataset.chestId) {
    const result = openChest(travelState, Number(button.dataset.chestId), CONFIG);
    if (result.ok) travelState = result.state;
    update();
    return;
  }

  if (button.id === 'start-work') update(startWork(state, CONFIG));
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'pomodoro-toggle') update(setPomodoroEnabled(state, event.target.checked, CONFIG));
});

window.render_game_to_text = () => JSON.stringify({ ...state, travel: travelState, menuOpen, menuPanel });
window.advanceTime = advanceTime;
window.addEventListener('beforeunload', () => {
  if (intervalId !== null) window.clearInterval(intervalId);
  if (noticeTimeoutId !== null) window.clearTimeout(noticeTimeoutId);
});

update();
