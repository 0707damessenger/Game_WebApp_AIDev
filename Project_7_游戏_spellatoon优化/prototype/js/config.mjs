export const CONFIG = Object.freeze({
  board: Object.freeze({
    size: 8,
    highWeightCells: Object.freeze([
      Object.freeze({ row: 3, col: 3 }),
      Object.freeze({ row: 3, col: 4 }),
      Object.freeze({ row: 4, col: 3 }),
      Object.freeze({ row: 4, col: 4 }),
    ]),
    highWeight: 2,
    normalWeight: 1,
    maxMoveDistance: 3,
    maxLineGap: 4,
  }),
  cards: Object.freeze({
    values: Object.freeze([1, 2, 3, 4, 5]),
    openingHand: 5,
    handLimit: 5,
    drawPerTurn: 2,
  }),
  actions: Object.freeze({
    initial: 3,
    limit: 3,
    restorePerTurn: 2,
  }),
  life: Object.freeze({ initial: 20 }),
  turns: Object.freeze({ turnsPerPlayer: 20 }),
  players: Object.freeze([
    Object.freeze({ id: 'p1', label: '赤方', color: '#ef4f62' }),
    Object.freeze({ id: 'p2', label: '蓝方', color: '#2389e8' }),
  ]),
});
