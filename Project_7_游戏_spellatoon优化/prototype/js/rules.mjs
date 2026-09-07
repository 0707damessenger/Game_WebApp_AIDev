import { CONFIG as DEFAULT_CONFIG } from './config.mjs';

function randomIndex(random, length) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999) : 0;
  return Math.floor(normalized * length);
}

function isHighWeightCell(row, col, config) {
  return config.board.highWeightCells.some((cell) => cell.row === row && cell.col === col);
}

function createBoard(config) {
  return Array.from({ length: config.board.size ** 2 }, (_, index) => {
    const row = Math.floor(index / config.board.size);
    const col = index % config.board.size;
    return {
      row,
      col,
      isHighWeight: isHighWeightCell(row, col, config),
      ownerId: null,
      card: null,
    };
  });
}

function createCard(playerId, sequence, random, config) {
  return {
    id: `${playerId}-card-${sequence}`,
    ownerId: playerId,
    value: config.cards.values[randomIndex(random, config.cards.values.length)],
  };
}

function createOpeningHand(playerId, random, config, sequence) {
  return Array.from({ length: config.cards.openingHand }, (_, index) => (
    createCard(playerId, sequence + index + 1, random, config)
  ));
}

function cloneState(state) {
  return structuredClone(state);
}

export function createInitialState({ random = Math.random, config = DEFAULT_CONFIG } = {}) {
  let cardSequence = 0;
  const players = config.players.map((player, index) => {
    const hand = createOpeningHand(player.id, random, config, cardSequence);
    cardSequence += hand.length;
    return {
      id: player.id,
      label: player.label,
      color: player.color,
      position: index === 0
        ? { row: 0, col: 0 }
        : { row: config.board.size - 1, col: config.board.size - 1 },
      hand,
      life: config.life.initial,
      actionPoints: config.actions.initial,
      score: 0,
      completedTurns: 0,
    };
  });
  const starter = players[randomIndex(random, players.length)];

  return {
    phase: 'playing',
    board: createBoard(config),
    players,
    activePlayerId: starter.id,
    starterId: starter.id,
    turnNumber: 1,
    nextCardSequence: cardSequence,
    lastEvent: { type: 'game-started', playerId: starter.id },
    result: null,
  };
}

export function beginTurn(state, playerId, config = DEFAULT_CONFIG, random = Math.random) {
  if (state.phase !== 'playing') return { ok: false, reason: 'game-finished' };

  const nextState = cloneState(state);
  const player = nextState.players.find((candidate) => candidate.id === playerId);
  if (!player) return { ok: false, reason: 'unknown-player' };

  player.actionPoints = Math.min(
    config.actions.limit,
    player.actionPoints + config.actions.restorePerTurn,
  );

  const drawnCount = Math.min(config.cards.drawPerTurn, config.cards.handLimit - player.hand.length);
  for (let index = 0; index < drawnCount; index += 1) {
    nextState.nextCardSequence += 1;
    player.hand.push(createCard(player.id, nextState.nextCardSequence, random, config));
  }

  nextState.activePlayerId = playerId;
  nextState.lastEvent = { type: 'turn-started', playerId, drawnCount };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}
