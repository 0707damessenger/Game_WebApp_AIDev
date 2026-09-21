function ingredientInventory(config) {
  return Object.fromEntries(config.ingredients.map((ingredient) => [ingredient.id, 0]));
}

function getRegion(regionId, config) {
  return config.regions.find((region) => region.id === regionId);
}

function addIngredient(ingredients, ingredientId, amount) {
  return {
    ...ingredients,
    [ingredientId]: (ingredients[ingredientId] || 0) + amount,
  };
}

export function createInitialTravelState(config) {
  return {
    ingredients: ingredientInventory(config),
    chests: [],
    roadItems: [],
    secondsSinceHarvest: 0,
    harvestCount: 0,
    harvestsByRegion: {},
    chestEncounterCount: 0,
    nextChestId: 1,
    nextRoadItemId: 1,
    missedChests: 0,
  };
}

function advanceRoadItems(state, config) {
  let ingredients = state.ingredients;
  let chests = state.chests;
  let missedChests = state.missedChests;
  const settledIds = new Set();
  const roadItems = state.roadItems.map((item) => {
    const nextElapsed = item.elapsedSeconds + 1;
    if (item.phase === 'approaching') {
      if (nextElapsed >= config.travel.roadItemApproachSeconds) {
        return { ...item, phase: 'collecting', elapsedSeconds: 0 };
      }
      return { ...item, elapsedSeconds: nextElapsed };
    }

    if (nextElapsed < config.travel.roadItemCollectSeconds) {
      return { ...item, elapsedSeconds: nextElapsed };
    }

    settledIds.add(item.id);
    if (item.type === 'ingredient') {
      ingredients = addIngredient(ingredients, item.ingredientId, 1);
    } else if (chests.length >= config.travel.chestCapacity) {
      missedChests += 1;
    } else {
      chests = [...chests, { id: item.chestId, reward: { ...item.reward } }];
    }
    return item;
  }).filter((item) => !settledIds.has(item.id));

  return { ingredients, chests, missedChests, roadItems };
}

export function advanceTravelSecond(state, plan, config) {
  if (plan?.activity !== 'travel') return { ok: true, state };

  const region = getRegion(plan.regionId, config);
  if (!region?.ingredientIds?.length) return { ok: true, state };

  const progressed = advanceRoadItems(state, config);
  const secondsSinceHarvest = state.secondsSinceHarvest + 1;
  if (secondsSinceHarvest < config.travel.harvestIntervalSeconds) {
    return { ok: true, state: { ...state, ...progressed, secondsSinceHarvest } };
  }

  const regionalHarvests = state.harvestsByRegion[region.id] || 0;
  const ingredientId = region.ingredientIds[regionalHarvests % region.ingredientIds.length];
  const harvestCount = state.harvestCount + 1;
  const isChest = harvestCount % config.travel.chestEveryHarvests === 0;
  const chestEncounterCount = isChest ? state.chestEncounterCount + 1 : state.chestEncounterCount;
  const reward = isChest
    ? config.travel.chestRewards[(chestEncounterCount - 1) % config.travel.chestRewards.length]
    : null;
  const roadItemsToAdd = [{
    id: state.nextRoadItemId,
    type: 'ingredient',
    phase: 'approaching',
    elapsedSeconds: 0,
    ingredientId,
  }];
  if (isChest) {
    roadItemsToAdd.push({
      id: state.nextRoadItemId + 1,
      type: 'chest',
      phase: 'approaching',
      elapsedSeconds: 0,
      chestId: state.nextChestId,
      reward: { ...reward },
    });
  }
  const nextState = {
    ...state,
    ingredients: progressed.ingredients,
    chests: progressed.chests,
    roadItems: [...progressed.roadItems, ...roadItemsToAdd],
    secondsSinceHarvest: 0,
    harvestCount,
    harvestsByRegion: {
      ...state.harvestsByRegion,
      [region.id]: regionalHarvests + 1,
    },
    chestEncounterCount,
    nextChestId: isChest ? state.nextChestId + 1 : state.nextChestId,
    nextRoadItemId: state.nextRoadItemId + roadItemsToAdd.length,
    missedChests: progressed.missedChests,
  };
  return { ok: true, state: nextState };
}

export function openChest(state, chestId) {
  const chest = state.chests.find((item) => item.id === chestId);
  if (!chest) return { ok: false, reason: 'chest-not-found' };

  return {
    ok: true,
    state: {
      ...state,
      ingredients: addIngredient(state.ingredients, chest.reward.ingredientId, chest.reward.amount),
      chests: state.chests.filter((item) => item.id !== chestId),
    },
    reward: { ...chest.reward },
  };
}
