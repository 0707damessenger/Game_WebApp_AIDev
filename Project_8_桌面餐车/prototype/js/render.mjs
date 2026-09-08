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

function phaseText(phase) {
  return {
    planning: '安排下一段工作',
    work: '专注进行中',
    rest: '休息时间',
    free: '自由管理',
  }[phase];
}

function sceneMarkup(activity) {
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
      <div class="scene-note">${isTraveling ? '沿路采集' : '餐车营业中'}</div>
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

export function render(app, state, config, view) {
  const locked = state.phase === 'work';
  const displayedPlan = state.activePlan || state.nextPlan || state.lastCompletedPlan;

  if (view === 'compact') {
    app.innerHTML = `
      <section class="compact-window" aria-label="桌面餐车小窗">
        <header class="compact-header">
          <span class="compact-title">桌面餐车</span>
          <button id="expand-window" class="icon-button" aria-label="展开普通窗口" title="展开普通窗口">↗</button>
        </header>
        ${sceneMarkup(displayedPlan?.activity)}
        <div class="compact-status">
          <p id="compact-phase">${phaseText(state.phase)}</p>
          <strong id="compact-timer">${formatTime(state.secondsRemaining)}</strong>
          <p id="compact-plan">${planText(displayedPlan, config)}</p>
        </div>
      </section>`;
    return;
  }

  app.innerHTML = `
    <section class="window-shell" aria-label="桌面餐车普通窗口">
      <header class="top-bar">
        <div class="brand"><span class="brand-mark"></span><span>桌面餐车</span></div>
        <div class="top-actions">
          <label class="switch-label" for="pomodoro-toggle">
            <input id="pomodoro-toggle" type="checkbox" ${state.pomodoroEnabled ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span class="switch-track" aria-hidden="true"></span>
            <span>番茄钟</span>
          </label>
          <button id="compact-window" class="icon-button" aria-label="切换到桌面小窗" title="切换到桌面小窗">↙</button>
        </div>
      </header>
      ${sceneMarkup(displayedPlan?.activity)}
      <section class="timer-panel" aria-label="当前番茄钟阶段">
        <div>
          <p class="eyebrow" id="phase-label">${phaseText(state.phase)}</p>
          <p id="active-plan">${planText(displayedPlan, config)}</p>
        </div>
        <strong id="timer">${formatTime(state.secondsRemaining)}</strong>
      </section>
      <section id="planning-panel" class="planning-panel" ${locked ? 'aria-disabled="true"' : ''}>
        <div class="section-heading"><h1>下一段</h1><span>${state.phase === 'rest' ? '休息结束后开始' : '选择路线'}</span></div>
        <div class="choice-row" aria-label="选择工作模式">${activityButtons(state, config, locked)}</div>
        <div class="choice-row" aria-label="选择地区">${regionButtons(state, config, locked)}</div>
        <button id="start-work" class="start-button" ${state.phase === 'planning' && state.pomodoroEnabled && state.nextPlan ? '' : 'disabled'}>开始工作</button>
      </section>
      <section id="management-panel" class="management-panel" ${locked ? 'aria-disabled="true"' : ''}>
        <button id="shop" class="management-button" ${locked ? 'disabled' : ''}><span class="tool-icon">◇</span>商店</button>
        <button id="research" class="management-button" ${locked ? 'disabled' : ''}><span class="tool-icon">⌁</span>研发</button>
        <button id="cook" class="management-button" ${locked ? 'disabled' : ''}><span class="tool-icon">◒</span>备餐</button>
      </section>
      <p id="management-status" class="management-status">${locked ? '工作中，管理功能已锁定' : '管理功能可用'}</p>
    </section>`;
}
