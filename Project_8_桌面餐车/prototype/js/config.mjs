export const CONFIG = Object.freeze({
  timer: Object.freeze({
    workSeconds: 12,
    restSeconds: 6,
    tickMilliseconds: 1000,
  }),
  ui: Object.freeze({
    noticeMilliseconds: 2600,
  }),
  travel: Object.freeze({
    harvestIntervalSeconds: 2,
    chestEveryHarvests: 2,
    chestCapacity: 3,
    chestRewards: Object.freeze([
      Object.freeze({ ingredientId: 'mushroom', amount: 2 }),
      Object.freeze({ ingredientId: 'seaweed', amount: 2 }),
    ]),
  }),
  ingredients: Object.freeze([
    Object.freeze({ id: 'mushroom', label: '蘑菇', color: '#d76661' }),
    Object.freeze({ id: 'herb', label: '香草', color: '#79ad68' }),
    Object.freeze({ id: 'seaweed', label: '海藻', color: '#4faaa0' }),
  ]),
  activities: Object.freeze([
    Object.freeze({ id: 'operate', label: '经营', regionIds: Object.freeze(['market']) }),
    Object.freeze({ id: 'travel', label: '旅行', regionIds: Object.freeze(['forest', 'coast']) }),
  ]),
  regions: Object.freeze([
    Object.freeze({ id: 'market', label: '晨市' }),
    Object.freeze({ id: 'forest', label: '林道', ingredientIds: Object.freeze(['mushroom', 'herb']) }),
    Object.freeze({ id: 'coast', label: '海湾', ingredientIds: Object.freeze(['seaweed']) }),
  ]),
});
