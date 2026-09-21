import { CONFIG } from './config.mjs';
import {
  advanceSecond,
  createInitialState,
  setNextPlan,
  setPomodoroEnabled,
  startWork,
} from './pomodoro-state.mjs';
import { render } from './render.mjs';
import { clampPosition } from './window-position.mjs';
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
let renderedNoticeId = null;
let windowPosition = null;
let dragState = null;

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
      renderApp();
    }
  }, CONFIG.ui.noticeMilliseconds);
}

function renderApp() {
  render(app, state, CONFIG, {
    menuOpen,
    menuPanel,
    travelState,
    windowPosition,
    noticeIsNew: Boolean(state.notice && state.notice.id !== renderedNoticeId),
  });
  if (state.notice) renderedNoticeId = state.notice.id;

  if (!windowPosition) {
    const element = app.querySelector('.floating-window');
    const rect = element.getBoundingClientRect();
    windowPosition = clampPosition(
      { x: rect.left, y: rect.top },
      { width: rect.width, height: rect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    renderApp();
    return;
  }

  const menu = app.querySelector('#menu-drawer');
  if (menu) {
    const element = app.querySelector('.floating-window');
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.top < 0) {
      windowPosition = clampPosition(
        { x: windowPosition.x, y: windowPosition.y - menuRect.top + 4 },
        { width: element.offsetWidth, height: element.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      renderApp();
    }
  }
}

function update(result) {
  if (result?.state) state = result.state;
  syncTimer();
  syncNotice();
  renderApp();
}

function advanceTime(milliseconds) {
  let remaining = milliseconds;
  while (remaining >= CONFIG.timer.tickMilliseconds && isTicking()) {
    remaining -= CONFIG.timer.tickMilliseconds;
    state = advanceGameSecond().state;
  }
  syncTimer();
  syncNotice();
  renderApp();
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

  if (button.id === 'start-work') {
    const result = startWork(state, CONFIG);
    if (result.ok) menuOpen = false;
    update(result);
  }
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'pomodoro-toggle') update(setPomodoroEnabled(state, event.target.checked, CONFIG));
});

window.render_game_to_text = () => JSON.stringify({ ...state, travel: travelState, menuOpen, menuPanel });
window.advanceTime = advanceTime;
app.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('#menu-drawer') || event.target.closest('button, input, label')) return;
  const windowElement = app.querySelector('.floating-window');
  const rect = windowElement.getBoundingClientRect();
  dragState = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, element: windowElement };
  windowElement.setPointerCapture(event.pointerId);
  windowElement.classList.add('is-dragging');
});
app.addEventListener('pointermove', (event) => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const next = clampPosition(
    { x: event.clientX - dragState.offsetX, y: event.clientY - dragState.offsetY },
    { width: dragState.element.offsetWidth, height: dragState.element.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  );
  windowPosition = next;
  dragState.element.style.left = `${next.x}px`;
  dragState.element.style.top = `${next.y}px`;
});
function finishDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  dragState.element.classList.remove('is-dragging');
  if (dragState.element.hasPointerCapture(event.pointerId)) dragState.element.releasePointerCapture(event.pointerId);
  dragState = null;
}
app.addEventListener('pointerup', finishDrag);
app.addEventListener('pointercancel', finishDrag);
window.addEventListener('resize', () => {
  if (!windowPosition) return;
  const element = app.querySelector('.floating-window');
  if (!element) return;
  windowPosition = clampPosition(windowPosition, { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
  renderApp();
});
window.addEventListener('beforeunload', () => {
  if (intervalId !== null) window.clearInterval(intervalId);
  if (noticeTimeoutId !== null) window.clearTimeout(noticeTimeoutId);
});

renderApp();
