# Spellatoon Web Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a two-device LAN Spellatoon prototype with private hands, a shared 6x6 board, card-driven movement/deployment, chain and consume scoring, turn settlement, and empty-cell strategy preview.

**Architecture:** Use native HTML, CSS, and browser ES modules. Keep gameplay rules in pure functions so they can be tested without the browser; keep rendering and input separate from state mutation. A Node HTTP server owns the authoritative full match state and exposes public state plus each player's private hand through Server-Sent Events, while action requests are validated before broadcasting.

**Tech Stack:** Native HTML/CSS, browser ES modules, Node.js built-in `node:test` and `http`, Playwright for browser verification, and Server-Sent Events for LAN updates. No external art assets; cards, roles, cells, paths, and effects use solid geometric CSS shapes.

---

## Scope and constraints

- Work only in `Project_6_游戏_spellatoon`; preserve unrelated Project 5 changes.
- Follow `docs/design.md` as the rule contract. If a rule changes, update that document before changing code.
- Keep every gameplay value and feature switch in the single exported `CONFIG` object in `prototype/js/config.mjs`.
- Implement one independent module at a time. Do not begin the next module while the current module's tests and browser verification have unresolved failures.
- The normal UI shows only the local hand. Board, roles, deployed cards, colors, scores, active player, and connection status are public.
- Expose `window.render_game_to_text()` and `window.advanceTime(ms)` for automated browser checks. Text output includes the coordinate system and all visible interactive state.
- Keep `prototype/progress.md` with the original prompt at the top and append decisions, test results, and remaining work after each meaningful chunk.
- Commit and push remain user decisions. Pause at each checkpoint and ask whether to commit; never push without an explicit request.

## File map

- `prototype/index.html`: browser shell, board/console/lobby/result containers, module entry point.
- `prototype/css/styles.css`: bright-paper visual system, responsive board and console, card/cell/role/effect states, focus and reduced-motion styles.
- `prototype/js/config.mjs`: the only `CONFIG` object for board, cards, turns, colors, motion, preview, and network values.
- `prototype/js/rules.mjs`: pure state creation, drawing, movement, deployment, effects, turn transitions, and final settlement.
- `prototype/js/public-state.mjs`: public projection and local-player private-hand projection.
- `prototype/js/render.mjs`: DOM rendering only; never mutates match state.
- `prototype/js/input.mjs`: board/card/button events and preview state; calls injected action callbacks.
- `prototype/js/app.mjs`: local view state, lobby, action requests, SSE handling, rendering, text-state, and deterministic-time hooks.
- `prototype/server.mjs`: static files, rooms, SSE streams, action routing, and authoritative rule execution.
- `prototype/tests/rules.test.mjs`: pure gameplay rule tests.
- `prototype/tests/public-state.test.mjs`: hidden-information projection tests.
- `prototype/tests/server.test.mjs`: room/action/SSE contract tests.
- `prototype/smoke-test.mjs`: Playwright scenarios, screenshots, text state, and console-error reporting.
- `prototype/progress.md`: web-game development handoff log.
- `package.json`: add a `test:spellatoon` script without replacing existing scripts.

## Shared interfaces

Use these names and shapes across tasks:

```js
// row 0 is the top row; col 0 is the left column.
const card = { id: "card-id", value: 3, ownerId: "p1" };
const state = {
  phase: "playing",
  board: [{ row: 0, col: 0, ownerId: null, card: null }],
  players: [{ id: "p1", position: { row: 0, col: 0 }, hand: [card], score: 0, completedTurns: 0, actions: { moved: false, deployed: false } }],
  activePlayerId: "p1", starterId: "p1", turnNumber: 1, lastEvent: null, result: null
};
```

Rules functions used by tests, browser, and server:

```js
createInitialState({ random, config })
drawCards(state, playerId, count, random, config)
getReachableCells(state, playerId, cardId, config)
performMove(state, playerId, cardId, path, config)
performDeploy(state, playerId, cardId, config)
beginTurn(state, playerId, config)
endTurn(state, playerId, config)
getFinalResult(state)
```

Successful mutations return `{ ok: true, state, event }`; rejected actions return `{ ok: false, reason }` without mutating the input. Events contain public data only; private hand changes are supplied by `public-state.mjs`.

## Task 1: Foundation board, roles, and card state

**Files:**

- Create: `prototype/js/config.mjs`, `prototype/js/rules.mjs`, `prototype/tests/rules.test.mjs`
- Create: `prototype/index.html`, `prototype/css/styles.css`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/progress.md`
- Modify: `package.json`

- [ ] **Step 1: Write failing foundation tests.**

Create tests that import `CONFIG` and `createInitialState`, then assert a board length of `CONFIG.board.size * CONFIG.board.size`, roles at `{ row: 0, col: 0 }` and `{ row: CONFIG.board.size - 1, col: CONFIG.board.size - 1 }`, both opening hands at `CONFIG.cards.openingHand`, card values in `CONFIG.cards.values`, no board cards, clean action flags, and a starter equal to the active player.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../js/config.mjs";
import { createInitialState } from "../js/rules.mjs";

test("initializes board, diagonal roles, and full hands", () => {
  const state = createInitialState({ random: () => 0, config: CONFIG });
  assert.equal(state.board.length, CONFIG.board.size * CONFIG.board.size);
  assert.deepEqual(state.players.map((p) => p.position), [
    { row: 0, col: 0 },
    { row: CONFIG.board.size - 1, col: CONFIG.board.size - 1 }
  ]);
  assert.deepEqual(state.players.map((p) => p.hand.length), [
    CONFIG.cards.openingHand, CONFIG.cards.openingHand
  ]);
  assert.ok(state.board.every((cell) => cell.card === null));
});
```

- [ ] **Step 2: Run the focused test and observe the expected failure.**

Run `node --test "Project_6_游戏_spellatoon/prototype/tests/rules.test.mjs"`. Expected: failure because the imported modules do not exist. Confirm this is a missing-feature failure before writing production code.

- [ ] **Step 3: Implement the single configuration source and initial state.**

Create `config.mjs` with `CONFIG.board` `{ size: 6, maxMoveDistance: 5, maxLineGap: 4 }`, `CONFIG.cards` `{ values: [1, 2, 3, 4, 5], openingHand: 5, handLimit: 5, drawPerTurn: 2 }`, `CONFIG.turns.turnsPerPlayer` `10`, two player ids/colors, `CONFIG.preview.lineRange` `5`, `CONFIG.network.port` `51359`, motion timings, and `CONFIG.testing` `{ allowFixtures: true }`. Freeze the object and nested settings. Implement `createInitialState({ random = Math.random, config = CONFIG } = {})` with row-major cells, opposite-corner roles, unique card ids, opening hands, action flags, and a deterministic random starter selection.

- [ ] **Step 4: Run the foundation tests and add the dedicated test command.**

Run the focused test again and then add `"test:spellatoon": "node --test \\\"Project_6_游戏_spellatoon/prototype/tests/*.test.mjs\\\""` to `package.json`. Run `npm run test:spellatoon`. Expected: all foundation tests pass and existing repository scripts remain present.

- [ ] **Step 5: Add the visible board shell and browser hooks.**

Build `index.html` with `#board`, `#player-console`, `#hand`, `#status`, and `#event-log`. Render a 6x6 grid, both public role tokens, empty cells, and only the local hand. Add `window.render_game_to_text` with `coordinateSystem`, phase, active player, public players, public board, and `ownHand`; add deterministic `window.advanceTime(ms)` that advances a local virtual time and rerenders. Use CSS tokens and solid geometric shapes; do not add a title screen.

- [ ] **Step 6: Run the first browser screenshot and inspect it visually.**

Start `python -m http.server 51359 --directory "Project_6_游戏_spellatoon/prototype"`, open `http://127.0.0.1:51359/`, run the official web-game Playwright client with a mouse action and pause, inspect the screenshot, inspect `render_game_to_text`, and check browser console output. Confirm the board, diagonal roles, five local cards, and absence of opponent hand are visible.

- [ ] **Step 7: Update progress and ask for the checkpoint.**

Append the original prompt, test output, screenshot path, and remaining issue to `progress.md`. Ask whether to commit with `完成Spellatoon棋盘与卡牌基础模块`; do not commit or push until answered.

## Task 2: Movement and deployment actions

**Files:**

- Modify: `prototype/js/rules.mjs`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/tests/rules.test.mjs`, `prototype/progress.md`
- Create: `prototype/js/input.mjs`

- [ ] **Step 1: Write failing movement and deployment tests.**

Add real-state fixtures and tests for a three-step turning path, a path longer than the selected card, board-boundary rejection, traversal through occupied cells, deployment only on the active player's current empty cell, occupied-cell rejection, non-active-player rejection, repeated move/deploy rejection, and no hand/action consumption on invalid actions. Use reason strings `move-distance`, `occupied-cell`, `not-active-player`, `move-used`, and `deploy-used`.

```js
test("allows an orthogonal path to turn and consumes the selected card", () => {
  const state = stateWithPlayerHandAt({ playerId: "p1", cardValue: 3, position: { row: 0, col: 0 } });
  const cardId = state.players[0].hand[0].id;
  const result = performMove(state, "p1", cardId, [
    { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 1, col: 2 }
  ], CONFIG);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.players[0].position, { row: 1, col: 2 });
  assert.equal(result.state.players[0].actions.moved, true);
});

test("rejects an overlong path without changing state", () => {
  const state = stateWithPlayerHandAt({ playerId: "p1", cardValue: 2, position: { row: 0, col: 0 } });
  const result = performMove(state, "p1", state.players[0].hand[0].id, [
    { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }
  ], CONFIG);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "move-distance");
  assert.equal(state.players[0].hand.length, 1);
  assert.equal(state.players[0].actions.moved, false);
});
```

- [ ] **Step 2: Run the focused tests and observe missing-action failures.**

Run `node --test "Project_6_游戏_spellatoon/prototype/tests/rules.test.mjs"`. Expected: the new tests fail because the action APIs are not implemented.

- [ ] **Step 3: Implement pure movement and deployment validation.**

Implement `getReachableCells`, `performMove`, and `performDeploy` in `rules.mjs`. Reachability uses one-step orthogonal paths with arbitrary turns, at least one step, and no more than the card value; occupied cells do not block movement. A move requires the active player and unused move action. A deployment requires the active player, unused deploy action, current role cell, empty cell, and a card in hand; it places the card, paints the cell, consumes exactly that card, and returns a new state.

- [ ] **Step 4: Run all rule tests and then wire the browser controls.**

Run `npm run test:spellatoon`; expected: foundation and action tests pass. Add card selection, reachable-cell highlighting, step-by-step path selection, deployment on the role cell, disabled states, and stable invalid-action messages in `input.mjs`, `render.mjs`, and `app.mjs`.

- [ ] **Step 5: Browser-verify the complete action chain.**

Select a card, move through a turning path, verify the role and hand update, select another card, deploy, attempt an invalid deployment, and verify the hand/action state is unchanged. Inspect screenshot, text state, and console errors.

- [ ] **Step 6: Update progress and ask for the checkpoint.**

Record unit/browser results and ask whether to commit with `完成Spellatoon移动与部署模块`; do not push.

## Task 3: Chain, consume, paint, and score resolution

**Files:**

- Modify: `prototype/js/rules.mjs`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/tests/rules.test.mjs`, `prototype/progress.md`

- [ ] **Step 1: Write failing effect tests.**

Create board fixtures with deployed cards and test same-owner equal cards producing `chain`, removing participating endpoints including the new card, keeping unrelated intermediate cards, painting the full path, and scoring `value * path length`. Test different-owner equal cards producing `consume`, removing endpoints and every intermediate card, painting with the deploying player's color, and awarding the deploying player. Add tests for horizontal and vertical effects, multiple candidates, the line-gap boundary, crossing-path union removal, already-painted cells counting, and no recursive trigger.

```js
test("same-owner equal cards chain and score the complete path", () => {
  const state = boardWithCards([
    { row: 2, col: 1, value: 3, ownerId: "p1" },
    { row: 2, col: 3, value: 3, ownerId: "p1" }
  ], { deployingPlayerId: "p1", deployingPosition: { row: 2, col: 2 }, deployingCardValue: 3 });
  const result = performDeploy(state, "p1", findHandCard(state, "p1", 3).id, CONFIG);
  assert.equal(result.event.effects[0].type, "chain");
  assert.equal(result.state.players[0].score, 9);
});

test("different-owner equal cards consume the path with the later player's color", () => {
  const state = boardWithCards([
    { row: 1, col: 0, value: 2, ownerId: "p1" },
    { row: 1, col: 2, value: 2, ownerId: "p2" }
  ], { deployingPlayerId: "p2", deployingPosition: { row: 1, col: 1 }, deployingCardValue: 2 });
  const result = performDeploy(state, "p2", findHandCard(state, "p2", 2).id, CONFIG);
  assert.equal(result.event.effects[0].type, "consume");
  assert.equal(result.state.players[1].score, 6);
});
```

- [ ] **Step 2: Run effect tests and observe the expected failures.**

Run `npm run test:spellatoon`. Expected: effect tests fail because deployment does not yet resolve chain/consume or score.

- [ ] **Step 3: Implement deterministic effect resolution.**

Add `getLineCandidates(state, deployedCell, direction, config)`, `buildEffectPath(startCell, endCell)`, and `resolveDeploymentEffects(state, deployedCell, deployingPlayerId, config)`. Inspect only the new card's row and column; allow intermediate cards and use the configured gap limit. Resolve both directions from the same post-deployment snapshot. Chains remove only participating cards; consumes remove all cards on their paths including endpoints. Union removals, paint every path cell, score each effect independently, and never recursively trigger effects. Return public effect data with type, path, removed ids, paint owner, and score delta.

- [ ] **Step 4: Run the complete unit suite and inspect effect visuals.**

Run `npm run test:spellatoon`; expected: all rule tests pass. Render public cards, path overlays, chain/consume labels, path length, and score delta. Use `CONFIG.motion.effectMs`; reduced motion shows the final state immediately.

- [ ] **Step 5: Browser-verify chain and consume scenarios.**

Run deterministic fixtures for same-color chain, different-color consume, intermediate-card removal, crossing paths, and score updates. Compare screenshot, event log, and `render_game_to_text`; fix the first console error before continuing.

- [ ] **Step 6: Update progress and ask for the checkpoint.**

Record results and ask whether to commit with `完成Spellatoon连锁吞噬与计分模块`; do not push.

## Task 4: Turns, refill, coin toss, and final settlement

**Files:**

- Modify: `prototype/js/rules.mjs`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/tests/rules.test.mjs`, `prototype/progress.md`

- [ ] **Step 1: Write failing turn tests.**

Add tests for deterministic coin toss, two-card refill capped at the hand limit, zero refill when full, reset action flags at turn start, invalid end-turn by the waiting player, both action orders, skipped actions, exact configured completed-turn count per player, higher-score victory, and equal-score draw.

```js
test("refills two cards without exceeding the hand limit", () => {
  const state = stateWithHandSize("p1", CONFIG.cards.handLimit - 1);
  const result = beginTurn(state, "p1", CONFIG);
  assert.equal(result.state.players[0].hand.length, CONFIG.cards.handLimit);
  assert.deepEqual(result.state.players[0].actions, { moved: false, deployed: false });
});

test("finishes only after both players complete the configured turns", () => {
  let state = stateAtTurnLimitMinusOneForBothPlayers();
  state = endTurn(state, state.activePlayerId, CONFIG).state;
  assert.equal(state.phase, "playing");
  state = endTurn(state, state.activePlayerId, CONFIG).state;
  assert.equal(state.phase, "finished");
  assert.ok(["p1", "p2", "draw"].includes(state.result.winnerId));
});
```

- [ ] **Step 2: Run the turn tests and observe missing-transition failures.**

Run `npm run test:spellatoon`. Expected: new tests fail because `beginTurn`, `endTurn`, and `getFinalResult` are not implemented.

- [ ] **Step 3: Implement the turn lifecycle.**

Implement `beginTurn(state, playerId, config)`, `endTurn(state, playerId, config)`, and `getFinalResult(state)`. `beginTurn` draws `CONFIG.cards.drawPerTurn` up to `CONFIG.cards.handLimit` and resets only the active player's action flags. `endTurn` validates the active player, increments that player's completed-turn count, switches to the other player, begins that turn, and changes to `finished` only when both players reach `CONFIG.turns.turnsPerPlayer`. Finished states reject all later actions. `getFinalResult` compares public scores and returns winner, draw flag, and both scores.

- [ ] **Step 4: Run the complete unit suite and connect the turn UI.**

Run `npm run test:spellatoon`; expected: every rule test passes. Render turn progress, action availability, hand count, public scores, coin-toss notice, waiting status, and final result. Disable controls when waiting or already used, while retaining preview access.

- [ ] **Step 5: Browser-verify a forced-settlement match.**

Use the configured deterministic test fixture switch to verify coin toss, capped refill, both action orders, skipped actions, turn switching, exactly ten completed turns for each player, and immediate final settlement. Inspect screenshot, text state, and console output.

- [ ] **Step 6: Update progress and ask for the checkpoint.**

Record the turn/settlement results and ask whether to commit with `完成Spellatoon回合与结算模块`; do not push.

## Task 5: Empty-cell strategy preview

**Files:**

- Create: `prototype/js/input.mjs`
- Modify: `prototype/js/rules.mjs`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/tests/rules.test.mjs`, `prototype/progress.md`

- [ ] **Step 1: Write failing preview tests.**

Test that hover returns only same-row or same-column cards inside `CONFIG.preview.lineRange`, diagonal cards are excluded, only empty in-bounds cells can lock, a locked cell can simulate a hypothetical number from a highlighted card, chain and consume previews contain path/removal/score data, card cells cannot lock, and the real state, hand, score, and actions remain unchanged.

```js
test("returns row and column targets but excludes diagonal cards", () => {
  const state = boardWithCards([
    { row: 2, col: 0, value: 2, ownerId: "p1" },
    { row: 2, col: 5, value: 3, ownerId: "p2" },
    { row: 0, col: 2, value: 4, ownerId: "p1" },
    { row: 5, col: 2, value: 5, ownerId: "p2" },
    { row: 1, col: 1, value: 1, ownerId: "p1" }
  ]);
  const targets = getPreviewTargets(state, { row: 2, col: 2 }, CONFIG);
  assert.equal(targets.length, 4);
  assert.ok(targets.every((target) => target.cell.row === 2 || target.cell.col === 2));
});

test("preview locks only empty cells and never mutates the real state", () => {
  const state = previewStateWithSameValueCards();
  const before = structuredClone(state);
  assert.equal(lockPreviewCell(state, { row: 2, col: 2 }, CONFIG).ok, true);
  assert.equal(lockPreviewCell(state, { row: 2, col: 1 }, CONFIG).ok, false);
  const preview = simulatePreview(state, { row: 2, col: 3 }, CONFIG);
  assert.equal(preview.effects[0].type, "chain");
  assert.equal(preview.scoreDelta, 9);
  assert.deepEqual(state, before);
});
```

- [ ] **Step 2: Run preview tests and observe missing-preview failures.**

Run `npm run test:spellatoon`. Expected: new tests fail because preview target, lock, and simulation helpers are not implemented.

- [ ] **Step 3: Implement read-only preview helpers.**

Add `getPreviewTargets(state, cell, config)`, `lockPreviewCell(previewState, cell, config)`, and `simulatePreview(state, targetCardCell, config)` to `rules.mjs`. Targets are deployed cards on the same row/column within the preview range. Lock succeeds only for an empty in-bounds cell. Simulation copies the public board, inserts a hypothetical card using the target card's value and local player's color, calls the non-mutating effect resolver, and returns effects, paths, removals, paint owner, and predicted score. It never consumes a hand card or action.

- [ ] **Step 4: Run all tests and add the preview interaction.**

Run `npm run test:spellatoon`; expected: all gameplay and preview tests pass. In `input.mjs`, hover cells to show targets, click only empty cells to lock, hover highlighted cards to show a simulated chain/consume result, and reset on pointer exit or a different empty-cell click. Keep preview available while waiting.

- [ ] **Step 5: Browser-verify preview without state mutation.**

Hover an empty cell, confirm row/column targets, lock it, hover a target card, inspect simulated path and score, click a card cell and confirm it does not lock, then compare before/after text state. Repeat during the waiting state and inspect desktop and narrow screenshots.

- [ ] **Step 6: Update progress and ask for the checkpoint.**

Record preview results and ask whether to commit with `完成Spellatoon空格策略预览模块`; do not push.

## Task 6: LAN room, private hand projection, and authoritative synchronization

**Files:**

- Create: `prototype/js/public-state.mjs`, `prototype/server.mjs`, `prototype/tests/public-state.test.mjs`, `prototype/tests/server.test.mjs`
- Modify: `prototype/js/app.mjs`, `prototype/js/render.mjs`, `prototype/index.html`, `prototype/progress.md`

- [ ] **Step 1: Write failing projection and room tests.**

Create a full state with distinct p1 and p2 hands and assert `createPlayerView(fullState, "p1").ownHand` equals p1's hand, p2 has no `hand` field, and p2 card ids/values do not occur anywhere in the p1 JSON. Add room tests for create, second join, third-join rejection, host-only start, wrong-player action rejection, valid action broadcast, p1 SSE containing only p1's hand, and reconnect preserving the room.

```js
const p1View = createPlayerView(fullState, "p1");
assert.deepEqual(p1View.ownHand, fullState.players[0].hand);
assert.equal("hand" in p1View.players.find((p) => p.id === "p2"), false);
assert.equal(JSON.stringify(p1View).includes(fullState.players[1].hand[0].id), false);
```

- [ ] **Step 2: Run projection/server tests and observe missing-module failures.**

Run `node --test "Project_6_游戏_spellatoon/prototype/tests/public-state.test.mjs" "Project_6_游戏_spellatoon/prototype/tests/server.test.mjs"`. Expected: failure because projection helpers and the LAN server do not exist.

- [ ] **Step 3: Implement public/private projections.**

Create `createPublicState(fullState)` and `createPlayerView(fullState, playerId)`. Public state includes phase, board cards/owners, both roles, both scores, completed turns, active player, starter, turn number, last event, result, and connection metadata, but neither hand. A player view adds exactly one `ownHand` for the requesting player. Never serialize full state directly.

- [ ] **Step 4: Implement the authoritative HTTP/SSE server.**

Create `server.mjs` with Node `http`, serving prototype files and these routes:

```text
POST /api/rooms
POST /api/rooms/:roomId/join
POST /api/rooms/:roomId/start
GET  /api/rooms/:roomId/events?playerId=p1
POST /api/rooms/:roomId/action
```

Keep active rooms in memory. The host is the referee; the joiner is p2. Validate actions through `rules.mjs`, project separately for each SSE stream, send structured errors without changing state, keep a room after disconnect, and allow player-token reconnect. Use `CONFIG.network.port` and heartbeat settings.

- [ ] **Step 5: Run server tests until isolation and action routing pass.**

Run the projection/server command from Step 2. Expected: zero failures, including the assertion that opponent card ids and values are absent from every p1 response and SSE payload.

- [ ] **Step 6: Connect lobby and realtime browser client.**

Add create/join/start screens, a shareable LAN URL and room code, SSE subscription, fetch-based move/deploy/end-turn submissions, immediate public updates, waiting console state, preview during waiting, reconnect status, and retry using the player token without clearing the board.

- [ ] **Step 7: Browser-verify two isolated player views.**

Start `node "Project_6_游戏_spellatoon/prototype/server.mjs"`, open two Playwright contexts in one room, create/join/start, verify shared board and turn updates, verify each text state contains only its own hand, submit a move and deployment from one context, verify the other updates without refresh, disconnect one context, reconnect it, and verify the room continues.

- [ ] **Step 8: Update progress and ask for the checkpoint.**

Record server commands, isolation assertions, reconnect result, and the normal UI privacy caveat. Ask whether to commit with `完成Spellatoon局域网联机与私有手牌同步`; do not push.

## Task 7: Full browser acceptance and responsive polish

**Files:**

- Create or modify: `prototype/smoke-test.mjs`
- Modify: `prototype/css/styles.css`, `prototype/index.html`, `prototype/js/render.mjs`, `prototype/js/app.mjs`, `prototype/progress.md`

- [ ] **Step 1: Write the acceptance scenarios before polish changes.**

Cover these scenarios: foundation board and private hand; turning move and invalid boundary move; deployment and occupied-cell rejection; chain, consume, intermediate cards, crossing paths and score; coin toss, two-card refill, waiting, exact turn limits and forced result; empty-cell preview and no mutation; create/join/start, realtime action, private hands and reconnect; desktop and narrow mobile layout with no overlap or clipping. Every scenario resets state, uses short action bursts with intentional pauses, captures screenshots, calls `render_game_to_text`, and fails on new console errors.

- [ ] **Step 2: Run acceptance before visual polish.**

Run `node "Project_6_游戏_spellatoon/prototype/smoke-test.mjs"`. Expected: any failure identifies a real behavior or layout gap and is recorded in `progress.md`; do not hide failures by inflating timeouts.

- [ ] **Step 3: Fix one failing behavior or visual issue at a time.**

Keep fixes scoped to the failing module. Use stable CSS grid dimensions, accessible focus states, clear disabled states, readable player-color contrast, responsive console wrapping, bright geometric visual language, no external art dependency, no marketing hero, no nested cards, no decorative gradient blobs, and no `scrollIntoView`.

- [ ] **Step 4: Re-run unit, server, and browser verification after each fix.**

Run `node --test "Project_6_游戏_spellatoon/prototype/tests/*.test.mjs"` and `node "Project_6_游戏_spellatoon/prototype/smoke-test.mjs"`. Expected: zero test failures, zero browser console errors, matching text state, and clean desktop/mobile screenshots.

- [ ] **Step 5: Perform the final requirement review.**

Check every item in `docs/design.md`: two-device LAN, private hands, board/roles, card values/limits, two-card refill, free action order, turning orthogonal movement, empty-cell deployment, chain/consume distinctions, endpoint/intermediate removal, paint and score formulas, no recursive trigger, ten turns per player, forced settlement, public information, empty-cell preview, and reconnect behavior. Missing requirements must receive code and tests before completion is claimed.

- [ ] **Step 6: Update progress and ask for the final checkpoint.**

Append final command output, screenshot paths, viewport checks, and residual risk. Ask whether to commit with `完成Spellatoon网页原型与双设备验证`; do not push unless explicitly requested.

## Self-review checklist

- [x] Every design requirement maps to Tasks 1-7.
- [x] The shared rule API is declared before use and reused by browser and server.
- [x] Every task has a red test step, green implementation step, verification step, and user-controlled commit checkpoint.
- [x] No placeholder markers or unbounded deferred work remains.
- [x] Gameplay values and feature switches are centralized in `CONFIG`; the design document remains free of new precise tuning values.
- [x] The plan promises normal UI/network projection privacy, not cryptographic invisibility from the host referee process.
