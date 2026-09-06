import { CONFIG } from './config.mjs';
import { createInitialState } from './rules.mjs';
import { renderApp, stateToText } from './render.mjs';
import { createInputController } from './input.mjs';

const query = new URLSearchParams(window.location.search);
const demoMode = query.has('demo');
let localPlayerId = demoMode ? CONFIG.players[0].id : null;
let state = demoMode ? createInitialState({ config: CONFIG, random: () => 0 }) : null;
const session = {
  roomId: null,
  playerId: null,
  token: null,
  host: false,
  eventSource: null,
};
const elements = {
  board: document.querySelector('#board'),
  playerList: document.querySelector('#player-list'),
  hand: document.querySelector('#hand'),
  turnChip: document.querySelector('#turn-chip'),
  turnNumber: document.querySelector('#turn-number'),
  starterName: document.querySelector('#starter-name'),
  localPlayerName: document.querySelector('#local-player-name'),
  statusMessage: document.querySelector('#status-message'),
  handCount: document.querySelector('#hand-count'),
  eventMessage: document.querySelector('#event-message'),
  previewMessage: document.querySelector('#preview-message'),
  resultMessage: document.querySelector('#result-message'),
  connectionStatus: document.querySelector('#connection-status'),
  endTurn: document.querySelector('#end-turn'),
  actionHint: document.querySelector('#action-hint'),
  lobbyPanel: document.querySelector('#lobby-panel'),
  lobbyStatus: document.querySelector('#lobby-status'),
  createRoom: document.querySelector('#create-room'),
  roomIdInput: document.querySelector('#room-id-input'),
  joinRoom: document.querySelector('#join-room'),
  startGame: document.querySelector('#start-game'),
  roomInfo: document.querySelector('#room-info'),
  gameView: document.querySelector('#game-view'),
};
const selection = {
  selectedCardId: null,
  pendingAction: null,
  path: [],
  reachable: [],
  previewCell: null,
  previewHoverCell: null,
  previewTargets: [],
  previewResult: null,
  previewNotice: '',
  feedback: '',
  feedbackTone: 'neutral',
};
let virtualTime = 0;

elements.board.style.setProperty('--board-size', CONFIG.board.size);

function clearSelectionState() {
  selection.selectedCardId = null;
  selection.pendingAction = null;
  selection.path = [];
  selection.reachable = [];
  selection.previewCell = null;
  selection.previewHoverCell = null;
  selection.previewTargets = [];
  selection.previewResult = null;
  selection.previewNotice = '';
}

function renderLobby() {
  const inRoom = Boolean(session.roomId);
  const inLobby = state?.phase === 'lobby';
  const connectedPlayers = state?.connection?.connectedPlayers || [];
  elements.lobbyPanel.hidden = demoMode || (Boolean(state) && !inLobby);
  elements.gameView.hidden = !state || (!demoMode && inLobby);
  elements.createRoom.disabled = inRoom;
  elements.joinRoom.disabled = inRoom;
  elements.roomIdInput.disabled = inRoom;
  elements.startGame.disabled = !(
    session.host && inLobby && connectedPlayers.includes('p1') && connectedPlayers.includes('p2')
  );
  if (!inRoom) {
    elements.lobbyStatus.textContent = '创建房间开始';
    elements.roomInfo.textContent = '创建后把房间号和本页面地址交给另一名玩家。';
  } else {
    const connected = connectedPlayers.length;
    elements.lobbyStatus.textContent = `${connected} / ${CONFIG.players.length} 人已连接`;
    elements.roomInfo.textContent = `房间号：${session.roomId} · ${session.host ? '你是房主，等待玩家加入' : '等待房主开始对局'}`;
  }
}

function render() {
  renderLobby();
  if (state && localPlayerId) renderApp(elements, state, localPlayerId, selection);
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || 'request-failed');
    error.reason = payload.reason;
    throw error;
  }
  return payload;
}

function persistSession() {
  if (demoMode || !session.roomId) return;
  localStorage.setItem('spellatoon-session', JSON.stringify({
    roomId: session.roomId,
    playerId: session.playerId,
    token: session.token,
    host: session.host,
  }));
}

function restoreSession() {
  if (demoMode) return;
  try {
    const saved = JSON.parse(localStorage.getItem('spellatoon-session') || 'null');
    if (!saved?.roomId || !saved?.playerId || !saved?.token) return;
    Object.assign(session, saved);
  } catch {
    localStorage.removeItem('spellatoon-session');
  }
}

function applyView(view) {
  const isSameView = state && JSON.stringify(state) === JSON.stringify(view);
  state = view;
  localPlayerId = view.localPlayerId;
  if (!isSameView) {
    clearSelectionState();
    selection.feedback = '';
    selection.feedbackTone = 'neutral';
  }
  render();
}

function connectEvents() {
  if (!session.roomId || !session.playerId || !session.token) return Promise.reject(new Error('missing-session'));
  session.eventSource?.close();
  return new Promise((resolve, reject) => {
    const url = `/api/rooms/${encodeURIComponent(session.roomId)}/events?playerId=${encodeURIComponent(session.playerId)}&token=${encodeURIComponent(session.token)}`;
    const source = new EventSource(url);
    let receivedState = false;
    source.addEventListener('state', (event) => {
      receivedState = true;
      applyView(JSON.parse(event.data));
      resolve();
    });
    source.onerror = () => {
      if (!receivedState) {
        source.close();
        reject(new Error('events-unavailable'));
        return;
      }
      elements.lobbyStatus.textContent = '连接中断，正在等待重连';
      if (elements.connectionStatus) elements.connectionStatus.textContent = '连接中断';
    };
    session.eventSource = source;
  });
}

async function createRoom() {
  try {
    const room = await postJson('/api/rooms', {});
    Object.assign(session, {
      roomId: room.roomId,
      playerId: room.playerId,
      token: room.token,
      host: room.host,
    });
    persistSession();
    await connectEvents();
  } catch {
    elements.lobbyStatus.textContent = '无法连接房间服务';
  }
  render();
}

async function joinRoom() {
  const roomId = elements.roomIdInput.value.trim();
  if (!roomId) {
    elements.lobbyStatus.textContent = '请输入房间号';
    return;
  }
  try {
    const room = await postJson(`/api/rooms/${encodeURIComponent(roomId)}/join`, {});
    Object.assign(session, {
      roomId: room.roomId,
      playerId: room.playerId,
      token: room.token,
      host: room.host,
    });
    persistSession();
    await connectEvents();
  } catch (error) {
    elements.lobbyStatus.textContent = error.reason === 'room-full' ? '房间已满' : '加入房间失败';
  }
  render();
}

async function startGame() {
  try {
    const view = await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/start`, {
      playerId: session.playerId,
      token: session.token,
    });
    applyView(view);
  } catch {
    elements.lobbyStatus.textContent = '还不能开始对局';
  }
}

async function submitAction(action) {
  const view = await postJson(`/api/rooms/${encodeURIComponent(session.roomId)}/action`, {
    ...action,
    playerId: session.playerId,
    token: session.token,
  });
  applyView(view);
  return { ok: true, state: view, event: view.lastEvent };
}

elements.createRoom.addEventListener('click', createRoom);
elements.joinRoom.addEventListener('click', joinRoom);
elements.startGame.addEventListener('click', startGame);

createInputController({
  elements,
  getState: () => state,
  getSelection: () => selection,
  setState: (nextState) => { state = nextState; },
  render,
  localPlayerId,
  getLocalPlayerId: () => localPlayerId,
  config: CONFIG,
  submitAction: demoMode ? null : submitAction,
});

window.render_game_to_text = () => state
  ? stateToText(state, localPlayerId)
  : JSON.stringify({ phase: 'lobby', roomId: session.roomId, localPlayerId: session.playerId });
window.advanceTime = (ms = 0) => {
  virtualTime += Number(ms) || 0;
  render();
};

restoreSession();
if (!demoMode && session.roomId) {
  connectEvents().catch(() => {
    localStorage.removeItem('spellatoon-session');
    Object.assign(session, { roomId: null, playerId: null, token: null, host: false });
    render();
  });
}
render();
