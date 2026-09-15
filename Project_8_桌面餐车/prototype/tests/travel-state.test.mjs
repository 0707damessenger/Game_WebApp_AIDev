import assert from 'node:assert/strict';
import test from 'node:test';

import { CONFIG } from '../js/config.mjs';
import {
  advanceTravelSecond,
  createInitialTravelState,
  openChest,
} from '../js/travel-state.mjs';

function travelPlan(regionId) {
  return { activity: 'travel', regionId };
}

function advance(state, plan, seconds) {
  let next = state;
  for (let second = 0; second < seconds; second += 1) {
    next = advanceTravelSecond(next, plan, CONFIG).state;
  }
  return next;
}

test('only travel collects the active region ingredients', () => {
  const initial = createInitialTravelState(CONFIG);
  const inactive = advanceTravelSecond(initial, { activity: 'operate', regionId: 'market' }, CONFIG).state;
  assert.deepEqual(inactive, initial);

  const forest = advance(initial, travelPlan('forest'), CONFIG.travel.harvestIntervalSeconds);
  assert.equal(forest.ingredients.mushroom, 1);
  assert.equal(forest.ingredients.seaweed, 0);

  const coast = advance(initial, travelPlan('coast'), CONFIG.travel.harvestIntervalSeconds);
  assert.equal(coast.ingredients.seaweed, 1);
  assert.equal(coast.ingredients.mushroom, 0);
});

test('encounters automatically fill the chest slots and full slots discard later encounters', () => {
  let state = createInitialTravelState(CONFIG);
  const secondsPerChest = CONFIG.travel.harvestIntervalSeconds * CONFIG.travel.chestEveryHarvests;

  state = advance(state, travelPlan('forest'), secondsPerChest * CONFIG.travel.chestCapacity);
  assert.equal(state.chests.length, CONFIG.travel.chestCapacity);
  assert.equal(state.missedChests, 0);

  state = advance(state, travelPlan('forest'), secondsPerChest);
  assert.equal(state.chests.length, CONFIG.travel.chestCapacity);
  assert.equal(state.missedChests, 1);
});

test('opening a collected chest frees a slot and adds its visible ingredient reward', () => {
  const secondsPerChest = CONFIG.travel.harvestIntervalSeconds * CONFIG.travel.chestEveryHarvests;
  const collected = advance(createInitialTravelState(CONFIG), travelPlan('coast'), secondsPerChest);
  const chest = collected.chests[0];
  const opened = openChest(collected, chest.id, CONFIG);

  assert.equal(opened.ok, true);
  assert.equal(opened.state.chests.length, 0);
  assert.equal(opened.state.ingredients[chest.reward.ingredientId], chest.reward.amount);

  const afterNewEncounter = advance(opened.state, travelPlan('coast'), secondsPerChest);
  assert.equal(afterNewEncounter.chests.length, 1);
});
