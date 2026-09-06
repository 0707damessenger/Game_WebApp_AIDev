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

function isOrthogonalStep(from, to) {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col) === 1;
}

function resetSelection(selection) {
  selection.selectedCardId = null;
  selection.mode = null;
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
    const state = getState();
    selection.reachable = selection.mode === 'move' && selection.selectedCardId
      ? getReachableCells(state, currentLocalPlayerId(), selection.selectedCardId, config)
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
    selection.selectedCardId = cardId;
    selection.path = [];
    setFeedback('已选择数字卡牌，请选择行动方式');
    refreshReachable();
    render();
  }

  function selectMode(mode) {
    const player = activeLocalPlayer();
    if (!player) {
      setFeedback('请等待你的行动回合', 'error');
      render();
      return;
    }
    if (!selectedCard()) {
      setFeedback('先选择一张手牌', 'error');
      render();
      return;
    }
    if (player.actions[mode === 'move' ? 'moved' : 'deployed']) {
      setFeedback(`${mode === 'move' ? '移动' : '部署'}行动已使用`, 'error');
      render();
      return;
    }
    selection.mode = mode;
    selection.path = [];
    refreshReachable();
    setFeedback(mode === 'move' ? '逐格点击移动路径，完成后确认移动' : '点击角色所在格部署这张牌');
    render();
  }

  async function handleBoardClick(event) {
    const cellElement = event.target.closest('.cell');
    if (!cellElement || !elements.board.contains(cellElement)) return;

    const target = cellFromElement(cellElement);
    if (!selection.mode) {
      if (boardCellAt(target)?.card) {
        selection.previewNotice = '卡牌格不能锁定，只能悬停查看效果';
        selection.previewResult = null;
        render();
      } else {
        lockPreview(target);
      }
      return;
    }
    const player = activeLocalPlayer();
    const card = selectedCard();

    if (!player || !card) {
      setFeedback('轮到你时先选择一张手牌', 'error');
      render();
      return;
    }

    if (selection.mode === 'deploy') {
      if (!sameCell(player.position, target)) {
        setFeedback('部署只能放在角色当前格', 'error');
        render();
        return;
      }
      if (submitAction) {
        await submitRemoteAction({ type: 'deploy', cardId: card.id });
        return;
      }
      const result = performDeploy(getState(), currentLocalPlayerId(), card.id, config);
      if (!result.ok) {
        setFeedback('这格已有卡牌，无法部署', 'error');
        render();
        return;
      }
      setState(result.state);
      resetSelection(selection);
      setFeedback(result.event.message, 'success');
      render();
      return;
    }

    if (selection.mode !== 'move') {
      setFeedback('先选择移动或部署', 'error');
      render();
      return;
    }

    const from = selection.path.at(-1) || player.position;
    const maxSteps = Math.min(card.value, config.board.maxMoveDistance);
    if (selection.path.length >= maxSteps || !isOrthogonalStep(from, target)) {
      setFeedback('移动必须逐格横向或纵向选择，且不能超过卡牌数字', 'error');
      render();
      return;
    }

    selection.path.push(target);
    const remaining = maxSteps - selection.path.length;
    setFeedback(`已选择 ${selection.path.length} 格${remaining ? `，还可移动 ${remaining} 格` : ''}`);
    render();
  }

  function confirmAction() {
    const player = activeLocalPlayer();
    const card = selectedCard();
    if (!player || !card) {
      setFeedback('当前没有可确认的行动', 'error');
      render();
      return;
    }
    if (selection.mode !== 'move') {
      setFeedback('部署请点击角色所在格', 'error');
      render();
      return;
    }
    if (submitAction) {
      void submitRemoteAction({
        type: 'move',
        cardId: card.id,
        path: structuredClone(selection.path),
      });
      return;
    }
    const result = performMove(getState(), currentLocalPlayerId(), card.id, selection.path, config);
    if (!result.ok) {
      setFeedback('请选择至少一格有效的移动路径', 'error');
      render();
      return;
    }
    setState(result.state);
    resetSelection(selection);
    setFeedback(result.event.message, 'success');
    render();
  }

  function clearSelection() {
    resetSelection(selection);
    setFeedback('选择已清除');
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
    if (selection.mode) return;
    const cellElement = event.target.closest('.cell');
    if (!cellElement || !elements.board.contains(cellElement)) return;
    const previousCell = event.relatedTarget?.closest?.('.cell');
    if (previousCell === cellElement) return;
    handlePreviewHover(cellFromElement(cellElement));
  });
  elements.board.addEventListener('mouseleave', handlePreviewLeave);
  elements.moveMode.addEventListener('click', () => selectMode('move'));
  elements.deployMode.addEventListener('click', () => selectMode('deploy'));
  elements.confirmAction.addEventListener('click', confirmAction);
  elements.clearSelection.addEventListener('click', clearSelection);
  elements.endTurn.addEventListener('click', endCurrentTurn);

  return { selectCard, selectMode, confirmAction, clearSelection, endCurrentTurn, clearPreview };
}
