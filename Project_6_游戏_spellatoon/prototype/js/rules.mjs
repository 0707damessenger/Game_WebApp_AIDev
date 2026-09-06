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
  nextState.lastEvent = {
    type: 'deploy',
    playerId,
    cardId: card.id,
    cardValue: card.value,
    cell: { row: nextTarget.row, col: nextTarget.col },
    message: `${nextPlayer.label} 部署了数字 ${card.value}`,
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}
