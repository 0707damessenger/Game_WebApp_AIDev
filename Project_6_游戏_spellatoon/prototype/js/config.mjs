export const CONFIG = Object.freeze({
  board: Object.freeze({
    size: 6,
    maxMoveDistance: 5,
    maxLineGap: 4,
  }),
  cards: Object.freeze({
    values: Object.freeze([1, 2, 3, 4, 5]),
    openingHand: 5,
    handLimit: 5,
    drawPerTurn: 2,
  }),
  turns: Object.freeze({
    turnsPerPlayer: 10,
  }),
  players: Object.freeze([
    Object.freeze({ id: 'p1', label: '赤方', color: '#ef4f62' }),
    Object.freeze({ id: 'p2', label: '蓝方', color: '#2389e8' }),
  ]),
  preview: Object.freeze({
    lineRange: 5,
  }),
  network: Object.freeze({
    port: 51359,
    heartbeatMs: 15000,
  }),
  motion: Object.freeze({
    effectMs: 620,
    turnNoticeMs: 1200,
  }),
  testing: Object.freeze({
    allowFixtures: true,
  }),
});
