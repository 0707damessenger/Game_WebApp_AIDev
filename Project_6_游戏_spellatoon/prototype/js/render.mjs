import { CONFIG } from './config.mjs';

function playerById(state, id) {
  return state.players.find((player) => player.id === id);
}

export function getPlayerAtCell(state, cell) {
  return state.players.find((player) => (
    player.position.row === cell.row && player.position.col === cell.col
  ));
}

function hasCell(cells, row, col) {
  return cells.some((cell) => cell.row === row && cell.col === col);
}

function renderBoard(boardElement, state, selection) {
  boardElement.replaceChildren();
  for (const cell of state.board) {
    const element = document.createElement('div');
    const player = cell.ownerId ? playerById(state, cell.ownerId) : null;
    const characterPlayer = getPlayerAtCell(state, cell);
    element.className = 'cell coordinate';
    element.dataset.coordinate = `${cell.row + 1},${cell.col + 1}`;
    element.dataset.row = cell.row;
    element.dataset.col = cell.col;
    if (hasCell(selection.reachable, cell.row, cell.col)) element.classList.add('reachable-cell');
    const pathIndex = selection.path.findIndex((pathCell) => (
      pathCell.row === cell.row && pathCell.col === cell.col
    ));
    if (pathIndex >= 0) {
      element.classList.add('path-cell');
      element.dataset.pathIndex = pathIndex + 1;
    }
    if (characterPlayer) element.classList.add('character-cell');
    if (selection.mode === 'deploy' && characterPlayer?.id === selection.localPlayerId) {
      element.classList.add('deploy-target');
    }
    if (player) {
      element.classList.add('owned-cell');
      element.style.setProperty('--owner-color', player.color);
    }
    if (characterPlayer) {
      const character = document.createElement('div');
      character.className = 'character';
      character.title = characterPlayer.label;
      character.dataset.playerId = characterPlayer.id;
      character.style.setProperty('--player-color', characterPlayer.color);
      element.append(character);
    }
    if (cell.card) {
      element.dataset.card = cell.card.value;
      const card = document.createElement('div');
      card.className = 'cell-card';
      card.textContent = cell.card.value;
      const cardOwner = playerById(state, cell.card.ownerId);
      card.style.setProperty('--card-owner-color', cardOwner?.color || 'var(--ink)');
      element.append(card);
    }
    boardElement.append(element);
  }
}

function renderPlayers(listElement, state, localPlayerId) {
  listElement.replaceChildren();
  for (const player of state.players) {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `<span class="player-swatch" style="background:${player.color}"></span><span><span class="player-name">${player.label}</span><br><span class="player-detail">位置 ${player.position.row + 1}, ${player.position.col + 1}${player.id === localPlayerId ? ' · 本机' : ' · 对手'}</span></span><strong class="player-score">${player.score} 分</strong>`;
    listElement.append(row);
  }
}

function renderHand(handElement, player, state, localPlayerId, selection) {
  handElement.replaceChildren();
  for (const card of player.hand) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'card';
    element.dataset.cardId = card.id;
    element.textContent = card.value;
    element.setAttribute('aria-label', `数字卡牌 ${card.value}`);
    element.classList.toggle('selected-card', selection.selectedCardId === card.id);
    element.disabled = state.activePlayerId !== localPlayerId || state.phase !== 'playing';
    handElement.append(element);
  }
}

export function renderApp(elements, state, localPlayerId, selection = {}) {
  const localPlayer = playerById(state, localPlayerId);
  const starter = playerById(state, state.starterId);
  const active = playerById(state, state.activePlayerId);
  const currentSelection = {
    selectedCardId: null,
    mode: null,
    path: [],
    reachable: [],
    localPlayerId,
    ...selection,
  };
  renderBoard(elements.board, state, currentSelection);
  renderPlayers(elements.playerList, state, localPlayerId);
  renderHand(elements.hand, localPlayer, state, localPlayerId, currentSelection);
  elements.turnChip.textContent = `第 ${state.turnNumber} 回合 · ${active.label}行动`;
  elements.turnNumber.textContent = state.turnNumber;
  elements.starterName.textContent = starter.label;
  elements.localPlayerName.textContent = localPlayer.label;
  elements.statusMessage.textContent = currentSelection.feedback || (active.id === localPlayerId ? '轮到你行动' : `等待${active.label}行动`);
  elements.handCount.textContent = `${localPlayer.hand.length} / ${CONFIG.cards.handLimit} 张`;
  elements.eventMessage.textContent = state.lastEvent.message;
  elements.eventMessage.dataset.tone = currentSelection.feedbackTone || 'neutral';
  elements.moveMode.classList.toggle('selected-action', currentSelection.mode === 'move');
  elements.deployMode.classList.toggle('selected-action', currentSelection.mode === 'deploy');
  elements.moveMode.disabled = state.activePlayerId !== localPlayerId || state.phase !== 'playing' || localPlayer.actions.moved;
  elements.deployMode.disabled = state.activePlayerId !== localPlayerId || state.phase !== 'playing' || localPlayer.actions.deployed;
  elements.confirmAction.disabled = state.activePlayerId !== localPlayerId || state.phase !== 'playing' || currentSelection.mode !== 'move' || currentSelection.path.length === 0;
  elements.confirmAction.textContent = currentSelection.mode === 'move' ? '确认移动' : '选择移动路径';
  elements.clearSelection.disabled = !currentSelection.selectedCardId && !currentSelection.mode && currentSelection.path.length === 0;
  elements.actionHint.textContent = currentSelection.feedback || '选择一张手牌开始行动';
}

export function stateToText(state, localPlayerId) {
  const localPlayer = playerById(state, localPlayerId);
  return JSON.stringify({
    coordinateSystem: 'row 0 to size-1 top-to-bottom; col 0 to size-1 left-to-right',
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    starterId: state.starterId,
    turnNumber: state.turnNumber,
    board: state.board.map(({ row, col, ownerId, card }) => ({ row, col, ownerId, card })),
    players: state.players.map(({ id, label, position, score, completedTurns }) => ({ id, label, position, score, completedTurns })),
    localHand: localPlayer.hand,
    ownHand: localPlayer.hand,
    lastEvent: state.lastEvent,
    result: state.result,
  });
}
