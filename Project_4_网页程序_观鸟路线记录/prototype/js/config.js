window.CONFIG = {
  appName: '观鸟路线记录',
  appVersion: '0.8.0',
  locationSource: 'gps',
  defaultCenter: {
    lat: 31.2304,
    lng: 121.4737,
    label: '默认起点',
  },
  defaultZoom: 16,
  activeProvider: 'tianditu',
  providers: {
    tianditu: {
      name: '天地图',
      token: 'b426c98dce2a97cf4419eb8fc81c249b',
      attribution: '&copy; 天地图',
      errorHint: '地图瓦片加载失败，请检查网络、服务 Key 或切换公共地图源。',
      layers: [
        {
          key: 'tianditu-vector',
          url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={token}',
          subdomains: '01234567',
          maxZoom: 18,
        },
        {
          key: 'tianditu-label',
          url: 'https://t{s}.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk={token}',
          subdomains: '01234567',
          maxZoom: 18,
        },
      ],
    },
    osm: {
      name: 'OpenStreetMap',
      attribution: '&copy; OpenStreetMap contributors',
      errorHint: '地图瓦片加载较慢或失败，可在配置中切换瓦片源。',
      layers: [
        {
          key: 'osm-standard',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          maxZoom: 19,
        },
      ],
    },
  },
  storageKey: 'bird-route-current-session',
  historyStorageKey: 'bird-route-history',
  shareImport: {
    serviceEnabled: false,
    duplicateStrategy: 'openExisting',
    sharedLocationScope: 'fullRoute',
    pendingServiceLabel: '服务器链接服务待接入',
  },
  fuzzyMatch: {
    uncertainSpeciesName: '未确定鸟种',
    featureGroups: [
      {
        key: 'size',
        label: '体型',
        multiple: false,
        options: [
          { value: 'tiny', label: '很小' },
          { value: 'small', label: '小型' },
          { value: 'medium', label: '中型' },
          { value: 'large', label: '大型' },
          { value: 'veryLarge', label: '很大' },
        ],
      },
      {
        key: 'colors',
        label: '主色',
        multiple: true,
        options: [
          { value: 'white', label: '白' },
          { value: 'black', label: '黑' },
          { value: 'gray', label: '灰' },
          { value: 'brown', label: '褐' },
          { value: 'yellow', label: '黄' },
          { value: 'green', label: '绿' },
          { value: 'blue', label: '蓝' },
          { value: 'red', label: '红' },
        ],
      },
      {
        key: 'behaviors',
        label: '行为',
        multiple: true,
        options: [
          { value: 'swimming', label: '游水' },
          { value: 'wading', label: '涉水' },
          { value: 'flying', label: '飞行' },
          { value: 'soaring', label: '盘旋' },
          { value: 'perching', label: '停栖' },
          { value: 'foragingGround', label: '地面觅食' },
          { value: 'diving', label: '潜水' },
          { value: 'calling', label: '鸣叫' },
        ],
      },
      {
        key: 'habitats',
        label: '栖息地',
        multiple: true,
        options: [
          { value: 'wetland', label: '湿地/湖泊' },
          { value: 'river', label: '河流' },
          { value: 'forest', label: '林地' },
          { value: 'shrub', label: '灌丛' },
          { value: 'grassland', label: '草地' },
          { value: 'farmland', label: '农田' },
          { value: 'urban', label: '城市' },
          { value: 'coast', label: '海岸' },
        ],
      },
    ],
    // 候选打分权重（可调）：各维度命中一项加多少分。
    weights: {
      size: 3,
      color: 1,
      behavior: 2,
      habitat: 2,
    },
    // 候选最多展示条数。
    maxCandidates: 5,
  },
  mapInteraction: {
    pickingHint: '点击地图确认起点',
    recordingHint: '开发模式：点击地图模拟行走轨迹',
    gpsPendingHint: '正在获取当前位置，请允许浏览器定位权限。',
  },
  toast: {
    durationMs: 3000,
  },
  gps: {
    enableHighAccuracy: true,
    maximumAgeMs: 0,
    timeoutMs: 10000,
  },
  birdPoint: {
    clusterDistancePx: 36,
  },
};
