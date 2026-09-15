import { CONFIG } from './config.mjs';
import {
  endTurn,
  lockPreviewCell,
  performDeploy,
  performMove,
  createInitialState,
} from './rules.mjs';
import { renderApp, stateToText } from './render.mjs';

const elements = {
  actionNote: document.querySelector('#action-note'),
  actionPoints: document.querySelector('#action-points'),
  board: document.querySelector('#board'),
  createRoom: document.querySelector('#create-room'),
  endTurn: document.querySelector('#end-turn'),
  hand: document.querySelector('#hand'),
  handCount: document.querySelector('#hand-count'),
  handPanel: document.querySelector('#hand-panel'),
  handoffDialog: document.querySelector('#handoff-dialog'),
  handoffStart: document.querySelector('#handoff-start'),
  handoffSwatch: document.querySelector('#handoff-swatch'),
  lifeSummary: document.querySelector('#life-summary'),
  joinRoom: document.querySelector('#join-room'),
  roomIdInput: document.querySelector('#room-id-input'),
  roomStatus: document.querySelector('#room-status'),
  previewSummary: document.querySelector('#preview-summary'),
  scoreSummary: document.querySelector('#score-summary'),
  soloStart: document.querySelector('#solo-start'),
  startGame: document.querySelector('#start-game'),
  settlement: document.querySelector('#settlement'),
  territorySummary: document.querySelector('#territory-summary'),
  turnIndicator: document.querySelector('#turn-indicator'),
};

const soloMode = new URLSearchParams(window.location.search).has('solo');
let state = createInitialState({ config: CONFIG, random: () => 0 });
let selection = {
  selectedCardId: null,
  pendingTarget: null,
  hoveredCell: null,
  previewCell: null,
  previewHoverCell: null,
  message: '',
};
let handoffRequired = soloMode;
let networkSession = null;
let eventSource = null;

function currentLocalPlayerId() {
  return networkSession?.playerId || state.activePlayerId;
}

function roomPath(suffix) {
  return `/api/rooms/${networkSession.roomId}/${suffix}`;
}

async function postJson(path, payload = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'network-error');
  return body;
}

function connectEvents() {
  eventSource?.close();
  eventSource = new EventSource(`${roomPath('events')}?playerId=${networkSession.playerId}&token=${networkSession.token}`);
  eventSource.addEventListener('state', (event) => {
    state = JSON.parse(event.data);
    elements.startGame.disabled = !networkSession.host
      || !state.connection?.joinedPlayers?.includes('p2');
    resetSelection('');
    render();
  });
}

function setSession(session) {
  networkSession = session;
  elements.roomStatus.textContent = `房间号：${session.roomId}${session.host ? ' · 等待另一位玩家' : ' · 已加入房间'}`;
  elements.roomIdInput.value = session.roomId;
  elements.startGame.disabled = true;
  connectEvents();
}

function pathTo(start, target) {
  const path = [];
  let row = start.row;
  let col = start.col;
  while (col !== target.col) {
    col += Math.sign(target.col - col);
    path.push({ row, col });
  }
  while (row !== target.row) {
    row += Math.sign(target.row - row);
    path.push({ row, col });
  }
  return path;
}

function resetSelection(message = '') {
  selection = {
    selectedCardId: null,
    pendingTarget: null,
    hoveredCell: null,
    previewCell: null,
    previewHoverCell: null,
    message,
  };
}

function render() {
  const activePlayer = state.players.find((player) => player.id === state.activePlayerId);
  const handsVisible = !soloMode || !handoffRequired;
  elements.handoffDialog.hidden = !handoffRequired;
  elements.handoffSwatch.style.setProperty('--player-color', activePlayer.color);
  renderApp(elements, state, { ...selection, handsVisible });
}

function applyAction(result) {
  if (!result.ok) {
    selection.message = '当前操作不合法。';
    render();
    return;
  }
  state = result.state;
  if (soloMode && result.event.type === 'turn-ended' && state.phase === 'playing') handoffRequired = true;
  resetSelection(result.event.type === 'deploy' && result.event.effects.length
    ? `${result.event.effects[0].type === 'chain' ? '触发连锁' : '发生吞噬'}，获得 ${result.event.scoreDelta} 分。`
    : '行动完成。');
  render();
}

async function applyNetworkAction(payload) {
  try {
    const view = await postJson(roomPath('action'), {
      playerId: networkSession.playerId,
      token: networkSession.token,
      ...payload,
    });
    state = view;
    resetSelection('行动完成。');
  } catch {
    selection.message = '当前操作不合法。';
  }
  render();
}

elements.hand.addEventListener('click', (event) => {
  if (handoffRequired) return;
  const card = event.target.closest('.card');
  if (!card) return;
  selection = {
    selectedCardId: selection.selectedCardId === card.dataset.cardId ? null : card.dataset.cardId,
    pendingTarget: null,
    hoveredCell: null,
    previewCell: null,
    previewHoverCell: null,
    message: '',
  };
  render();
});

elements.board.addEventListener('click', (event) => {
  if (handoffRequired) return;
  const cellElement = event.target.closest('.cell');
  if (!cellElement || state.phase !== 'playing') return;
  const target = { row: Number(cellElement.dataset.row), col: Number(cellElement.dataset.col) };
  if (!selection.selectedCardId) {
    const isLockedCell = selection.previewCell
      && selection.previewCell.row === target.row
      && selection.previewCell.col === target.col;
    if (isLockedCell) {
      selection.previewCell = null;
      selection.previewHoverCell = target;
      selection.message = '';
      render();
      return;
    }
    const locked = lockPreviewCell(state, target, CONFIG);
    if (!locked.ok) {
      selection.message = locked.reason === 'occupied-cell'
        ? '卡牌格只能悬浮查看，不能锁定。'
        : '无法锁定棋盘外的位置。';
      render();
      return;
    }
    selection.previewCell = locked.previewCell;
    selection.previewHoverCell = target;
    selection.message = '';
    render();
    return;
  }
  const player = state.players.find((candidate) => candidate.id === currentLocalPlayerId());
  if (!player || state.activePlayerId !== player.id) return;
  const deploy = target.row === player.position.row && target.col === player.position.col;
  const pendingMatches = selection.pendingTarget
    && selection.pendingTarget.row === target.row
    && selection.pendingTarget.col === target.col;
  if (!pendingMatches) {
    selection.pendingTarget = target;
    selection.message = deploy ? '再次点击当前格部署。' : '再次点击目标格移动。';
    render();
    return;
  }
  if (networkSession) {
    applyNetworkAction(deploy
      ? { type: 'deploy', cardId: selection.selectedCardId }
      : { type: 'move', cardId: selection.selectedCardId, path: pathTo(player.position, target) });
  } else {
    applyAction(deploy
      ? performDeploy(state, player.id, selection.selectedCardId, CONFIG)
      : performMove(state, player.id, selection.selectedCardId, pathTo(player.position, target), CONFIG));
  }
});

elements.board.addEventListener('pointerover', (event) => {
  if (handoffRequired) return;
  const cellElement = event.target.closest('.cell');
  if (!cellElement) return;
  const hoveredCell = { row: Number(cellElement.dataset.row), col: Number(cellElement.dataset.col) };
  if (!selection.selectedCardId) {
    if (selection.previewHoverCell?.row === hoveredCell.row && selection.previewHoverCell?.col === hoveredCell.col) return;
    selection.previewHoverCell = hoveredCell;
    render();
    return;
  }
  if (selection.hoveredCell?.row === hoveredCell.row && selection.hoveredCell?.col === hoveredCell.col) return;
  selection.hoveredCell = hoveredCell;
  render();
});

elements.board.addEventListener('mouseleave', () => {
  if (selection.selectedCardId) {
    if (!selection.hoveredCell) return;
    selection.hoveredCell = null;
  } else {
    if (!selection.previewHoverCell) return;
    selection.previewHoverCell = null;
  }
  render();
});

elements.endTurn.addEventListener('click', () => {
  if (handoffRequired) return;
  if (networkSession) applyNetworkAction({ type: 'end-turn' });
  else applyAction(endTurn(state, state.activePlayerId, CONFIG, () => 0));
});

elements.handoffStart.addEventListener('click', () => {
  handoffRequired = false;
  resetSelection('');
  render();
});

elements.soloStart.addEventListener('click', () => {
  if (!soloMode) window.location.search = '?solo';
});

elements.createRoom.addEventListener('click', async () => {
  try {
    setSession(await postJson('/api/rooms'));
  } catch {
    elements.roomStatus.textContent = '无法创建房间。请确认已从对局服务器打开页面。';
  }
});

elements.joinRoom.addEventListener('click', async () => {
  const roomId = elements.roomIdInput.value.trim();
  if (!/^\d{4}$/.test(roomId)) {
    elements.roomStatus.textContent = '请输入四位房间号。';
    return;
  }
  try {
    setSession(await postJson(`/api/rooms/${roomId}/join`));
  } catch {
    elements.roomStatus.textContent = '无法加入房间。';
  }
});

elements.startGame.addEventListener('click', async () => {
  if (!networkSession?.host) return;
  try {
    state = await postJson(roomPath('start'), {
      playerId: networkSession.playerId,
      token: networkSession.token,
    });
    elements.roomStatus.textContent = `房间号：${networkSession.roomId} · 对局开始`;
    render();
  } catch {
    elements.roomStatus.textContent = '仍在等待另一位玩家。';
  }
});

window.render_game_to_text = () => stateToText(state, {
  handsVisible: !soloMode || !handoffRequired,
  selection,
});
window.advanceTime = () => render();

render();
