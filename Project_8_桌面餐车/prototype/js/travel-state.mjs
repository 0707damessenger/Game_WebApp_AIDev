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
    secondsSinceHarvest: 0,
    harvestCount: 0,
    harvestsByRegion: {},
    chestEncounterCount: 0,
    nextChestId: 1,
    missedChests: 0,
  };
}

export function advanceTravelSecond(state, plan, config) {
  if (plan?.activity !== 'travel') return { ok: true, state };

  const region = getRegion(plan.regionId, config);
  if (!region?.ingredientIds?.length) return { ok: true, state };

  const secondsSinceHarvest = state.secondsSinceHarvest + 1;
  if (secondsSinceHarvest < config.travel.harvestIntervalSeconds) {
    return { ok: true, state: { ...state, secondsSinceHarvest } };
  }

  const regionalHarvests = state.harvestsByRegion[region.id] || 0;
  const ingredientId = region.ingredientIds[regionalHarvests % region.ingredientIds.length];
  const harvestCount = state.harvestCount + 1;
  const nextState = {
    ...state,
    ingredients: addIngredient(state.ingredients, ingredientId, 1),
    secondsSinceHarvest: 0,
    harvestCount,
    harvestsByRegion: {
      ...state.harvestsByRegion,
      [region.id]: regionalHarvests + 1,
    },
  };

  if (harvestCount % config.travel.chestEveryHarvests !== 0) return { ok: true, state: nextState };

  const chestEncounterCount = state.chestEncounterCount + 1;
  if (state.chests.length >= config.travel.chestCapacity) {
    return {
      ok: true,
      state: {
        ...nextState,
        chestEncounterCount,
        missedChests: state.missedChests + 1,
      },
    };
  }

  const reward = config.travel.chestRewards[(chestEncounterCount - 1) % config.travel.chestRewards.length];
  return {
    ok: true,
    state: {
      ...nextState,
      chestEncounterCount,
      nextChestId: state.nextChestId + 1,
      chests: [...state.chests, { id: state.nextChestId, reward: { ...reward } }],
    },
  };
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
