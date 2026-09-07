# Territory Pressure Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a standalone two-player Spellatoon prototype that tests territory-pressure combat, central high-weight tiles, action-point turns, two-card replenishment, LAN play, and local pass-the-device play.

**Architecture:** Keep all game mutation in pure rule functions that receive the one exported `CONFIG` object. The browser renders public state plus the active local hand; a small HTTP/SSE server owns LAN state, while local pass-the-device mode uses the identical pure rules with a handoff curtain.

**Tech Stack:** Native HTML/CSS/browser ES modules, Node.js built-in `node:test` and `http`, Server-Sent Events, and the workspace Playwright installation.

---

## Module Boundaries

| File or folder | Responsibility |
|---|---|
| `prototype/js/config.mjs` | The sole source of numeric values and feature switches. |
| `prototype/js/rules.mjs` | Immutable game-state creation, cards, action points, movement, deployment, effects, territory damage and victory. |
| `prototype/js/public-state.mjs` | Public/private state projection for a particular player. |
| `prototype/js/render.mjs` | DOM rendering only; never changes rules state. |
| `prototype/js/input.mjs` | Card selection, target confirmation and local action dispatch. |
| `prototype/js/app.mjs` | Browser mode selection, local state orchestration and LAN client connection. |
| `prototype/server.mjs` | Authoritative room lifecycle and SSE broadcasts. |
| `prototype/tests/*.test.mjs` | Pure-rule, projection, server, UI and browser contracts. |

### Task 1: Core State and Resource Economy

**Files:**
- Create: `Project_7_游戏_spellatoon优化/prototype/js/config.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/js/rules.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/progress.md`

- [ ] **Step 1: Write the failing core-state tests.**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.mjs';
import { beginTurn, createInitialState } from '../js/rules.mjs';

test('creates mirrored players with life, action points, hands, and central high-weight cells', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  assert.deepEqual(state.players.map((player) => player.life), [CONFIG.life.initial, CONFIG.life.initial]);
  assert.deepEqual(state.players.map((player) => player.actionPoints), [CONFIG.actions.initial, CONFIG.actions.initial]);
  assert.equal(state.board.filter((cell) => cell.isHighWeight).length, 4);
  assert.ok(state.players.every((player) => player.hand.length === CONFIG.cards.openingHand));
});

test('restores stored action points up to the cap and draws two cards without exceeding the hand limit', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[0].actionPoints = 1;
  state.players[0].hand = state.players[0].hand.slice(0, 2);
  const result = beginTurn(state, 'p1', CONFIG, () => 0.999);
  assert.equal(result.ok, true);
  assert.equal(result.state.players[0].actionPoints, CONFIG.actions.limit);
  assert.equal(result.state.players[0].hand.length, 4);
  assert.equal(result.event.drawnCount, CONFIG.cards.drawPerTurn);
});
```

- [ ] **Step 2: Run the test and verify a missing-module failure.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `config.mjs` or `rules.mjs`.

- [ ] **Step 3: Add the smallest complete configuration and rule API.**

```js
export const CONFIG = Object.freeze({
  board: Object.freeze({ size: 8, highWeightCells: Object.freeze([{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }, { row: 4, col: 4 }]), highWeight: 2, normalWeight: 1, maxMoveDistance: 3, maxLineGap: 4 }),
  cards: Object.freeze({ values: Object.freeze([1, 2, 3, 4, 5]), openingHand: 5, handLimit: 5, drawPerTurn: 2 }),
  actions: Object.freeze({ initial: 3, limit: 3, restorePerTurn: 2 }),
  life: Object.freeze({ initial: 20 }),
  turns: Object.freeze({ turnsPerPlayer: 20 }),
  players: Object.freeze([Object.freeze({ id: 'p1', label: '赤方', color: '#ef4f62' }), Object.freeze({ id: 'p2', label: '蓝方', color: '#2389e8' })]),
});
```

Implement `createInitialState()` with the board cell shape `{ row, col, isHighWeight, ownerId, card }`, mirrored starting positions, opening hands, life, action points, score, completed turns, a random starter and an immutable result object. Implement `beginTurn()` to clone state, add capped action points, draw capped cards and set a `turn-started` event.

- [ ] **Step 4: Run the core test and verify it passes.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: 2 passing tests.

- [ ] **Step 5: Append the red/green record to `prototype/progress.md` and commit.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon行动点与补牌规则模块"`

### Task 2: Weighted Territory Damage and Early Defeat

**Files:**
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/rules.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

- [ ] **Step 1: Write failing territory tests.**

```js
test('uses central tiles twice when comparing territory and damages only the trailing player', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.board.find((cell) => cell.row === 3 && cell.col === 3).ownerId = 'p1';
  state.board.find((cell) => cell.row === 0 && cell.col === 0).ownerId = 'p2';
  const result = settleTerritoryDamage(state, CONFIG);
  assert.deepEqual(result.territory, { p1: 2, p2: 1 });
  assert.equal(result.state.players[1].life, CONFIG.life.initial - 1);
});

test('ends immediately when territory damage reduces life to zero', () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  state.players[1].life = 1;
  state.board.find((cell) => cell.row === 3 && cell.col === 3).ownerId = 'p1';
  const result = settleTerritoryDamage(state, CONFIG);
  assert.equal(result.state.phase, 'finished');
  assert.equal(result.state.result.type, 'life-defeat');
  assert.equal(result.state.result.winnerId, 'p1');
});
```

- [ ] **Step 2: Run the tests and verify they fail because `settleTerritoryDamage` is missing.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: import failure for `settleTerritoryDamage`.

- [ ] **Step 3: Implement `getWeightedTerritory()` and `settleTerritoryDamage()`.**

`getWeightedTerritory()` returns an object keyed by player id and sums `CONFIG.board.highWeight` for central owned cells and `CONFIG.board.normalWeight` elsewhere. `settleTerritoryDamage()` clones state, identifies the sole trailing player when totals differ, subtracts the exact difference, records territory and damage in `lastEvent`, and creates a `life-defeat` result when life reaches zero.

- [ ] **Step 4: Run the rules suite and verify all tests pass.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: all Task 1 and Task 2 tests pass.

- [ ] **Step 5: Commit the module.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon领地生命结算模块"`

### Task 3: Flexible Action-Point Movement and Deployment

**Files:**
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/rules.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

- [ ] **Step 1: Write failing tests that perform three mixed actions in one turn and reject a fourth.**

```js
test('allows repeated action types while cards and action points remain', () => {
  const state = fixtureWithHand([1, 1, 1]);
  const first = performMove(state, 'p1', state.players[0].hand[0].id, [{ row: 0, col: 1 }], CONFIG);
  const second = performDeploy(first.state, 'p1', first.state.players[0].hand[0].id, CONFIG);
  const third = performMove(second.state, 'p1', second.state.players[0].hand[0].id, [{ row: 0, col: 2 }], CONFIG);
  assert.equal(third.state.players[0].actionPoints, 0);
  assert.equal(performMove(third.state, 'p1', 'missing', [{ row: 0, col: 3 }], CONFIG).reason, 'no-action-points');
});
```

- [ ] **Step 2: Verify the test fails because action functions are absent.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: missing exports for `performMove` and `performDeploy`.

- [ ] **Step 3: Implement `getReachableCells()`, `performMove()` and `performDeploy()`.**

Both actions validate active player, card ownership, legality and at least one action point. On success they consume exactly one card and one point. They do not store per-type action flags. Movement uses orthogonal paths and the configured movement cap; deployment paints the current cell and delegates effects to the next task.

- [ ] **Step 4: Run all pure-rule tests and commit.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: all tests pass.

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon自由行动点模块"`

### Task 4: Weighted Chains, Consumes and Turn Settlement

**Files:**
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/rules.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

- [ ] **Step 1: Write failing effect and end-turn tests.**

```js
test('counts a central tile twice when calculating a chain score', () => {
  const state = chainFixtureAcrossCenter();
  const result = performDeploy(state, 'p1', state.players[0].hand[0].id, CONFIG);
  assert.equal(result.event.effects[0].scoreDelta, 8);
});

test('settles territory damage before switching to the restored next player turn', () => {
  const state = activeTurnFixture();
  const result = endTurn(state, 'p1', CONFIG, () => 0);
  assert.equal(result.state.players[1].actionPoints, CONFIG.actions.limit);
  assert.equal(result.event.territoryDamage.playerId, 'p2');
  assert.equal(result.state.activePlayerId, 'p2');
});
```

- [ ] **Step 2: Verify red.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: failing weighted score and missing `endTurn` assertions.

- [ ] **Step 3: Implement line effects and `endTurn()`.**

Reuse the original line rules: inspect only the newly deployed row and column, form a chain for same-owner equal values or a consume for different owners, remove the appropriate cards and paint the path. Score each path as card value multiplied by the sum of every path cell weight. `endTurn()` increments completed turns, calls territory settlement first, stops on life defeat, otherwise switches player, begins their turn, and uses score only after both players reach the configured turn limit.

- [ ] **Step 4: Run the rules suite and commit.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected: all rules tests pass.

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon加权连锁与回合结算模块"`

### Task 5: Browser Game Surface and Local Demo

**Files:**
- Create: `Project_7_游戏_spellatoon优化/prototype/index.html`
- Create: `Project_7_游戏_spellatoon优化/prototype/css/styles.css`
- Create: `Project_7_游戏_spellatoon优化/prototype/js/render.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/js/input.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/js/app.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

- [ ] **Step 1: Write the failing browser contract.**

```js
test('shows life, action points, weighted central cells, hand and end-turn control in local demo', async () => {
  const page = await openDemoPage();
  await expect(page.locator('#board .cell[data-high-weight="true"]')).toHaveCount(4);
  await expect(page.locator('#life-summary')).toContainText('生命');
  await expect(page.locator('#action-points')).toContainText('行动点');
  await expect(page.locator('#hand .card')).toHaveCount(5);
});
```

- [ ] **Step 2: Verify red.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

Expected: test cannot open `index.html` or cannot find required selectors.

- [ ] **Step 3: Build the minimum interactive local surface.**

Render the board, persistent life/action point/score/turn information, four visibly marked central cells, hand cards and end-turn button. Reuse the original two-click target confirmation. Expose `window.render_game_to_text()` with phase, active player, life, action points, territory, cards and central ownership; expose `window.advanceTime(ms)` for deterministic timer testing.

- [ ] **Step 4: Run the UI contract and the workspace Playwright client; inspect the screenshot and console errors.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

Run: `node .agents/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:51360/?demo --actions-json "{\"steps\":[{\"buttons\":[],\"frames\":2}]}"`

Expected: contract passes; screenshot visibly shows the four central cells, life and action points; text state matches the screen; no console errors.

- [ ] **Step 5: Commit the UI module.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon优化版本地对局界面"`

### Task 6: LAN Rooms and Private-State Projection

**Files:**
- Create: `Project_7_游戏_spellatoon优化/prototype/js/public-state.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/server.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/tests/public-state.test.mjs`
- Create: `Project_7_游戏_spellatoon优化/prototype/tests/server.test.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/app.mjs`

- [ ] **Step 1: Write failing tests for hand isolation and server-authoritative actions.**

```js
test('projects only the requesting player hand while keeping life and action points public', () => {
  const projected = projectStateForPlayer(fullState, 'p1');
  assert.deepEqual(projected.localHand, fullState.players[0].hand);
  assert.equal(JSON.stringify(projected).includes(fullState.players[1].hand[0].id), false);
  assert.equal(projected.players[1].life, fullState.players[1].life);
});
```

- [ ] **Step 2: Verify red, then implement projection and a room server.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/public-state.test.mjs Project_7_游戏_spellatoon优化/prototype/tests/server.test.mjs`

Expected before implementation: missing module failure.

Implement four-digit room creation, join, host start, reconnect before expiry, action validation through `rules.mjs`, SSE state events and room destruction on completion or configured expiry.

- [ ] **Step 3: Run server tests and two-browser contract; inspect both projected states.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/public-state.test.mjs Project_7_游戏_spellatoon优化/prototype/tests/server.test.mjs`

Expected: both pass; each player sees their own hand only and both see life, action points and central ownership.

- [ ] **Step 4: Commit.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon优化版局域网对局模块"`

### Task 7: Local Pass-the-Device Mode

**Files:**
- Modify: `Project_7_游戏_spellatoon优化/prototype/index.html`
- Modify: `Project_7_游戏_spellatoon优化/prototype/css/styles.css`
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/app.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

- [ ] **Step 1: Write a failing browser contract for the handoff curtain.**

```js
test('hides the previous hand until the next local player accepts the handoff', async () => {
  const page = await openSoloPage();
  await page.getByRole('button', { name: '单机双人' }).click();
  await expect(page.locator('#handoff-dialog')).toBeVisible();
  await expect(page.locator('#hand')).toBeHidden();
  await page.getByRole('button', { name: '开始行动' }).click();
  await expect(page.locator('#handoff-dialog')).toBeHidden();
  await expect(page.locator('#hand .card')).toHaveCount(5);
});
```

- [ ] **Step 2: Verify red, then implement the solo entry and handoff curtain.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

Expected before implementation: selector or button assertion failure.

Implement the project-6-compatible behaviour: a lobby entry, curtain after game start and every local turn transition, visual player-color handoff prompt, zero hand visibility until confirmation, and timer start only after confirmation. Use the existing local rule state, not a duplicate rules path.

- [ ] **Step 3: Run browser contract and inspect screenshot/text state.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/ui-contract.test.mjs`

Expected: handoff contract passes and text state does not expose another player's hand while curtain is visible.

- [ ] **Step 4: Commit.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完成Spellatoon优化版单机双人模式"`

### Task 8: Full Verification and Playtest Instrumentation

**Files:**
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/rules.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/js/render.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`
- Modify: `Project_7_游戏_spellatoon优化/prototype/progress.md`

- [ ] **Step 1: Write failing tests for the required playtest record fields.**

```js
test('records turn territory, life damage, action point use and central ownership in the public event', () => {
  const result = endTurn(activeTurnFixture(), 'p1', CONFIG, () => 0);
  assert.ok(result.event.territory);
  assert.ok(Object.hasOwn(result.event, 'territoryDamage'));
  assert.ok(Object.hasOwn(result.event, 'centralOwners'));
});
```

- [ ] **Step 2: Verify red, implement event fields and a compact visible last-settlement summary.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/rules.test.mjs`

Expected before implementation: missing event-field assertion.

- [ ] **Step 3: Run the full unit suite and browser scenarios.**

Run: `node --test Project_7_游戏_spellatoon优化/prototype/tests/*.test.mjs`

Run: `node .agents/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:51360/?demo --actions-json "{\"steps\":[{\"buttons\":[],\"frames\":2}]}"`

Expected: all automated tests pass; screenshot, text state and console are clean.

- [ ] **Step 4: Record the manual two-player test checklist in `prototype/progress.md` and commit.**

Run: `git add Project_7_游戏_spellatoon优化/prototype && git commit -m "完善Spellatoon优化版试玩记录与验证"`
