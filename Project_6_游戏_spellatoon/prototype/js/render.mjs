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

function effectsAtCell(state, cell) {
  return (state.lastEvent?.effects || []).filter((effect) => (
    effect.path.some((pathCell) => pathCell.row === cell.row && pathCell.col === cell.col)
  ));
}

function effectLabel(effect) {
  const type = effect.type === 'chain' ? '连锁' : '吞噬';
  const direction = effect.direction === 'horizontal' ? '横向' : '纵向';
  return `${type} · ${direction} · ${effect.path.length}格 · +${effect.scoreDelta}分`;
}

function previewEffectsAtCell(selection, cell) {
  return (selection.previewResult?.effects || []).filter((effect) => (
    effect.path.some((pathCell) => pathCell.row === cell.row && pathCell.col === cell.col)
  ));
}

function previewMessage(selection) {
  if (selection.previewNotice) return selection.previewNotice;
  if (selection.previewResult?.ok) {
    const assumedValue = selection.previewResult.assumedCard.value;
    if (!selection.previewResult.effects.length) {
      return `预览数字 ${assumedValue}：不会触发连锁或吞噬`;
    }
    return `预览数字 ${assumedValue}：${selection.previewResult.effects.map(effectLabel).join(' · ')}`;
  }
  if (selection.previewCell) {
    return `已锁定空格 ${selection.previewCell.row + 1},${selection.previewCell.col + 1} · 高亮 ${selection.previewTargets.length} 张卡牌`;
  }
  if (selection.previewHoverCell) {
    return `预览范围内有 ${selection.previewTargets.length} 张卡牌`;
  }
  return '悬停或点击空格开始预览';
}

function actionLabelForCell(state, cell, selection, characterPlayer) {
  const localPlayer = playerById(state, selection.localPlayerId);
  const isActive = state.phase === 'playing' && state.activePlayerId === selection.localPlayerId;
  if (!localPlayer || !characterPlayer || characterPlayer.id !== selection.localPlayerId || !isActive || !selection.selectedCardId) {
    return null;
  }
  if (selection.pendingAction?.target && sameCell(selection.pendingAction.target, cell)) {
    return '再次确认';
  }
  if (sameCell(localPlayer.position, cell)) {
    return localPlayer.actions.deployed || state.board.find((candidate) => sameCell(candidate, cell))?.card
      ? '不可部署'
      : '部署';
  }
  if (hasCell(selection.reachable, cell.row, cell.col)) return '移动';
  return null;
}

function sameCell(left, right) {
  return left?.row === right?.row && left?.col === right?.col;
}

function renderBoard(boardElement, state, selection) {
  const existingCells = [...boardElement.children];
  for (const [index, cell] of state.board.entries()) {
    const element = existingCells[index] || document.createElement('div');
    const existingCharacter = element.querySelector('.character');
    const existingCharacterBadge = element.querySelector('.character-badge');
    const existingCard = element.querySelector('.cell-card');
    const existingActionLabel = element.querySelector('.cell-action-label');
    const player = cell.ownerId ? playerById(state, cell.ownerId) : null;
    const characterPlayer = getPlayerAtCell(state, cell);
    const effects = effectsAtCell(state, cell);
    const previewEffects = previewEffectsAtCell(selection, cell);
    const isReachable = hasCell(selection.reachable, cell.row, cell.col);
    const isPendingPath = hasCell(selection.path, cell.row, cell.col);
    const isPendingTarget = selection.pendingAction?.target && sameCell(selection.pendingAction.target, cell);
    const actionLabel = actionLabelForCell(state, cell, selection, characterPlayer);
    element.className = 'cell coordinate';
    element.removeAttribute('title');
    element.style.removeProperty('--owner-color');
    element.style.removeProperty('--character-color');
    delete element.dataset.card;
    delete element.dataset.pathIndex;
    delete element.dataset.effect;
    delete element.dataset.previewEffect;
    element.dataset.coordinate = `${cell.row + 1},${cell.col + 1}`;
    element.dataset.row = cell.row;
    element.dataset.col = cell.col;
    if (isReachable) element.classList.add('reachable-cell');
    if (selection.previewTargets.some((target) => sameCell(target.cell, cell))) {
      element.classList.add('preview-target');
    }
    if (selection.previewCell && sameCell(selection.previewCell, cell)) {
      element.classList.add('preview-locked');
    }
    if (selection.previewHoverCell && sameCell(selection.previewHoverCell, cell)) {
      element.classList.add('preview-hover');
    }
    if (isPendingPath) {
      element.classList.add('path-cell');
      element.dataset.pathIndex = selection.path.findIndex((pathCell) => sameCell(pathCell, cell)) + 1;
    }
    if (isPendingTarget) element.classList.add('pending-target');
    if (effects.length) {
      element.classList.add('effect-cell');
      for (const effect of effects) element.classList.add(`${effect.type}-cell`);
      element.dataset.effect = effects.map(effectLabel).join(' | ');
      element.title = effects.map(effectLabel).join(' | ');
    }
    if (previewEffects.length) {
      element.classList.add('preview-effect-cell');
      for (const effect of previewEffects) element.classList.add(`preview-${effect.type}-cell`);
      element.dataset.previewEffect = previewEffects.map(effectLabel).join(' | ');
      element.title = previewEffects.map(effectLabel).join(' | ');
    }
    if (characterPlayer) element.classList.add('character-cell');
    if (characterPlayer?.id === selection.localPlayerId) {
      element.classList.add('local-character-cell');
      element.style.setProperty('--character-color', characterPlayer.color);
    }
    if (characterPlayer?.id === selection.localPlayerId && selection.selectedCardId) {
      if (characterPlayer.actions.deployed || cell.card) element.classList.add('deploy-blocked');
      else element.classList.add('deploy-target');
    }
    if (player) {
      element.classList.add('owned-cell');
      element.style.setProperty('--owner-color', player.color);
    }
    if (characterPlayer) {
      const character = existingCharacter || document.createElement('div');
      character.className = 'character';
      const isLocalCharacter = characterPlayer.id === selection.localPlayerId;
      character.classList.toggle('local-character', isLocalCharacter);
      character.title = `${characterPlayer.label}${isLocalCharacter ? ' · 我方' : ''}`;
      character.dataset.playerId = characterPlayer.id;
      character.style.setProperty('--player-color', characterPlayer.color);
      element.append(character);
      if (isLocalCharacter) {
        const badge = existingCharacterBadge || document.createElement('span');
        badge.className = 'character-badge';
        badge.textContent = '我方';
        element.append(badge);
      } else {
        existingCharacterBadge?.remove();
      }
    } else {
      existingCharacter?.remove();
      existingCharacterBadge?.remove();
    }
    if (cell.card) {
      element.dataset.card = cell.card.value;
      const card = existingCard || document.createElement('div');
      card.className = 'cell-card';
      card.textContent = cell.card.value;
      const cardOwner = playerById(state, cell.card.ownerId);
      card.style.setProperty('--card-owner-color', cardOwner?.color || 'var(--ink)');
      element.append(card);
    } else {
      existingCard?.remove();
    }
    if (actionLabel) {
      const label = existingActionLabel || document.createElement('span');
      label.className = 'cell-action-label';
      label.textContent = actionLabel;
      element.append(label);
    } else {
      existingActionLabel?.remove();
    }
    boardElement.append(element);
  }
  for (const staleCell of existingCells.slice(state.board.length)) staleCell.remove();
}

function renderPlayers(listElement, state, localPlayerId) {
  listElement.replaceChildren();
  for (const player of state.players) {
    const row = document.createElement('div');
    row.className = 'player-row';
    const isLocalPlayer = player.id === localPlayerId;
    row.dataset.relation = isLocalPlayer ? 'local' : 'opponent';
    row.style.setProperty('--player-color', player.color);
    row.innerHTML = `<span class="player-swatch" style="background:${player.color}"></span><span class="player-name">${isLocalPlayer ? '我方' : '对方'}</span><strong class="player-score">${player.score} 分</strong>`;
    listElement.append(row);
  }
}

function renderHand(handElement, player, state, localPlayerId, selection) {
  handElement.replaceChildren();
  const hand = state.ownHand || player.hand || [];
  const turnComplete = Boolean(player?.actions?.moved && player?.actions?.deployed);
  for (const card of hand) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'card';
    element.dataset.cardId = card.id;
    element.textContent = card.value;
    element.setAttribute('aria-label', `数字卡牌 ${card.value}`);
    element.classList.toggle('selected-card', selection.selectedCardId === card.id);
    element.disabled = turnComplete || state.activePlayerId !== localPlayerId || state.phase !== 'playing';
    handElement.append(element);
  }
}

function remainingSeconds(state, now) {
  if (state.phase !== 'playing' || !Number.isFinite(state.turnDeadlineAt)) return null;
  return Math.max(0, Math.ceil((state.turnDeadlineAt - now) / 1000));
}

export function renderApp(elements, state, localPlayerId, selection = {}) {
  const localPlayer = playerById(state, localPlayerId);
  const active = playerById(state, state.activePlayerId);
  const currentSelection = {
    previewCell: null,
    previewHoverCell: null,
    previewTargets: [],
    previewResult: null,
    previewNotice: '',
    clockNow: Date.now(),
    localPlayerId,
    ...selection,
  };
  renderBoard(elements.board, state, currentSelection);
  renderPlayers(elements.playerList, state, localPlayerId);
  renderHand(elements.hand, localPlayer, state, localPlayerId, currentSelection);
  elements.turnChip.textContent = state.phase === 'finished' ? '已结算' : `第 ${state.turnNumber} 回合`;
  const seconds = remainingSeconds(state, currentSelection.clockNow);
  elements.turnTimer.textContent = seconds == null ? '--' : `${seconds}s`;
  elements.turnTimer.dataset.urgent = seconds != null && seconds <= 5 ? 'true' : 'false';
  const ownHand = state.ownHand || localPlayer.hand || [];
  elements.handCount.textContent = `${ownHand.length} / ${CONFIG.cards.handLimit} 张`;
  if (elements.connectionStatus) {
    const connectedCount = state.connection?.connectedPlayers?.length || 0;
    elements.connectionStatus.textContent = state.connection
      ? `局域网 ${connectedCount} / ${CONFIG.players.length}`
      : '本地演示';
  }
  elements.previewMessage.textContent = previewMessage(currentSelection);
  const waitingForOpponent = state.phase === 'playing' && active.id !== localPlayerId;
  elements.handPanel.classList.toggle('waiting-hand', waitingForOpponent);
  elements.handOverlay.hidden = !waitingForOpponent;
  elements.endTurn.disabled = state.activePlayerId !== localPlayerId || state.phase !== 'playing';
}

export function stateToText(state, localPlayerId) {
  const localPlayer = playerById(state, localPlayerId);
  const ownHand = state.ownHand || localPlayer?.hand || [];
  return JSON.stringify({
    coordinateSystem: 'row 0 to size-1 top-to-bottom; col 0 to size-1 left-to-right',
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    starterId: state.starterId,
    turnNumber: state.turnNumber,
    turnDeadlineAt: state.turnDeadlineAt,
    board: state.board.map(({ row, col, ownerId, card }) => ({ row, col, ownerId, card })),
    players: state.players.map(({ id, label, position, score, completedTurns }) => ({ id, label, position, score, completedTurns })),
    localHand: ownHand,
    ownHand,
    lastEvent: state.lastEvent,
    result: state.result,
  });
}
