window.CONFIG = {
  appName: '观鸟路线记录',
  locationSource: 'simulated',
  defaultCenter: {
    lat: 31.2304,
    lng: 121.4737,
    label: '默认起点',
  },
  defaultZoom: 16,
  tileLayer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    errorHint: '地图瓦片加载较慢或失败，可在配置中切换瓦片源。',
  },
  storageKey: 'bird-route-current-session',
  historyStorageKey: 'bird-route-history',
  mapInteraction: {
    pickingHint: '点击地图确认起点',
    recordingHint: '开发模式：点击地图模拟行走轨迹',
  },
  birdPoint: {
    clusterDistancePx: 36,
  },
};
