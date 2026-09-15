# Spellatoon 8x8 Board and Preview Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Spellatoon prototype board through the single configuration source and make preview cards visibly distinguishable, especially when they can produce a chain or consume effect.

**Architecture:** Keep board dimensions in `CONFIG.board.size`; rules already derive board creation and bounds from that value. Keep preview target calculation read-only, and fix the presentation layer so ownership styling cannot overwrite preview target styling. Add browser contract coverage for the configured board size and computed preview highlight style.

**Tech Stack:** Native HTML/CSS/ES modules, Node test runner, Playwright browser contracts.

---

### Task 1: Update the design contract and failing browser assertions

**Files:**
- Modify: `Project_6_游戏_spellatoon/docs/design.md`
- Modify: `Project_6_游戏_spellatoon/prototype/tests/ui-contract.test.mjs`

- [x] **Step 1: Record the confirmed design change**

  Document that the board size remains configuration-owned and that preview cards capable of producing an effect receive stronger highlighting.

- [x] **Step 2: Add failing assertions**

  Assert that the rendered board count equals `CONFIG.board.size ** 2`, and after hovering a preview target assert its computed `borderStyle` is `dashed`.

- [ ] **Step 3: Run the focused UI test and verify the expected failure**

  Run `npm run test:spellatoon -- --test-name-pattern="preview|board"` from the workspace root. The new assertions must fail before the production changes because the configured board is still 6×6 and `.owned-cell` overrides the preview border style.

### Task 2: Apply the minimal configuration and render fix

**Files:**
- Modify: `Project_6_游戏_spellatoon/prototype/js/config.mjs`
- Modify: `Project_6_游戏_spellatoon/prototype/index.html`
- Modify: `Project_6_游戏_spellatoon/prototype/css/styles.css`

- [ ] **Step 1: Set the board configuration to the confirmed size**

  Change only `CONFIG.board.size` from `6` to `8`; keep movement, preview range, and all game rules unchanged.

- [ ] **Step 2: Remove the stale dimension label and set the CSS fallback**

  Use the generic accessible label `公共棋盘` in HTML and change the CSS `--board-size` fallback to `8`; runtime rendering continues to set the value from `CONFIG`.

- [ ] **Step 3: Give preview targets priority over ownership paint**

  Add a later, more specific `.cell.owned-cell.preview-target` rule that restores the dashed purple border and preview background, and a stronger `.cell.owned-cell.preview-effect-cell` rule for an active simulated effect.

### Task 3: Update fixtures and verify the complete UI loop

**Files:**
- Modify: `Project_6_游戏_spellatoon/prototype/tests/ui-contract.test.mjs`
- Modify: `Project_6_游戏_spellatoon/prototype/progress.md`

- [ ] **Step 1: Replace fixed 6×6 coordinate assumptions**

  Use `CONFIG.board.size - 1` for the opponent corner and `CONFIG.board.size ** 2` for board-count assertions.

- [ ] **Step 2: Run all Spellatoon tests**

  Run `npm run test:spellatoon` and require every test to pass with no console errors.

- [ ] **Step 3: Verify desktop and mobile screenshots**

  Use the existing browser test loop to capture the 8×8 board, lock an empty preview cell, hover a same-line card, and verify that the card highlight and simulated path are visible at desktop and narrow mobile dimensions.

- [ ] **Step 4: Record the verification result**

  Append the implemented changes, test count, and any remaining notes to `prototype/progress.md`.
