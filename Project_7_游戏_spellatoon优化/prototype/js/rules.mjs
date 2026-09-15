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

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId);
}

function selectedCard(player, cardId) {
  return player?.hand.find((card) => card.id === cardId);
}

function boardCellAt(state, row, col) {
  return state.board.find((cell) => cell.row === row && cell.col === col);
}

function isInsideBoard(row, col, config) {
  return row >= 0 && row < config.board.size && col >= 0 && col < config.board.size;
}

function invalid(reason) {
  return { ok: false, reason };
}

function validateAction(state, playerId) {
  const player = playerById(state, playerId);
  if (!player || state.phase !== 'playing' || state.activePlayerId !== playerId) {
    return invalid('not-active-player');
  }
  if (player.actionPoints < 1) return invalid('no-action-points');
  return null;
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

export function getWeightedTerritory(state, config = DEFAULT_CONFIG) {
  const territory = Object.fromEntries(state.players.map((player) => [player.id, 0]));
  for (const cell of state.board) {
    if (!cell.ownerId) continue;
    territory[cell.ownerId] += cell.isHighWeight
      ? config.board.highWeight
      : config.board.normalWeight;
  }
  return territory;
}

export function settleTerritoryDamage(state, config = DEFAULT_CONFIG) {
  const nextState = cloneState(state);
  const territory = getWeightedTerritory(nextState, config);
  const [firstPlayer, secondPlayer] = nextState.players;
  const difference = territory[firstPlayer.id] - territory[secondPlayer.id];
  const trailingPlayer = difference === 0
    ? null
    : difference > 0 ? secondPlayer : firstPlayer;
  const damage = Math.abs(difference);

  if (trailingPlayer) trailingPlayer.life = Math.max(0, trailingPlayer.life - damage);

  const defeatedPlayer = nextState.players.find((player) => player.life === 0);
  if (defeatedPlayer) {
    const winner = nextState.players.find((player) => player.id !== defeatedPlayer.id);
    nextState.phase = 'finished';
    nextState.result = {
      type: 'life-defeat',
      winnerId: winner.id,
      loserId: defeatedPlayer.id,
    };
  }

  nextState.lastEvent = {
    type: 'territory-settled',
    territory,
    damage: trailingPlayer ? { playerId: trailingPlayer.id, amount: damage } : null,
  };
  return { state: nextState, territory, event: nextState.lastEvent };
}

export function getReachableCells(state, playerId, cardId, config = DEFAULT_CONFIG) {
  const actionError = validateAction(state, playerId);
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (actionError || !card) return [];

  const maxSteps = Math.min(card.value, config.board.maxMoveDistance);
  const start = player.position;
  const distances = new Map([[`${start.row}:${start.col}`, 0]]);
  const queue = [start];
  const directions = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
  ];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const distance = distances.get(`${current.row}:${current.col}`);
    if (distance >= maxSteps) continue;
    for (const direction of directions) {
      const next = { row: current.row + direction.row, col: current.col + direction.col };
      const key = `${next.row}:${next.col}`;
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

export function getPreviewTargets(state, previewCell, config = DEFAULT_CONFIG) {
  if (!isInsideBoard(previewCell.row, previewCell.col, config)) return [];
  const maxDistance = config.board.maxLineGap + 1;
  return state.board
    .filter((cell) => {
      if (!cell.card) return false;
      const sameRow = cell.row === previewCell.row;
      const sameCol = cell.col === previewCell.col;
      if (!sameRow && !sameCol) return false;
      const distance = sameRow
        ? Math.abs(cell.col - previewCell.col)
        : Math.abs(cell.row - previewCell.row);
      return distance > 0 && distance <= maxDistance;
    })
    .map((cell) => ({
      cell: { row: cell.row, col: cell.col },
      card: structuredClone(cell.card),
    }));
}

export function lockPreviewCell(state, previewCell, config = DEFAULT_CONFIG) {
  if (!isInsideBoard(previewCell.row, previewCell.col, config)) return invalid('outside-board');
  const cell = boardCellAt(state, previewCell.row, previewCell.col);
  if (!cell) return invalid('outside-board');
  if (cell.card) return invalid('occupied-cell');
  return { ok: true, previewCell: { row: previewCell.row, col: previewCell.col } };
}

export function performMove(state, playerId, cardId, path, config = DEFAULT_CONFIG) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
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
  nextPlayer.actionPoints -= 1;
  nextPlayer.hand = nextPlayer.hand.filter((handCard) => handCard.id !== cardId);
  nextState.lastEvent = {
    type: 'move',
    playerId,
    cardId,
    cardValue: card.value,
    path: structuredClone(path),
  };
  return { ok: true, state: nextState, event: nextState.lastEvent };
}

export function performDeploy(state, playerId, cardId, config = DEFAULT_CONFIG) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (!card) return invalid('card-not-found');
  const target = boardCellAt(state, player.position.row, player.position.col);
  if (!target || target.card) return invalid('occupied-cell');

  const nextState = cloneState(state);
  const nextPlayer = playerById(nextState, playerId);
  const nextTarget = boardCellAt(nextState, nextPlayer.position.row, nextPlayer.position.col);
  nextTarget.ownerId = playerId;
  nextTarget.card = { id: card.id, ownerId: playerId, value: card.value };
  nextPlayer.actionPoints -= 1;
  nextPlayer.hand = nextPlayer.hand.filter((handCard) => handCard.id !== cardId);
  const resolved = resolveDeploymentEffects(
    nextState,
    { row: nextTarget.row, col: nextTarget.col },
    playerId,
    config,
  );
  const event = {
    type: 'deploy',
    playerId,
    cardId,
    cardValue: card.value,
    cell: { row: nextTarget.row, col: nextTarget.col },
    effects: resolved.effects,
    scoreDelta: resolved.effects.reduce((total, effect) => total + effect.scoreDelta, 0),
  };
  resolved.state.lastEvent = event;
  return { ok: true, state: resolved.state, event };
}

const lineDirections = [
  { name: 'horizontal', rowDelta: 0, colDelta: 1 },
  { name: 'vertical', rowDelta: 1, colDelta: 0 },
];

function buildEffectPath(startCell, endCell) {
  const rowStep = Math.sign(endCell.row - startCell.row);
  const colStep = Math.sign(endCell.col - startCell.col);
  const length = Math.max(
    Math.abs(endCell.row - startCell.row),
    Math.abs(endCell.col - startCell.col),
  );
  return Array.from({ length: length + 1 }, (_, index) => ({
    row: startCell.row + rowStep * index,
    col: startCell.col + colStep * index,
  }));
}

function getLineCandidates(state, deployedCell, direction, config) {
  const deployed = boardCellAt(state, deployedCell.row, deployedCell.col);
  if (!deployed?.card) return [];
  const candidates = [];
  const maxDistance = config.board.maxLineGap + 1;

  for (const sign of [-1, 1]) {
    for (let distance = 1; distance <= maxDistance; distance += 1) {
      const row = deployedCell.row + direction.rowDelta * sign * distance;
      const col = deployedCell.col + direction.colDelta * sign * distance;
      if (!isInsideBoard(row, col, config)) break;
      const cell = boardCellAt(state, row, col);
      if (cell?.card?.value === deployed.card.value) candidates.push(cell);
    }
  }
  return candidates;
}

function getCellWeight(cell, config) {
  return cell.isHighWeight ? config.board.highWeight : config.board.normalWeight;
}

export function resolveDeploymentEffects(state, deployedCell, deployingPlayerId, config = DEFAULT_CONFIG) {
  const deployed = boardCellAt(state, deployedCell.row, deployedCell.col);
  if (!deployed?.card) return { state: cloneState(state), effects: [] };

  const effects = [];
  for (const direction of lineDirections) {
    const candidates = getLineCandidates(state, deployedCell, direction, config);
    if (!candidates.length) continue;

    const coordinates = [deployedCell, ...candidates];
    const axis = direction.name === 'horizontal' ? 'col' : 'row';
    const edgeValues = coordinates.map((cell) => cell[axis]);
    const startCell = direction.name === 'horizontal'
      ? { row: deployedCell.row, col: Math.min(...edgeValues) }
      : { row: Math.min(...edgeValues), col: deployedCell.col };
    const endCell = direction.name === 'horizontal'
      ? { row: deployedCell.row, col: Math.max(...edgeValues) }
      : { row: Math.max(...edgeValues), col: deployedCell.col };
    const path = buildEffectPath(startCell, endCell);
    const pathCells = path.map((cell) => boardCellAt(state, cell.row, cell.col));
    const isChain = candidates.every((cell) => cell.card.ownerId === deployingPlayerId);
    const removedCardIds = isChain
      ? [deployed.card.id, ...candidates.map((cell) => cell.card.id)]
      : pathCells.filter((cell) => cell.card).map((cell) => cell.card.id);
    const pathWeight = pathCells.reduce((total, cell) => total + getCellWeight(cell, config), 0);
    effects.push({
      type: isChain ? 'chain' : 'consume',
      direction: direction.name,
      path,
      removedCardIds: [...new Set(removedCardIds)],
      paintOwnerId: deployingPlayerId,
      scoreDelta: deployed.card.value * pathWeight,
    });
  }

  const nextState = cloneState(state);
  const removedCardIds = new Set(effects.flatMap((effect) => effect.removedCardIds));
  for (const effect of effects) {
    for (const coordinate of effect.path) {
      boardCellAt(nextState, coordinate.row, coordinate.col).ownerId = effect.paintOwnerId;
    }
    playerById(nextState, deployingPlayerId).score += effect.scoreDelta;
  }
  for (const cell of nextState.board) {
    if (cell.card && removedCardIds.has(cell.card.id)) cell.card = null;
  }
  return { state: nextState, effects };
}

export function previewDeployment(state, playerId, cardId, config = DEFAULT_CONFIG) {
  const actionError = validateAction(state, playerId);
  if (actionError) return actionError;
  const player = playerById(state, playerId);
  const card = selectedCard(player, cardId);
  if (!card) return invalid('card-not-found');
  const target = boardCellAt(state, player.position.row, player.position.col);
  if (!target || target.card) return invalid('occupied-cell');

  const previewState = cloneState(state);
  const previewCell = boardCellAt(previewState, player.position.row, player.position.col);
  previewCell.ownerId = playerId;
  previewCell.card = { id: 'preview-card', ownerId: playerId, value: card.value };
  const resolved = resolveDeploymentEffects(previewState, previewCell, playerId, config);
  return {
    ok: true,
    effects: resolved.effects,
    scoreDelta: resolved.effects.reduce((total, effect) => total + effect.scoreDelta, 0),
  };
}

export function simulatePreview(
  state,
  playerId,
  previewCell,
  targetCardCell,
  config = DEFAULT_CONFIG,
) {
  const locked = lockPreviewCell(state, previewCell, config);
  if (!locked.ok) return locked;
  const player = playerById(state, playerId);
  if (!player) return invalid('unknown-player');
  const target = boardCellAt(state, targetCardCell.row, targetCardCell.col);
  if (!target?.card) return invalid('preview-card-not-found');

  const previewState = cloneState(state);
  const hypotheticalCell = boardCellAt(previewState, previewCell.row, previewCell.col);
  hypotheticalCell.ownerId = playerId;
  hypotheticalCell.card = {
    id: 'preview-card',
    ownerId: playerId,
    value: target.card.value,
  };
  const resolved = resolveDeploymentEffects(previewState, previewCell, playerId, config);
  return {
    ok: true,
    previewCell: { ...previewCell },
    targetCard: structuredClone(target.card),
    assumedCard: { ownerId: playerId, value: target.card.value },
    effects: resolved.effects,
    scoreDelta: resolved.effects.reduce((total, effect) => total + effect.scoreDelta, 0),
  };
}

function getScoreResult(state) {
  const [firstPlayer, secondPlayer] = state.players;
  if (firstPlayer.score === secondPlayer.score) {
    return { type: 'score-draw', winnerId: null, loserId: null };
  }
  const winner = firstPlayer.score > secondPlayer.score ? firstPlayer : secondPlayer;
  const loser = winner.id === firstPlayer.id ? secondPlayer : firstPlayer;
  return { type: 'score-victory', winnerId: winner.id, loserId: loser.id };
}

export function endTurn(state, playerId, config = DEFAULT_CONFIG, random = Math.random) {
  const actionError = validateAction(state, playerId);
  if (actionError?.reason === 'no-action-points') {
    const player = playerById(state, playerId);
    if (!player || state.phase !== 'playing' || state.activePlayerId !== playerId) return actionError;
  } else if (actionError) {
    return actionError;
  }

  const nextState = cloneState(state);
  playerById(nextState, playerId).completedTurns += 1;
  const roundCompleted = nextState.players.every((player) => (
    player.completedTurns === nextState.players[0].completedTurns
  ));
  const settlement = roundCompleted ? settleTerritoryDamage(nextState, config) : null;
  const settledState = settlement?.state || nextState;
  const territory = settlement?.territory || getWeightedTerritory(nextState, config);
  const territoryDamage = settlement?.event.damage || null;

  if (settledState.phase === 'finished') {
    const event = {
      type: 'turn-ended',
      playerId,
      territory,
      territoryDamage,
      territorySettled: roundCompleted,
      result: settledState.result,
    };
    settledState.lastEvent = event;
    return { ok: true, state: settledState, event };
  }

  if (settledState.players.every((player) => player.completedTurns >= config.turns.turnsPerPlayer)) {
    settledState.phase = 'finished';
    settledState.result = getScoreResult(settledState);
    const event = {
      type: 'game-finished',
      playerId,
      territory,
      territoryDamage,
      territorySettled: roundCompleted,
      result: settledState.result,
    };
    settledState.lastEvent = event;
    return { ok: true, state: settledState, event };
  }

  const nextPlayer = settledState.players.find((player) => player.id !== playerId);
  if (nextPlayer.id === settledState.starterId) settledState.turnNumber += 1;
  const started = beginTurn(settledState, nextPlayer.id, config, random);
  const event = {
    type: 'turn-ended',
    playerId,
    nextPlayerId: nextPlayer.id,
    territory,
    territoryDamage,
    territorySettled: roundCompleted,
    drawnCount: started.event.drawnCount,
  };
  started.state.lastEvent = event;
  return { ok: true, state: started.state, event };
}
