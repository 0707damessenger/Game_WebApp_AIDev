function formatTime(seconds) {
  if (seconds === null) return '--:--';
  return `00:${String(seconds).padStart(2, '0')}`;
}

function getActivity(plan, config) {
  return config.activities.find((item) => item.id === plan?.activity);
}

function getRegion(plan, config) {
  return config.regions.find((item) => item.id === plan?.regionId);
}

function planText(plan, config) {
  if (!plan) return '尚未安排';
  return `${getActivity(plan, config)?.label} · ${getRegion(plan, config)?.label}`;
}

function phaseText(state, config) {
  if (!state.pomodoroEnabled && state.activePlan) return `${getActivity(state.activePlan, config)?.label}进行中`;
  return {
    planning: '安排下一段工作',
    work: '专注进行中',
    rest: '休息时间',
    free: '自由管理',
  }[state.phase];
}

function sceneMarkup(activity, isResting) {
  const isTraveling = activity === 'travel';
  return `
    <div class="scene ${isTraveling ? 'is-traveling' : 'is-operating'}" aria-hidden="true">
      <div class="sky-detail cloud-one"></div>
      <div class="sky-detail cloud-two"></div>
      <div class="hills"></div>
      <div class="road"></div>
      <div class="truck">
        <div class="awning"></div>
        <div class="window"></div>
        <div class="counter"></div>
        <div class="wheel wheel-left"></div>
        <div class="wheel wheel-right"></div>
      </div>
      <div class="scene-note">${isResting ? '餐车休息中' : isTraveling ? '沿路采集' : '餐车营业中'}</div>
    </div>`;
}

function activityButtons(state, config, locked) {
  const selectedActivity = state.nextPlan?.activity || config.activities[0].id;
  return config.activities.map((activity) => `
    <button class="activity-choice ${activity.id === selectedActivity ? 'is-selected' : ''}" data-activity="${activity.id}" ${locked ? 'disabled' : ''}>
      ${activity.label}
    </button>`).join('');
}

function regionButtons(state, config, locked) {
  const selectedActivity = state.nextPlan?.activity || config.activities[0].id;
  const activity = config.activities.find((item) => item.id === selectedActivity);
  return activity.regionIds.map((regionId) => {
    const region = config.regions.find((item) => item.id === regionId);
    return `
      <button class="region-choice ${state.nextPlan?.regionId === region.id ? 'is-selected' : ''}" data-region="${region.id}" ${locked ? 'disabled' : ''}>
        ${region.label}
      </button>`;
  }).join('');
}

function startLabel(state, config) {
  if (state.pomodoroEnabled) return '开始专注';
  if (state.activePlan) return `${getActivity(state.activePlan, config)?.label}进行中`;
  return `启动${getActivity(state.nextPlan, config)?.label || '活动'}`;
}

function drawerMarkup(state, config, menuPanel) {
  const locked = state.phase === 'work';
  const canStart = state.pomodoroEnabled
    ? state.phase === 'planning' && state.nextPlan
    : Boolean(state.nextPlan) && !state.activePlan;

  return `
    <aside id="menu-drawer" class="menu-drawer" aria-label="餐车菜单">
      <nav class="menu-tabs" aria-label="菜单分类">
        <button id="arrange-menu-button" class="menu-tab ${menuPanel === 'arrange' ? 'is-selected' : ''}" data-menu-panel="arrange" ${locked ? 'disabled' : ''}>安排</button>
        <button id="pomodoro-menu-button" class="menu-tab ${menuPanel === 'pomodoro' ? 'is-selected' : ''}" data-menu-panel="pomodoro" ${locked ? 'disabled' : ''}>番茄钟</button>
        <button class="menu-tab" disabled title="后续模块开放">研发</button>
        <button class="menu-tab" disabled title="后续模块开放">商店</button>
      </nav>
      ${menuPanel === 'arrange' ? `
        <section id="arrange-panel" class="menu-panel">
          <p class="menu-heading">${state.phase === 'rest' ? '休息后开始' : '下一段'}</p>
          <div class="choice-row" aria-label="选择工作模式">${activityButtons(state, config, locked)}</div>
          <div class="choice-row" aria-label="选择地区">${regionButtons(state, config, locked)}</div>
          <button id="start-work" class="start-button" ${canStart ? '' : 'disabled'}>${startLabel(state, config)}</button>
        </section>` : `
        <section id="pomodoro-panel" class="menu-panel">
          <label class="switch-label" for="pomodoro-toggle">
            <input id="pomodoro-toggle" type="checkbox" ${state.pomodoroEnabled ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span class="switch-track" aria-hidden="true"></span>
            <span>番茄钟</span>
          </label>
          <p class="menu-hint">${state.pomodoroEnabled ? '工作与休息自动切换' : '活动由你手动开始'}</p>
        </section>`}
    </aside>`;
}

export function render(app, state, config, { menuOpen, menuPanel }) {
  const displayedPlan = state.activePlan || state.nextPlan || state.lastCompletedPlan;
  app.innerHTML = `
    <section class="floating-window" aria-label="桌面餐车悬浮窗">
      <header class="window-header">
        <div class="brand"><span class="brand-mark"></span><span>桌面餐车</span></div>
        <button id="menu-toggle" class="icon-button" aria-label="${menuOpen ? '关闭菜单' : '打开菜单'}" title="${menuOpen ? '关闭菜单' : '打开菜单'}">☰</button>
      </header>
      <div class="scene-wrap">
        ${sceneMarkup(displayedPlan?.activity, state.phase === 'rest')}
        ${state.notice ? `<div id="phase-notice" class="phase-notice" role="status"><strong>${state.notice.title}</strong><span>${state.notice.detail}</span></div>` : ''}
      </div>
      <section class="status-strip" aria-label="当前状态">
        <div>
          <p id="phase-label">${phaseText(state, config)}</p>
          <p id="active-plan">${planText(displayedPlan, config)}</p>
        </div>
        <strong id="timer">${formatTime(state.secondsRemaining)}</strong>
      </section>
      ${menuOpen ? drawerMarkup(state, config, menuPanel) : ''}
    </section>`;
}
