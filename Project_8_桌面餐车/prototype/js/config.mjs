export const CONFIG = Object.freeze({
  timer: Object.freeze({
    workSeconds: 12,
    restSeconds: 6,
    tickMilliseconds: 1000,
  }),
  activities: Object.freeze([
    Object.freeze({ id: 'operate', label: '经营', regionIds: Object.freeze(['market']) }),
    Object.freeze({ id: 'travel', label: '旅行', regionIds: Object.freeze(['forest', 'coast']) }),
  ]),
  regions: Object.freeze([
    Object.freeze({ id: 'market', label: '晨市' }),
    Object.freeze({ id: 'forest', label: '林道' }),
    Object.freeze({ id: 'coast', label: '海湾' }),
  ]),
});
