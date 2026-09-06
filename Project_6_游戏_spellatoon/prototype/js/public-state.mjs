function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function createPublicState(state, connection = {}) {
  return {
    phase: state.phase,
    board: state.board.map(({ row, col, ownerId, card }) => ({
      row,
      col,
      ownerId,
      card: clone(card),
    })),
    players: state.players.map(({
      id,
      label,
      color,
      position,
      score,
      completedTurns,
      actions,
    }) => ({
      id,
      label,
      color,
      position: clone(position),
      score,
      completedTurns,
      actions: clone(actions),
    })),
    activePlayerId: state.activePlayerId,
    starterId: state.starterId,
    turnNumber: state.turnNumber,
    turnDeadlineAt: state.turnDeadlineAt,
    lastEvent: clone(state.lastEvent),
    result: clone(state.result),
    connection: clone(connection),
  };
}

export function createPlayerView(state, playerId, connection = {}) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;
  return {
    ...createPublicState(state, connection),
    localPlayerId: playerId,
    ownHand: clone(player.hand),
  };
}
