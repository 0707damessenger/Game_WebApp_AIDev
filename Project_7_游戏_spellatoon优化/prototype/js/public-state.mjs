function clone(value) {
  return value == null ? value : structuredClone(value);
}

function publicEvent(event) {
  if (!event) return null;
  const { cardId, cardValue, effects, ...visibleEvent } = event;
  if (effects) {
    visibleEvent.effects = effects.map(({ removedCardIds, ...visibleEffect }) => clone(visibleEffect));
  }
  return clone(visibleEvent);
}

export function projectStateForPlayer(state, playerId, connection = {}) {
  const localPlayer = state.players.find((player) => player.id === playerId);
  if (!localPlayer) return null;

  return {
    phase: state.phase,
    board: state.board.map(({ row, col, isHighWeight, ownerId, card }) => ({
      row,
      col,
      isHighWeight,
      ownerId,
      card: clone(card),
    })),
    players: state.players.map(({
      id,
      label,
      color,
      position,
      life,
      actionPoints,
      score,
      completedTurns,
    }) => ({
      id,
      label,
      color,
      position: clone(position),
      life,
      actionPoints,
      score,
      completedTurns,
    })),
    activePlayerId: state.activePlayerId,
    starterId: state.starterId,
    turnNumber: state.turnNumber,
    lastEvent: publicEvent(state.lastEvent),
    result: clone(state.result),
    localPlayerId: playerId,
    localHand: clone(localPlayer.hand),
    connection: clone(connection),
  };
}
