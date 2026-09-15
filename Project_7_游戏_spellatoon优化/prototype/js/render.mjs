import { CONFIG } from './config.mjs';
import {
  getPreviewTargets,
  getReachableCells,
  getWeightedTerritory,
  previewDeployment,
  simulatePreview,
} from './rules.mjs';

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

function cellKey(cell) {
  return `${cell.row}:${cell.col}`;
}

function localState(state, localPlayerId) {
  if (!state.localHand) return state;
  return {
    ...state,
    players: state.players.map((player) => (
      player.id === localPlayerId ? { ...player, hand: state.localHand } : player
    )),
  };
}

function playerMarkup(player, value, unit) {
  return `<div class="player-stat"><span><i class="swatch" style="background:${player.color}"></i>${player.label}</span><strong>${value}${unit}</strong></div>`;
}

function renderBoard(board, state, selection) {
  const activePlayer = playerById(state, state.activePlayerId);
  const localPlayerId = state.localPlayerId || activePlayer.id;
  const reachabilityState = localState(state, localPlayerId);
  const reachable = selection.selectedCardId
    ? new Set(getReachableCells(reachabilityState, localPlayerId, selection.selectedCardId, CONFIG).map(cellKey))
    : new Set();
  const hoveredDeployCell = selection.hoveredCell
    && selection.hoveredCell.row === activePlayer.position.row
    && selection.hoveredCell.col === activePlayer.position.col;
  const preview = selection.selectedCardId && hoveredDeployCell
    ? previewDeployment(reachabilityState, localPlayerId, selection.selectedCardId, CONFIG)
    : null;
  const freePreviewCell = selection.selectedCardId
    ? null
    : selection.previewCell || selection.previewHoverCell;
  const previewTargets = freePreviewCell
    ? getPreviewTargets(state, freePreviewCell, CONFIG)
    : [];
  const hoveredPreviewTarget = previewTargets.some((target) => (
    target.cell.row === selection.previewHoverCell?.row
    && target.cell.col === selection.previewHoverCell?.col
  ));
  const freePreview = selection.previewCell && hoveredPreviewTarget
    ? simulatePreview(
      state,
      localPlayerId,
      selection.previewCell,
      selection.previewHoverCell,
      CONFIG,
    )
    : null;
  const activePreview = preview || freePreview;
  const previewPath = new Set((activePreview?.effects || []).flatMap((effect) => effect.path.map(cellKey)));
  const previewTargetKeys = new Set(previewTargets.map((target) => cellKey(target.cell)));
  board.replaceChildren();
  for (const cell of state.board) {
    const element = document.createElement('button');
    const character = state.players.find((player) => (
      player.position.row === cell.row && player.position.col === cell.col
    ));
    element.type = 'button';
    element.className = 'cell';
    element.dataset.row = cell.row;
    element.dataset.col = cell.col;
    element.dataset.highWeight = String(cell.isHighWeight);
    element.dataset.owner = cell.ownerId || '';
    element.classList.toggle('reachable', reachable.has(cellKey(cell)));
    element.classList.toggle('pending', selection.pendingTarget && cellKey(selection.pendingTarget) === cellKey(cell));
    element.classList.toggle('preview-path', previewPath.has(cellKey(cell)));
    element.classList.toggle('preview-target', previewTargetKeys.has(cellKey(cell)));
    element.classList.toggle('preview-locked', selection.previewCell && cellKey(selection.previewCell) === cellKey(cell));
    element.classList.toggle('preview-hover', selection.previewHoverCell && cellKey(selection.previewHoverCell) === cellKey(cell));
    element.innerHTML = `<span class="cell-coordinate">${cell.row + 1},${cell.col + 1}</span>${cell.isHighWeight ? '<span class="high-weight-mark">x2</span>' : ''}`;
    if (cell.card) {
      const card = document.createElement('span');
      card.className = 'cell-card';
      card.textContent = cell.card.value;
      element.append(card);
    }
    if (character) {
      const marker = document.createElement('span');
      marker.className = `character${cell.card ? ' with-card' : ''}`;
      marker.style.setProperty('--character-color', character.color);
      marker.title = character.label;
      element.append(marker);
    }
    board.append(element);
  }
  return { preview, freePreview, previewTargets };
}

function renderHand(hand, state, selection) {
  const activePlayer = playerById(state, state.activePlayerId);
  const cards = state.localHand || activePlayer.hand;
  hand.replaceChildren();
  if (!selection.handsVisible) return;
  for (const card of cards) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'card';
    element.dataset.cardId = card.id;
    element.textContent = card.value;
    element.setAttribute('aria-label', `数字卡牌 ${card.value}`);
    element.classList.toggle('selected', selection.selectedCardId === card.id);
    hand.append(element);
  }
}

export function renderApp(elements, state, selection) {
  const activePlayer = playerById(state, state.activePlayerId);
  const localPlayerId = state.localPlayerId || state.activePlayerId;
  const localHand = state.localHand || activePlayer.hand;
  const territory = getWeightedTerritory(state, CONFIG);
  elements.turnIndicator.textContent = state.phase === 'finished'
    ? '对局已结算'
    : `第 ${state.turnNumber} 回合 · ${activePlayer.label}行动`;
  elements.lifeSummary.innerHTML = `<span class="status-title">生命</span>${state.players.map((player) => playerMarkup(player, player.life, '')).join('')}`;
  elements.actionPoints.innerHTML = `<span class="status-title">行动点</span>${playerMarkup(activePlayer, activePlayer.actionPoints, '')}`;
  elements.territorySummary.innerHTML = `<span class="status-title">加权领地</span>${state.players.map((player) => playerMarkup(player, territory[player.id], '')).join('')}`;
  elements.scoreSummary.innerHTML = state.players.map((player) => (
    `<div class="score-row"><span><i class="swatch" style="background:${player.color}"></i>${player.label}</span><strong>${player.score}</strong></div>`
  )).join('');
  elements.handCount.textContent = selection.handsVisible
    ? `${localHand.length} / ${CONFIG.cards.handLimit}`
    : '--';
  elements.actionNote.textContent = selection.message || (selection.selectedCardId
    ? '选择目标后再次点击同一格确认行动。'
    : '选择一张数字牌开始行动。');
  elements.settlement.textContent = state.lastEvent.type === 'turn-ended' && state.lastEvent.territorySettled
    ? `领地结算：${state.lastEvent.territoryDamage ? `${playerById(state, state.lastEvent.territoryDamage.playerId).label}失去 ${state.lastEvent.territoryDamage.amount} 生命` : '双方领地持平'}`
    : '';
  elements.endTurn.disabled = state.phase !== 'playing' || state.activePlayerId !== localPlayerId;
  elements.handPanel.hidden = !selection.handsVisible;
  const previewState = renderBoard(elements.board, state, selection);
  if (previewState.preview?.ok) {
    elements.previewSummary.textContent = previewState.preview.effects.length
      ? `${previewState.preview.effects.map((effect) => effect.type === 'chain' ? '连锁' : '吞噬').join(' + ')}预览 · 预计 +${previewState.preview.scoreDelta} 分`
      : '部署预览：不会触发连锁或吞噬';
  } else if (previewState.freePreview?.ok) {
    elements.previewSummary.textContent = previewState.freePreview.effects.length
      ? `${previewState.freePreview.effects.map((effect) => effect.type === 'chain' ? '连锁' : '吞噬').join(' + ')}预览 · 预计 +${previewState.freePreview.scoreDelta} 分`
      : `预览数字 ${previewState.freePreview.assumedCard.value}：不会触发连锁或吞噬`;
  } else if (selection.previewCell) {
    elements.previewSummary.textContent = `已锁定空格，悬浮 ${previewState.previewTargets.length} 张高亮卡牌查看效果`;
  } else if (selection.previewHoverCell) {
    elements.previewSummary.textContent = `范围内有 ${previewState.previewTargets.length} 张可关联卡牌`;
  } else {
    elements.previewSummary.textContent = '';
  }
  renderHand(elements.hand, state, selection);
}

export function stateToText(state, { handsVisible = true, selection = {} } = {}) {
  const localPlayer = playerById(state, state.localPlayerId || state.activePlayerId);
  return JSON.stringify({
    coordinateSystem: 'row 0 to 7 top-to-bottom; col 0 to 7 left-to-right',
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    turnNumber: state.turnNumber,
    players: state.players.map(({ id, label, position, life, actionPoints, score, completedTurns }) => ({
      id, label, position, life, actionPoints, score, completedTurns,
    })),
    localHand: handsVisible ? state.localHand || localPlayer.hand : [],
    handsVisible,
    freePreview: {
      lockedCell: selection.previewCell || null,
      hoverCell: selection.previewHoverCell || null,
    },
    territory: getWeightedTerritory(state, CONFIG),
    board: state.board.map(({ row, col, isHighWeight, ownerId, card }) => ({
      row, col, isHighWeight, ownerId, card,
    })),
    lastEvent: state.lastEvent,
    result: state.result,
  });
}
