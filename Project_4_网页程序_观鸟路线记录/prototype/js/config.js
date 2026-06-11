window.CONFIG = {
  appName: '观鸟路线记录',
  locationSource: 'simulated',
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
      token: 'TIANDITU_WEB_KEY_PLACEHOLDER',
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
  mapInteraction: {
    pickingHint: '点击地图确认起点',
    recordingHint: '开发模式：点击地图模拟行走轨迹',
    gpsPendingHint: '正在获取当前位置，请允许浏览器定位权限。',
    gpsRecordingHint: '真实 GPS 模式：正在随定位变化记录轨迹。',
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
