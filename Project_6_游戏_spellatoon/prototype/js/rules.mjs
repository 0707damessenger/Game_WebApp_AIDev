import { CONFIG as DEFAULT_CONFIG } from './config.mjs';

function randomIndex(random, length) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
  return Math.floor(normalized * length);
}

function createBoard(size) {
  return Array.from({ length: size * size }, (_, index) => ({
    row: Math.floor(index / size),
    col: index % size,
    ownerId: null,
    card: null,
  }));
}

function createHand(playerId, count, values, random, nextCardId) {
  return Array.from({ length: count }, () => ({
    id: nextCardId(playerId),
    value: values[randomIndex(random, values.length)],
    ownerId: playerId,
  }));
}

export function createInitialState({ random = Math.random, config = DEFAULT_CONFIG } = {}) {
  const board = createBoard(config.board.size);
  let cardSequence = 0;
  const nextCardId = (playerId) => {
    cardSequence += 1;
    return `${playerId}-card-${cardSequence}`;
  };
  const starterIndex = randomIndex(random, config.players.length);
  const players = config.players.map((player, index) => ({
    id: player.id,
    label: player.label,
    color: player.color,
    position: index === 0
      ? { row: 0, col: 0 }
      : { row: config.board.size - 1, col: config.board.size - 1 },
    hand: createHand(
      player.id,
      config.cards.openingHand,
      config.cards.values,
      random,
      nextCardId,
    ),
    score: 0,
    completedTurns: 0,
    actions: {
      moved: false,
      deployed: false,
    },
  }));

  return {
    phase: 'playing',
    board,
    players,
    activePlayerId: players[starterIndex].id,
    starterId: players[starterIndex].id,
    turnNumber: 1,
    lastEvent: {
      type: 'game-started',
      message: `${players[starterIndex].label} 先手`,
    },
    result: null,
  };
}

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

function boardCellAt(state, row, col) {
  return state.board.find((cell) => cell.row === row && cell.col === col);
}

function isInsideBoard(row, col, config) {
  return row >= 0 && row < config.board.size && col >= 0 && col < config.board.size;
}

function cellKey(cell) {
  return `${cell.row}:${cell.col}`;
}

function selectedCard(player, cardId) {
  return player?.hand.find((card) => card.id === cardId);
}

function cloneState(state) {
  return structuredClone(state);
}

function invalid(reason) {
  return { ok: false, reason };
}

function validateActiveAction(state, playerId, action) {
  const player = playerById(state, playerId);
  if (!player || state.phase !== 'playing' || state.activePlayerId !== playerId) {
    return invalid('not-active-player');
  }
  if (player.actions[action]) {
    return invalid(`${action === 'moved' ? 'move' : 'deploy'}-used`);
  }
  return null;
}

const lineDirections = [
  { name: 'horizontal', rowDelta: 0, colDelta: 1 },
  { name: 'vertical', rowDelta: 1, colDelta: 0 },
];

export function getLineCandidates(state, deployedCell, direction, config = DEFAULT_CONFIG) {
  const deployed = boardCellAt(state, deployedCell.row, deployedCell.col);
  if (!deployed?.card) return [];
  const candidates = [];
  const maxDistance = config.board.maxLineGap + 1;
  const rowDelta = direction === 'vertical' ? 1 : 0;
  const colDelta = direction === 'vertical' ? 0 : 1;

  for (const sign of [-1, 1]) {
    for (let distance = 1; distance <= maxDistance; distance += 1) {
      const row = deployedCell.row + rowDelta * sign * distance;
      const col = deployedCell.col + colDelta * sign * distance;
      if (!isInsideBoard(row, col, config)) break;
      const cell = boardCellAt(state, row, col);
      if (cell?.card?.value === deployed.card.value) {
        candidates.push(cell);
      }
    }
  }
  return candidates;
}

export function getPreviewTargets(state, cell, config = DEFAULT_CONFIG) {
  if (!isInsideBoard(cell.row, cell.col, config)) return [];
  const targets = [];
  for (const candidate of state.board) {
    if (!candidate.card || (candidate.row === cell.row && candidate.col === cell.col)) continue;
    const sameRow = candidate.row === cell.row;
    const sameColumn = candidate.col === cell.col;
    if (!sameRow && !sameColumn) continue;
    const distance = sameRow
      ? Math.abs(candidate.col - cell.col)
      : Math.abs(candidate.row - cell.row);
    if (distance <= config.preview.lineRange) {
      targets.push({
        cell: { row: candidate.row, col: candidate.col },
        card: structuredClone(candidate.card),
        distance,
      });
    }
  }
  return targets.sort((left, right) => left.distance - right.distance);
}

export function lockPreviewCell(state, cell, config = DEFAULT_CONFIG) {
  if (!isInsideBoard(cell.row, cell.col, config)) return invalid('outside-board');
  const target = boardCellAt(state, cell.row, cell.col);
  if (!target) return invalid('outside-board');
  if (target.card) return invalid('occupied-cell');
  return { ok: true, previewCell: { row: cell.row, col: cell.col } };
}

export function buildEffectPath(startCell, endCell) {
  if (startCell.row !== endCell.row && startCell.col !== endCell.col) return [];
  const path = [];
  const rowStep = Math.sign(endCell.row - startCell.row);
  const colStep = Math.sign(endCell.col - startCell.col);
  const length = Math.max(
    Math.abs(endCell.row - startCell.row),
    Math.abs(endCell.col - startCell.col),
  );
  for (let index = 0; index <= length; index += 1) {
    path.push({
      row: startCell.row + rowStep * index,
      col: startCell.col + colStep * index,
    });
  }
  return path;
}

function unique(values) {
  return [...new Set(values)];
}

function effectMessage(effects) {
  if (!effects.length) return '';
  return effects.map((effect) => (
    `${effect.type === 'chain' ? '触发连锁' : '发生吞噬'} +${effect.scoreDelta}分`
  )).join('，');
}

export function resolveDeploymentEffects(state, deployedCell, deployingPlayerId, config = DEFAULT_CONFIG) {
  const deployed = boardCellAt(state, deployedCell.row, deployedCell.col);
  if (!deployed?.card) return { state: cloneState(state), effects: [] };

  const effects = [];
  for (const direction of lineDirections) {
    const candidates = getLineCandidates(state, deployedCell, direction.name, config);
    if (!candidates.length) continue;

    const axis = direction.name === 'vertical' ? 'row' : 'col';
    const positions = [deployedCell[axis], ...candidates.map((cell) => cell[axis])];
    const startCell = direction.name === 'vertical'
      ? { row: Math.min(...positions), col: deployedCell.col }
      : { row: deployedCell.row, col: Math.min(...positions) };
    const endCell = direction.name === 'vertical'
      ? { row: Math.max(...positions), col: deployedCell.col }
      : { row: deployedCell.row, col: Math.max(...positions) };
    const path = buildEffectPath(startCell, endCell);
    const pathCells = path.map((cell) => boardCellAt(state, cell.row, cell.col));
    const isChain = candidates.every((cell) => cell.card.ownerId === deployingPlayerId);
    const removedCardIds = isChain
      ? unique([deployed.card.id, ...candidates.map((cell) => cell.card.id)])
      : unique(pathCells.filter((cell) => cell?.card).map((cell) => cell.card.id));
    effects.push({
      type: isChain ? 'chain' : 'consume',
      direction: direction.name,
      path,
      removedCardIds,
      paintOwnerId: deployingPlayerId,
      scoreDelta: deployed.card.value * path.length,
    });
  }

  const nextState = cloneState(state);
  const removedCardIds = new Set(effects.flatMap((effect) => effect.removedCardIds));
  for (const effect of effects) {
    for (const cell of effect.path) {
      const nextCell = boardCellAt(nextState, cell.row, cell.col);
      nextCell.ownerId = effect.paintOwnerId;
    }
    playerById(nextState, deployingPlayerId).score += effect.scoreDelta;
  }
  for (const cell of nextState.board) {
    if (cell.card && removedCardIds.has(cell.card.id)) cell.card = null;
  }
  return { state: nextState, effects };
}

export function simulatePreview(state, targetCardCell, config = DEFAULT_CONFIG) {
  const previewCell = state.previewCell || state.lockedPreviewCell;
  const target = boardCellAt(state, targetCardCell.row, targetCardCell.col);
  const previewPlayerId = state.previewPlayerId || state.activePlayerId;
  if (!previewCell) return invalid('preview-cell-required');
  if (!isInsideBoard(previewCell.row, previewCell.col, config)) return invalid('outside-board');
  if (!target?.card) return invalid('preview-card-not-found');
  const previewTarget = boardCellAt(state, previewCell.row, previewCell.col);
  if (!previewTarget || previewTarget.card) return invalid('occupied-cell');
  if (!playerById(state, previewPlayerId)) return invalid('player-not-found');

  const previewState = cloneState(state);
  const hypotheticalCell = boardCellAt(previewState, previewCell.row, previewCell.col);
  hypotheticalCell.ownerId = previewPlayerId;
  hypotheticalCell.card = {
    id: 'preview-card',
    value: target.card.value,
    ownerId: previewPlayerId,
  };
  const resolved = resolveDeploymentEffects(
    previewState,
    previewCell,
    previewPlayerId,
    config,
  );
  return {
    ok: true,
    previewCell: { ...previewCell },
    targetCard: structuredClone(target.card),
    assumedCard: {
      value: target.card.value,
      ownerId: previewPlayerId,
    },
    effects: resolved.effects,
    scoreDelta: resolved.effects.reduce((total, effect) => total + effect.scoreDelta, 0),
  };
}

export function getReachableCells(state, playerId, cardId, config = DEFAULT_CONFIG) {
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (!player || !card || state.phase !== 'playing' || state.activePlayerId !== playerId || player.actions.moved) {
    return [];
  }

  const maxSteps = Math.min(card.value, config.board.maxMoveDistance);
  const start = player.position;
  const distances = new Map([[cellKey(start), 0]]);
  const queue = [start];
  const directions = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
  ];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const distance = distances.get(cellKey(current));
    if (distance >= maxSteps) continue;
    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col };
      const key = cellKey(next);
      if (!isInsideBoard(next.row, next.col, config) || distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }

  return [...distances.entries()]
    .filter(([, distance]) => distance > 0)
    .map(([key]) => {
      const [row, col] = key.split(':').map(Number);
      return { row, col };
    });
}

export function performMove(state, playerId, cardId, path, config = DEFAULT_CONFIG) {
  const activeError = validateActiveAction(state, playerId, 'moved');
  if (activeError) return activeError;
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (!card) return invalid('card-not-found');

  const maxSteps = Math.min(card.value, config.board.maxMoveDistance);
  if (!Array.isArray(path) || path.length < 1 || path.length > maxSteps) {
    return invalid('move-distance');
  }

  let current = player.position;
  for (const next of path) {
    const isOrthogonal = Math.abs(next.row - current.row) + Math.abs(next.col - current.col) === 1;
    if (!isInsideBoard(next.row, next.col, config) || !isOrthogonal) {
      return invalid('move-distance');
    }
    current = next;
  }

  const nextState = cloneState(state);
  const nextPlayer = playerById(nextState, playerId);
  nextPlayer.position = { ...current };
  nextPlayer.hand = nextPlayer.hand.filter((cardInHand) => cardInHand.id !== cardId);
  nextPlayer.actions.moved = true;
  nextState.lastEvent = {
    type: 'move',
    playerId,
    cardValue: card.value,
    path: structuredClone(path),
    message: `${nextPlayer.label} 移动了 ${path.length} 格`,
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}

export function performDeploy(state, playerId, cardId, config = DEFAULT_CONFIG) {
  const activeError = validateActiveAction(state, playerId, 'deployed');
  if (activeError) return activeError;
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (!card) return invalid('card-not-found');
  const target = boardCellAt(state, player.position.row, player.position.col);
  if (!target || target.card) return invalid('occupied-cell');

  const nextState = cloneState(state);
  const nextPlayer = playerById(nextState, playerId);
  const nextTarget = boardCellAt(nextState, nextPlayer.position.row, nextPlayer.position.col);
  nextTarget.ownerId = playerId;
  nextTarget.card = { id: card.id, value: card.value, ownerId: playerId };
  nextPlayer.hand = nextPlayer.hand.filter((cardInHand) => cardInHand.id !== cardId);
  nextPlayer.actions.deployed = true;
  const resolved = resolveDeploymentEffects(
    nextState,
    { row: nextTarget.row, col: nextTarget.col },
    playerId,
    config,
  );
  const event = {
    type: 'deploy',
    playerId,
    cardId: card.id,
    cardValue: card.value,
    cell: { row: nextTarget.row, col: nextTarget.col },
    effects: resolved.effects,
    scoreDelta: resolved.effects.reduce((total, effect) => total + effect.scoreDelta, 0),
    message: `${nextPlayer.label} 部署了数字 ${card.value}${effectMessage(resolved.effects) ? `，${effectMessage(resolved.effects)}` : ''}`,
  };
  resolved.state.lastEvent = event;
  return { ok: true, state: resolved.state, event };
}

function allCardIds(state) {
  const ids = new Set();
  for (const player of state.players) {
    for (const card of player.hand) ids.add(card.id);
  }
  for (const cell of state.board) {
    if (cell.card) ids.add(cell.card.id);
  }
  return ids;
}

function nextDrawnCardId(state, playerId) {
  const usedIds = allCardIds(state);
  let sequence = 1;
  let id = `${playerId}-card-${sequence}`;
  while (usedIds.has(id)) {
    sequence += 1;
    id = `${playerId}-card-${sequence}`;
  }
  return id;
}

function drawCardsInPlace(state, playerId, count, random, config) {
  const player = playerById(state, playerId);
  const requested = Math.max(0, Math.floor(Number(count) || 0));
  const available = Math.max(0, config.cards.handLimit - player.hand.length);
  const drawnCount = Math.min(requested, available);
  for (let index = 0; index < drawnCount; index += 1) {
    player.hand.push({
      id: nextDrawnCardId(state, playerId),
      value: config.cards.values[randomIndex(random, config.cards.values.length)],
      ownerId: playerId,
    });
  }
  return drawnCount;
}

export function drawCards(
  state,
  playerId,
  count,
  random = Math.random,
  config = DEFAULT_CONFIG,
) {
  const player = playerById(state, playerId);
  if (!player || state.phase !== 'playing') return invalid('not-active-player');
  const nextState = cloneState(state);
  const drawnCount = drawCardsInPlace(nextState, playerId, count, random, config);
  nextState.lastEvent = {
    type: 'cards-drawn',
    playerId,
    drawnCount,
    message: `${player.label} 补充了 ${drawnCount} 张牌`,
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}

export function beginTurn(
  state,
  playerId,
  config = DEFAULT_CONFIG,
  random = Math.random,
) {
  const player = playerById(state, playerId);
  if (!player || state.phase !== 'playing' || state.activePlayerId !== playerId) {
    return invalid('not-active-player');
  }
  const nextState = cloneState(state);
  const nextPlayer = playerById(nextState, playerId);
  const drawnCount = drawCardsInPlace(
    nextState,
    playerId,
    config.cards.drawPerTurn,
    random,
    config,
  );
  nextPlayer.actions = { moved: false, deployed: false };
  nextState.lastEvent = {
    type: 'turn-started',
    playerId,
    drawnCount,
    message: `${nextPlayer.label} 开始行动，补充了 ${drawnCount} 张牌`,
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}

export function getFinalResult(state) {
  const scores = Object.fromEntries(state.players.map((player) => [player.id, player.score]));
  const [first, second] = state.players;
  if (first.score === second.score) {
    return {
      type: 'draw',
      winnerId: null,
      loserId: null,
      scores,
      message: `平局 · 双方 ${first.score} 分`,
    };
  }
  const winner = first.score > second.score ? first : second;
  const loser = winner.id === first.id ? second : first;
  return {
    type: 'win',
    winnerId: winner.id,
    loserId: loser.id,
    scores,
    message: `${winner.label} 获胜 · ${winner.score} 分`,
  };
}

export function endTurn(
  state,
  playerId,
  config = DEFAULT_CONFIG,
  random = Math.random,
) {
  const player = playerById(state, playerId);
  if (!player || state.phase !== 'playing' || state.activePlayerId !== playerId) {
    return invalid('not-active-player');
  }
  const nextState = cloneState(state);
  const endingPlayer = playerById(nextState, playerId);
  endingPlayer.completedTurns += 1;

  const turnLimit = config.turns.turnsPerPlayer;
  const everyoneFinished = nextState.players.every((candidate) => (
    candidate.completedTurns >= turnLimit
  ));
  if (everyoneFinished) {
    nextState.phase = 'finished';
    nextState.result = getFinalResult(nextState);
    nextState.lastEvent = {
      type: 'game-finished',
      playerId,
      message: `对局结束 · ${nextState.result.message}`,
    };
    return { ok: true, state: nextState, event: nextState.lastEvent };
  }

  const nextPlayer = nextState.players.find((candidate) => candidate.id !== playerId);
  nextState.activePlayerId = nextPlayer.id;
  if (nextState.activePlayerId === nextState.starterId) nextState.turnNumber += 1;
  const drawnCount = drawCardsInPlace(
    nextState,
    nextPlayer.id,
    config.cards.drawPerTurn,
    random,
    config,
  );
  nextPlayer.actions = { moved: false, deployed: false };
  nextState.lastEvent = {
    type: 'turn-ended',
    playerId,
    nextPlayerId: nextPlayer.id,
    drawnCount,
    message: `${endingPlayer.label} 结束回合，轮到${nextPlayer.label}，补充了 ${drawnCount} 张牌`,
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}
