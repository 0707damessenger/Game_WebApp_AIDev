import {
  getReachableCells,
  endTurn,
  getPreviewTargets,
  lockPreviewCell,
  performDeploy,
  performMove,
  simulatePreview,
} from './rules.mjs';

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

function sameCell(left, right) {
  return left?.row === right?.row && left?.col === right?.col;
}

export function buildAutoPath(from, to) {
  const path = [];
  let row = from.row;
  let col = from.col;
  const colStep = Math.sign(to.col - col);
  while (col !== to.col) {
    col += colStep;
    path.push({ row, col });
  }
  const rowStep = Math.sign(to.row - row);
  while (row !== to.row) {
    row += rowStep;
    path.push({ row, col });
  }
  return path;
}

function resetSelection(selection) {
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

export function createInputController({
  elements,
  getState,
  getSelection,
  setState,
  render,
  localPlayerId,
  getLocalPlayerId = null,
  config,
  submitAction = null,
}) {
  const selection = getSelection();

  function currentLocalPlayerId() {
    return getLocalPlayerId ? getLocalPlayerId() : localPlayerId;
  }

  function setFeedback(message, tone = 'neutral') {
    selection.feedback = message;
    selection.feedbackTone = tone;
  }

  function activeLocalPlayer() {
    const state = getState();
    const playerId = currentLocalPlayerId();
    const player = playerById(state, playerId);
    return state.phase === 'playing' && state.activePlayerId === playerId ? player : null;
  }

  function ownHand() {
    const state = getState();
    const player = playerById(state, currentLocalPlayerId());
    return state.ownHand || player?.hand || [];
  }

  function stateForLocalRules() {
    const state = getState();
    const playerId = currentLocalPlayerId();
    const localHand = ownHand();
    return {
      ...state,
      players: state.players.map((player) => player.id === playerId
        ? { ...player, hand: structuredClone(localHand) }
        : player),
    };
  }

  function selectedCard() {
    return ownHand().find((card) => card.id === selection.selectedCardId) || null;
  }

  async function submitRemoteAction(action) {
    try {
      const result = await submitAction(action);
      if (!result?.ok) {
        setFeedback('操作未同步，请稍后重试', 'error');
        render();
        return;
      }
      if (result.state) setState(result.state);
      resetSelection(selection);
      setFeedback(result.event?.message || '操作已同步', 'success');
      render();
    } catch {
      setFeedback('连接中断，操作未同步', 'error');
      render();
    }
  }

  function refreshReachable() {
    selection.reachable = selection.selectedCardId
      ? getReachableCells(stateForLocalRules(), currentLocalPlayerId(), selection.selectedCardId, config)
      : [];
  }

  function cellFromElement(cellElement) {
    return {
      row: Number(cellElement.dataset.row),
      col: Number(cellElement.dataset.col),
    };
  }

  function boardCellAt(cell) {
    return getState().board.find((candidate) => sameCell(candidate, cell));
  }

  function isPreviewTarget(cell) {
    return selection.previewTargets.some((target) => sameCell(target.cell, cell));
  }

  function clearPreview() {
    selection.previewCell = null;
    selection.previewHoverCell = null;
    selection.previewTargets = [];
    selection.previewResult = null;
    selection.previewNotice = '';
  }

  function handlePreviewHover(cell) {
    selection.previewHoverCell = cell;
    selection.previewNotice = '';
    if (selection.previewCell && boardCellAt(cell)?.card && isPreviewTarget(cell)) {
      const preview = simulatePreview({
        ...getState(),
        previewCell: selection.previewCell,
        previewPlayerId: currentLocalPlayerId(),
      }, cell, config);
      selection.previewResult = preview.ok ? preview : null;
    } else if (selection.previewCell) {
      selection.previewResult = null;
    } else {
      selection.previewResult = null;
      selection.previewTargets = getPreviewTargets(getState(), cell, config);
    }
    render();
  }

  function handlePreviewLeave() {
    if (selection.selectedCardId) return;
    clearPreview();
    render();
  }

  function lockPreview(cell) {
    const result = lockPreviewCell(getState(), cell, config);
    selection.previewHoverCell = cell;
    selection.previewResult = null;
    if (!result.ok) {
      selection.previewNotice = result.reason === 'occupied-cell'
        ? '卡牌格不能锁定，只能悬停查看效果'
        : '棋盘外位置不能预览';
      render();
      return;
    }
    selection.previewCell = result.previewCell;
    selection.previewTargets = getPreviewTargets(getState(), cell, config);
    selection.previewNotice = `已锁定空格 ${cell.row + 1},${cell.col + 1}，悬停高亮卡牌查看效果`;
    render();
  }

  function selectCard(cardId) {
    if (!activeLocalPlayer()) {
      setFeedback('当前不是你的行动回合', 'error');
      render();
      return;
    }
    if (selection.selectedCardId === cardId) {
      resetSelection(selection);
    setFeedback('已取消');
      render();
      return;
    }
    clearPreview();
    selection.selectedCardId = cardId;
    selection.pendingAction = null;
    selection.path = [];
    refreshReachable();
    setFeedback('点击当前位置部署，点击蓝色高亮格移动');
    render();
  }

  function localCommit(action) {
    const result = action.type === 'move'
      ? performMove(getState(), currentLocalPlayerId(), action.cardId, action.path, config)
      : performDeploy(getState(), currentLocalPlayerId(), action.cardId, config);
    if (!result.ok) {
      setFeedback(action.type === 'move' ? '移动目标已失效，请重新选择' : '当前位置已有卡牌，无法部署', 'error');
      selection.pendingAction = null;
      selection.path = [];
      refreshReachable();
      render();
      return;
    }
    setState(result.state);
    resetSelection(selection);
    setFeedback(result.event.message, 'success');
    render();
  }

  function commitPendingAction() {
    const player = activeLocalPlayer();
    const card = selectedCard();
    const pending = selection.pendingAction;
    if (!player || !card || !pending) return;
    const action = {
      type: pending.type,
      cardId: card.id,
      ...(pending.type === 'move' ? { path: structuredClone(pending.path) } : {}),
    };
    if (submitAction) {
      void submitRemoteAction(action);
      return;
    }
    localCommit(action);
  }

  function handleActionTarget(target, player, card) {
    const currentCell = sameCell(player.position, target);
    const boardCell = boardCellAt(target);
    if (currentCell) {
      if (player.actions.deployed || boardCell?.card) {
        setFeedback('当前位置已有卡牌，无法部署', 'error');
        render();
        return;
      }
      if (selection.pendingAction?.type === 'deploy') {
        commitPendingAction();
        return;
      }
      selection.pendingAction = { type: 'deploy', target: { ...target }, path: [] };
      selection.path = [];
      setFeedback('再次点击确认部署');
      render();
      return;
    }

    const reachable = selection.reachable.some((cell) => sameCell(cell, target));
    if (reachable) {
      const path = buildAutoPath(player.position, target);
      if (selection.pendingAction?.type === 'move' && sameCell(selection.pendingAction.target, target)) {
        commitPendingAction();
        return;
      }
      selection.pendingAction = { type: 'move', target: { ...target }, path };
      selection.path = path;
      setFeedback(`再次点击确认移动 · 自动路径 ${path.length} 格`);
      render();
      return;
    }

    setFeedback('请点击当前位置部署，或点击蓝色高亮格移动', 'error');
    render();
  }

  function handleBoardClick(event) {
    const cellElement = event.target.closest('.cell');
    if (!cellElement || !elements.board.contains(cellElement)) return;

    const target = cellFromElement(cellElement);
    const card = selectedCard();
    const player = activeLocalPlayer();
    if (!card || !player) {
      if (card) {
        setFeedback('当前不是你的行动回合', 'error');
        render();
      } else if (boardCellAt(target)?.card) {
        selection.previewNotice = '卡牌格不能锁定，只能悬停查看效果';
        selection.previewResult = null;
        render();
      } else {
        lockPreview(target);
      }
      return;
    }
    handleActionTarget(target, player, card);
  }

  function clearSelection() {
    resetSelection(selection);
    setFeedback('已取消');
    render();
  }

  function endCurrentTurn() {
    if (!activeLocalPlayer()) {
      setFeedback('当前不是你的行动回合', 'error');
      render();
      return;
    }
    if (submitAction) {
      void submitRemoteAction({ type: 'end-turn' });
      return;
    }
    const result = endTurn(getState(), currentLocalPlayerId(), config);
    if (!result.ok) {
      setFeedback('无法结束当前回合', 'error');
      render();
      return;
    }
    setState(result.state);
    resetSelection(selection);
    setFeedback(result.event.message, 'success');
    render();
  }

  elements.hand.addEventListener('click', (event) => {
    const cardElement = event.target.closest('[data-card-id]');
    if (cardElement) selectCard(cardElement.dataset.cardId);
  });
  elements.board.addEventListener('click', handleBoardClick);
  elements.board.addEventListener('pointerover', (event) => {
    if (selection.selectedCardId) return;
    const cellElement = event.target.closest('.cell');
    if (!cellElement || !elements.board.contains(cellElement)) return;
    const previousCell = event.relatedTarget?.closest?.('.cell');
    if (previousCell === cellElement) return;
    handlePreviewHover(cellFromElement(cellElement));
  });
  elements.board.addEventListener('mouseleave', handlePreviewLeave);
  elements.endTurn.addEventListener('click', endCurrentTurn);
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !selection.selectedCardId) return;
    clearSelection();
  });

  return { selectCard, clearSelection, endCurrentTurn, clearPreview };
}
