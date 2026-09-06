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
