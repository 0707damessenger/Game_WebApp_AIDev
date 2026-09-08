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
let menuOpen = false;
let menuPanel = 'arrange';
let intervalId = null;
let noticeTimeoutId = null;
let visibleNoticeId = null;

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

function syncNotice() {
  if (!state.notice || state.notice.id === visibleNoticeId) return;

  if (noticeTimeoutId !== null) window.clearTimeout(noticeTimeoutId);
  visibleNoticeId = state.notice.id;
  noticeTimeoutId = window.setTimeout(() => {
    if (state.notice?.id === visibleNoticeId) {
      state = { ...state, notice: null };
      render(app, state, CONFIG, { menuOpen, menuPanel });
    }
  }, CONFIG.ui.noticeMilliseconds);
}

function update(result) {
  if (result?.state) state = result.state;
  syncTimer();
  syncNotice();
  render(app, state, CONFIG, { menuOpen, menuPanel });
}

function advanceTime(milliseconds) {
  let remaining = milliseconds;
  while (remaining >= CONFIG.timer.tickMilliseconds && (state.phase === 'work' || state.phase === 'rest')) {
    remaining -= CONFIG.timer.tickMilliseconds;
    state = advanceSecond(state, CONFIG).state;
  }
  syncTimer();
  syncNotice();
  render(app, state, CONFIG, { menuOpen, menuPanel });
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

  if (button.id === 'start-work') update(startWork(state, CONFIG));
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'pomodoro-toggle') update(setPomodoroEnabled(state, event.target.checked, CONFIG));
});

window.render_game_to_text = () => JSON.stringify({ ...state, menuOpen, menuPanel });
window.advanceTime = advanceTime;
window.addEventListener('beforeunload', () => {
  if (intervalId !== null) window.clearInterval(intervalId);
  if (noticeTimeoutId !== null) window.clearTimeout(noticeTimeoutId);
});

update();
