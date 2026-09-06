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
