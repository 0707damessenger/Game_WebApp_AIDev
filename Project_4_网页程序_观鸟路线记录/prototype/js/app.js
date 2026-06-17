(function attachApp() {
  const config = window.CONFIG;
  const stateTools = window.BirdRouteState;
  const fuzzyTools = window.BirdFuzzyMatch;
  let history = loadHistory();
  let session = loadPersistedSession() || stateTools.createSession();
  let map = null;
  let routeLayer = null;
  let startMarker = null;
  let currentMarker = null;
  let fallbackMode = false;
  let stageFallbackClickEnabled = false;
  let showBirdNames = false;
  let fallbackScale = 1;
  let birdDraft = createBirdDraft();
  let highlightedBirdRecordId = null;
  let selectedHistoryRecordId = null;
  let historyEditMode = false;
  let historyDraft = null;
  let activeView = 'main';
  let historyListMode = 'all';
  let gpsWatchId = null;
  let locationHintOverride = '';
  let tileErrorHint = '';
  let pendingDeleteHistoryId = null;
  let birdPointGroups = [];
  let idleCurrentPoint = null;
  let suppressRouteHistory = false;
  let toastTimerId = null;
  let headingMarker = null;
  let deviceHeading = null;
  let headingListening = false;

  const elements = {
    mapStage: document.querySelector('#mapStage'),
    mapFallback: document.querySelector('#mapFallback'),
    fallbackRouteLayer: document.querySelector('#fallbackRouteLayer'),
    testRouteLayer: document.querySelector('#testRouteLayer'),
    birdPointLayer: document.querySelector('#birdPointLayer'),
    mapTools: document.querySelector('.map-tools'),
    currentLocationButton: document.querySelector('#currentLocationButton'),
    birdNameToggle: document.querySelector('#birdNameToggle'),
    startPanel: document.querySelector('#startPanel'),
    startButton: document.querySelector('#startButton'),
    finishButton: document.querySelector('#finishButton'),
    addBirdButton: document.querySelector('#addBirdButton'),
    hintStrip: document.querySelector('#hintStrip'),
    toast: document.querySelector('#toast'),
    sessionState: document.querySelector('#sessionState'),
    sessionDistance: document.querySelector('#sessionDistance'),
    sessionBirds: document.querySelector('#sessionBirds'),
    profileButton: document.querySelector('#profileButton'),
    finishDialog: document.querySelector('#finishDialog'),
    resultPanel: document.querySelector('#resultPanel'),
    resultTitle: document.querySelector('#resultTitle'),
    resultMeta: document.querySelector('#resultMeta'),
    resultSummary: document.querySelector('#resultSummary'),
    resultDuration: document.querySelector('#resultDuration'),
    resultDistance: document.querySelector('#resultDistance'),
    resultSpecies: document.querySelector('#resultSpecies'),
    resultUncertain: document.querySelector('#resultUncertain'),
    resultListCount: document.querySelector('#resultListCount'),
    resultBirdList: document.querySelector('#resultBirdList'),
    historyEditBar: document.querySelector('#historyEditBar'),
    historyEditButton: document.querySelector('#historyEditButton'),
    historySaveButton: document.querySelector('#historySaveButton'),
    historyCancelButton: document.querySelector('#historyCancelButton'),
    shareButton: document.querySelector('#shareButton'),
    shareDialog: document.querySelector('#shareDialog'),
    shareCloseButton: document.querySelector('#shareCloseButton'),
    shareRecordSummary: document.querySelector('#shareRecordSummary'),
    shareServiceStatus: document.querySelector('#shareServiceStatus'),
    copyShareLinkButton: document.querySelector('#copyShareLinkButton'),
    profilePanel: document.querySelector('#profilePanel'),
    historyEntryButton: document.querySelector('#historyEntryButton'),
    favoritesEntryButton: document.querySelector('#favoritesEntryButton'),
    importEntryButton: document.querySelector('#importEntryButton'),
    importDialog: document.querySelector('#importDialog'),
    importCloseButton: document.querySelector('#importCloseButton'),
    importUrlInput: document.querySelector('#importUrlInput'),
    importPreviewButton: document.querySelector('#importPreviewButton'),
    importPreview: document.querySelector('#importPreview'),
    importServiceStatus: document.querySelector('#importServiceStatus'),
    historyPanel: document.querySelector('#historyPanel'),
    historyPanelKicker: document.querySelector('#historyPanelKicker'),
    historyListTitle: document.querySelector('#historyListTitle'),
    historyListDescription: document.querySelector('#historyListDescription'),
    historyCount: document.querySelector('#historyCount'),
    historyEmpty: document.querySelector('#historyEmpty'),
    historyList: document.querySelector('#historyList'),
    favoriteResultButton: document.querySelector('#favoriteResultButton'),
    birdDialog: document.querySelector('#birdDialog'),
    birdDialogTitle: document.querySelector('#birdDialogTitle'),
    birdCloseButton: document.querySelector('#birdCloseButton'),
    birdSearchModeButton: document.querySelector('#birdSearchModeButton'),
    birdFuzzyModeButton: document.querySelector('#birdFuzzyModeButton'),
    birdSearchPanel: document.querySelector('#birdSearchPanel'),
    birdSearchInput: document.querySelector('#birdSearchInput'),
    birdResults: document.querySelector('#birdResults'),
    birdFuzzyPanel: document.querySelector('#birdFuzzyPanel'),
    birdFuzzyContext: document.querySelector('#birdFuzzyContext'),
    birdFuzzyGroups: document.querySelector('#birdFuzzyGroups'),
    birdFuzzyCandidates: document.querySelector('#birdFuzzyCandidates'),
    birdSelectedInfo: document.querySelector('#birdSelectedInfo'),
    birdCountMinus: document.querySelector('#birdCountMinus'),
    birdCountPlus: document.querySelector('#birdCountPlus'),
    birdCountValue: document.querySelector('#birdCountValue'),
    birdNoteInput: document.querySelector('#birdNoteInput'),
    birdSensitiveToggle: document.querySelector('#birdSensitiveToggle'),
    birdSensitiveState: document.querySelector('#birdSensitiveState'),
    birdSensitiveHint: document.querySelector('#birdSensitiveHint'),
    birdSubmitButton: document.querySelector('#birdSubmitButton'),
    birdDeleteButton: document.querySelector('#birdDeleteButton'),
    deleteHistoryDialog: document.querySelector('#deleteHistoryDialog'),
    birdPointDialog: document.querySelector('#birdPointDialog'),
    birdPointCloseButton: document.querySelector('#birdPointCloseButton'),
    birdPointList: document.querySelector('#birdPointList'),
    tagToggles: Array.from(document.querySelectorAll('.tag-toggle')),
  };

  init();

  function init() {
    migrateFinishedSessionIntoHistory();
    initMap();
    bindEvents();
    render();
    primeIdleCurrentLocation();
    // 无需显式授权的平台（Android / 桌面）可在初始化时直接监听方向；
    // iOS 需用户手势授权，留待「开始记录 / 定位」按钮触发。
    const orientationEvent = window.DeviceOrientationEvent;
    if (orientationEvent && typeof orientationEvent.requestPermission !== 'function') {
      attachOrientationListeners();
    }
  }

  function initMap() {
    if (!window.L) {
      fallbackMode = true;
      elements.mapFallback.hidden = false;
      enableStageFallbackClick();
      elements.hintStrip.textContent = '流程测试模式：点击背景选择起点。';
      elements.hintStrip.hidden = false;
      return;
    }

    const defaultPoint = [config.defaultCenter.lat, config.defaultCenter.lng];
    map = L.map('map', {
      zoomControl: false,
      attributionControl: true,
    }).setView(defaultPoint, config.defaultZoom);

    const tileProvider = getActiveTileProvider();

    tileProvider.layers.forEach((layerConfig) => {
      const tileLayer = L.tileLayer(createTileLayerUrl(layerConfig, tileProvider), {
        attribution: layerConfig.attribution || tileProvider.attribution,
        maxZoom: layerConfig.maxZoom || tileProvider.maxZoom || 19,
        subdomains: layerConfig.subdomains || tileProvider.subdomains,
      });

      tileLayer.on('tileerror', () => {
        // 瓦片加载失败时地图仍可交互（灰底），点选、缩放、落点投影都走真实地图坐标，
        // 不再切到伪坐标兜底，只提示底图缺失。
        tileErrorHint = tileProvider.errorHint;
        render();
      });

      tileLayer.addTo(map);
    });

    routeLayer = L.polyline([], {
      className: 'route-line',
      color: '#246b4b',
      weight: 5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  }

  function getActiveTileProvider() {
    const providers = config.providers || {};
    const provider = providers[config.activeProvider] || providers.osm;

    if (!provider || !Array.isArray(provider.layers) || provider.layers.length === 0) {
      return {
        attribution: '',
        errorHint: '地图瓦片配置不可用。',
        layers: [],
      };
    }

    return provider;
  }

  function createTileLayerUrl(layerConfig, provider) {
    return layerConfig.url.replace(/\{token\}/g, encodeURIComponent(provider.token || ''));
  }

  function bindEvents() {
    elements.startButton.addEventListener('click', () => {
      ensureHeadingTracking();
      activeView = 'main';
      selectedHistoryRecordId = null;
      locationHintOverride = '';
      session = stateTools.beginStartSelection(session);
      const point = config.defaultCenter;
      if (map) {
        map.setView([point.lat, point.lng], config.defaultZoom);
      }
      if (config.locationSource === 'gps') {
        startGpsTracking();
      }
      render();
    });

    elements.finishButton.addEventListener('click', () => {
      if (elements.finishDialog.showModal) {
        elements.finishDialog.showModal();
      }
    });

    elements.finishDialog.addEventListener('close', () => {
      if (elements.finishDialog.returnValue === 'save') {
        stopGpsTracking();
        session = stateTools.finishSession(session);
        highlightedBirdRecordId = null;
        locationHintOverride = '';
        const savedRecord = addFinishedSessionToHistory(session);
        if (savedRecord) {
          selectedHistoryRecordId = savedRecord.id;
          activeView = 'currentResult';
          pushRouteHistory();
        }
        persistSession(session);
      }

      if (elements.finishDialog.returnValue === 'abort') {
        stopGpsTracking();
        session = stateTools.abortSession(session);
        highlightedBirdRecordId = null;
        selectedHistoryRecordId = null;
        activeView = 'main';
        locationHintOverride = '';
        clearPersistedSession();
      }

      render();
    });

    elements.historyEditButton.addEventListener('click', () => {
      enterHistoryEditMode();
    });

    elements.historySaveButton.addEventListener('click', () => {
      saveHistoryEdits();
    });

    elements.historyCancelButton.addEventListener('click', () => {
      cancelHistoryEdits();
    });

    elements.deleteHistoryDialog.addEventListener('close', () => {
      const recordId = pendingDeleteHistoryId;
      pendingDeleteHistoryId = null;

      if (elements.deleteHistoryDialog.returnValue !== 'delete' || !recordId) {
        return;
      }

      history = stateTools.deleteHistoryRecord(history, recordId);
      persistHistory(history);
      render();
    });

    elements.favoriteResultButton.addEventListener('click', () => {
      toggleFavoriteForRecord(selectedHistoryRecordId);
    });

    elements.shareButton.addEventListener('click', () => {
      openShareDialog();
    });

    elements.shareCloseButton.addEventListener('click', () => {
      elements.shareDialog.close();
    });

    elements.profileButton.addEventListener('click', () => {
      activeView = 'profile';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      pushRouteHistory();
      render();
    });

    elements.historyEntryButton.addEventListener('click', () => {
      activeView = 'historyList';
      historyListMode = 'all';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      pushRouteHistory();
      render();
    });

    elements.favoritesEntryButton.addEventListener('click', () => {
      activeView = 'historyList';
      historyListMode = 'favorites';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      pushRouteHistory();
      render();
    });

    elements.importEntryButton.addEventListener('click', () => {
      openImportDialog();
    });

    elements.importCloseButton.addEventListener('click', () => {
      elements.importDialog.close();
    });

    elements.importPreviewButton.addEventListener('click', () => {
      previewImportLink();
    });

    elements.addBirdButton.addEventListener('click', () => {
      if (canUseSimulatedFallbackStart()) {
        handleMapClick(config.defaultCenter);
        return;
      }

      if (session.state === stateTools.STATES.RECORDING) {
        openBirdDialog();
      }
    });

    elements.birdCloseButton.addEventListener('click', () => {
      elements.birdDialog.close();
    });

    elements.birdSearchModeButton.addEventListener('click', () => {
      setBirdDraftMode('search');
    });

    elements.birdFuzzyModeButton.addEventListener('click', () => {
      setBirdDraftMode('fuzzy');
    });

    elements.birdSearchInput.addEventListener('input', () => {
      renderBirdResults(elements.birdSearchInput.value);
    });

    elements.birdCountMinus.addEventListener('click', () => {
      birdDraft.count = Math.max(1, birdDraft.count - 1);
      renderBirdDraft();
    });

    elements.birdCountPlus.addEventListener('click', () => {
      birdDraft.count += 1;
      renderBirdDraft();
    });

    elements.tagToggles.forEach((button) => {
      button.addEventListener('click', () => {
        const tag = button.dataset.tag;
        if (birdDraft.tags.includes(tag)) {
          birdDraft.tags = birdDraft.tags.filter((item) => item !== tag);
        } else {
          birdDraft.tags = [...birdDraft.tags, tag];
        }
        renderBirdDraft();
      });
    });

    elements.birdSensitiveToggle.addEventListener('click', () => {
      birdDraft.isSensitive = !birdDraft.isSensitive;
      renderBirdDraft();
    });

    elements.birdSubmitButton.addEventListener('click', () => {
      submitBirdRecord();
    });

    elements.birdDeleteButton.addEventListener('click', () => {
      deleteSelectedBirdRecord();
    });

    elements.birdPointCloseButton.addEventListener('click', () => {
      elements.birdPointDialog.close();
    });

    elements.birdNameToggle.addEventListener('click', () => {
      showBirdNames = !showBirdNames;
      render();
    });

    elements.currentLocationButton.addEventListener('click', () => {
      ensureHeadingTracking();
      centerMapOnCurrentLocation();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (closeOpenDialog()) {
        return;
      }

      goBack();
    });

    window.addEventListener('popstate', () => {
      suppressRouteHistory = true;
      goBack();
      suppressRouteHistory = false;
    });

    window.addEventListener('resize', syncIdleToolsPosition);

    if (map) {
      map.on('click', (event) => {
        handleMapClick({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        });
      });

      // 平移/缩放过程中只移动已有落点（不重建 DOM），让落点实时跟随地图。
      map.on('move zoom', () => {
        repositionBirdPointOverlay();
      });

      // 平移/缩放结束后重建一次：缩放可能改变近点聚合，需要重新分组。
      map.on('moveend zoomend', () => {
        renderBirdPointOverlay();
      });
    }

  }

  function handleMapClick(point) {
    if (session.state === stateTools.STATES.PICKING_START) {
      if (config.locationSource === 'gps') {
        locationHintOverride = config.mapInteraction.gpsPendingHint;
        render();
        return;
      }

      session = stateTools.confirmStartPoint(session, point);
      persistSession(session);
      render();
      return;
    }

    if (session.state === stateTools.STATES.RECORDING && config.locationSource === 'simulated') {
      session = stateTools.addTrackPoint(session, point);
      persistSession(session);
      render();
    }
  }

  function startGpsTracking() {
    stopGpsTracking();
    locationHintOverride = config.mapInteraction.gpsPendingHint;

    if (window.isSecureContext === false) {
      showGpsError('无法获取定位：手机浏览器只允许 HTTPS 或 localhost 页面申请定位。请改用 HTTPS 预览地址后重试。');
      return;
    }

    if (!navigator.geolocation) {
      showGpsError('无法获取定位：当前浏览器不支持 GPS。');
      return;
    }

    gpsWatchId = navigator.geolocation.watchPosition(handleGpsPosition, handleGpsError, {
      enableHighAccuracy: config.gps.enableHighAccuracy,
      maximumAge: config.gps.maximumAgeMs,
      timeout: config.gps.timeoutMs,
    });
  }

  function stopGpsTracking() {
    if (gpsWatchId === null || !navigator.geolocation) {
      gpsWatchId = null;
      return;
    }

    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  function handleGpsPosition(position) {
    const point = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      label: '当前位置',
      timestamp: new Date(position.timestamp || Date.now()).toISOString(),
    };

    idleCurrentPoint = point;
    locationHintOverride = '';

    if (session.state === stateTools.STATES.PICKING_START) {
      session = stateTools.confirmStartPoint(session, point);
      if (map) {
        map.setView([point.lat, point.lng], config.defaultZoom);
      }
      persistSession(session);
      render();
      return;
    }

    if (session.state === stateTools.STATES.RECORDING && config.locationSource === 'gps') {
      session = stateTools.addTrackPoint(session, point);
      persistSession(session);
      render();
    }
  }

  function handleGpsError(error) {
    const message = error && error.code === 1
      ? '无法获取定位：定位权限被拒绝，请允许浏览器定位权限后重试。'
      : '无法获取定位：请检查定位服务或稍后重试。';
    showGpsError(message);
  }

  function showGpsError(message) {
    stopGpsTracking();
    showLocationHint(message);
  }

  function showLocationHint(message) {
    locationHintOverride = message;
    render();
  }

  // 即时反馈浮层：显示后数秒自动消失，避免常驻遮挡主操作模块。
  function showToast(message) {
    if (!message) {
      return;
    }
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    if (toastTimerId) {
      clearTimeout(toastTimerId);
    }
    const duration = (config.toast && config.toast.durationMs) || 3000;
    toastTimerId = setTimeout(() => {
      elements.toast.hidden = true;
      elements.toast.textContent = '';
      toastTimerId = null;
    }, duration);
  }

  function centerMapOnCurrentLocation() {
    const mapSource = getMapSource();
    const currentPoint = mapSource.currentPoint || session.currentPoint || idleCurrentPoint;
    if (currentPoint) {
      centerMapAt(currentPoint);
      showToast('已定位到当前位置。');
      return;
    }

    if (window.isSecureContext === false) {
      showToast('无法获取定位：手机浏览器只允许 HTTPS 或 localhost 页面申请定位。');
      return;
    }

    if (!navigator.geolocation) {
      showToast('无法获取定位：当前浏览器不支持 GPS。');
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      const point = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: '当前位置',
      };
      idleCurrentPoint = point;
      centerMapAt(point);
      renderMapLayers();
      renderFallbackLayers();
      showToast('已定位到当前位置。');
    }, (error) => {
      const message = error && error.code === 1
        ? '无法获取定位：定位权限被拒绝，请允许浏览器定位权限后重试。'
        : '无法获取定位：请检查定位服务或稍后重试。';
      showToast(message);
    }, {
      enableHighAccuracy: config.gps.enableHighAccuracy,
      maximumAge: config.gps.maximumAgeMs,
      timeout: config.gps.timeoutMs,
    });
  }

  function centerMapAt(point) {
    if (map && !stageFallbackClickEnabled) {
      map.setView([point.lat, point.lng], config.defaultZoom);
    }
  }

  // 申请并开始读取设备方向，用于在当前位置叠加朝向箭头。
  // iOS 需在用户手势中调用 requestPermission；其他平台直接监听。
  function ensureHeadingTracking() {
    if (headingListening) {
      return;
    }
    const orientationEvent = window.DeviceOrientationEvent;
    if (!orientationEvent) {
      return;
    }
    if (typeof orientationEvent.requestPermission === 'function') {
      orientationEvent.requestPermission()
        .then((state) => {
          if (state === 'granted') {
            attachOrientationListeners();
          }
        })
        .catch(() => {});
    } else {
      attachOrientationListeners();
    }
  }

  function attachOrientationListeners() {
    if (headingListening) {
      return;
    }
    headingListening = true;
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleDeviceOrientation);
    } else {
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
  }

  function handleDeviceOrientation(event) {
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
      // iOS：已是顺时针正北为 0 的罗盘朝向。
      heading = event.webkitCompassHeading;
    } else if (typeof event.alpha === 'number' && event.alpha !== null) {
      // 绝对方向：alpha 为逆时针角度，转换为顺时针罗盘朝向。
      heading = (360 - event.alpha) % 360;
    }

    if (heading === null || Number.isNaN(heading)) {
      return;
    }

    deviceHeading = (heading + 360) % 360;
    if (!headingMarker) {
      // 首次拿到朝向：补一次完整渲染以创建箭头标记。
      renderMapLayers();
    } else {
      applyHeadingRotation();
    }
  }

  function applyHeadingRotation() {
    if (!headingMarker || deviceHeading === null) {
      return;
    }
    const element = headingMarker.getElement();
    const arrow = element && element.querySelector('.heading-arrow');
    if (arrow) {
      arrow.style.transform = `rotate(${deviceHeading}deg)`;
    }
  }

  function updateHeadingMarker(currentPoint, isResultView) {
    const showHeading = Boolean(currentPoint) && !isResultView && deviceHeading !== null
      && map && !stageFallbackClickEnabled;

    if (!showHeading) {
      if (headingMarker) {
        headingMarker.remove();
        headingMarker = null;
      }
      return;
    }

    if (!headingMarker) {
      headingMarker = L.marker([currentPoint.lat, currentPoint.lng], {
        icon: L.divIcon({
          className: 'heading-marker',
          html: '<div class="heading-arrow"><span class="heading-arrow-tip"></span></div>',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: -100,
      }).addTo(map);
    }

    headingMarker.setLatLng([currentPoint.lat, currentPoint.lng]);
    applyHeadingRotation();
  }

  function primeIdleCurrentLocation() {
    if (session.state !== stateTools.STATES.IDLE && session.state !== stateTools.STATES.ABORTED) {
      return;
    }

    if (window.isSecureContext === false || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      idleCurrentPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: '当前位置',
        timestamp: new Date(position.timestamp || Date.now()).toISOString(),
      };
      centerMapAt(idleCurrentPoint);
      render();
    }, () => {}, {
      enableHighAccuracy: config.gps.enableHighAccuracy,
      maximumAge: config.gps.maximumAgeMs,
      timeout: config.gps.timeoutMs,
    });
  }

  function render() {
    const activeResult = getActiveResult();
    const isResultView = Boolean(activeResult);
    const isSavedResult = Boolean(selectedHistoryRecordId && activeResult);
    const isProfileView = activeView === 'profile';
    const isHistoryListView = activeView === 'historyList';
    const isFullPageView = isProfileView || isHistoryListView;
    const isIdleMain = !isFullPageView && !isResultView &&
      (session.state === stateTools.STATES.IDLE || session.state === stateTools.STATES.ABORTED);
    const summary = activeResult ? activeResult.summary : stateTools.summarizeSession(session);

    elements.sessionState.textContent = isSavedResult
      ? resultViewLabel()
      : isHistoryListView
        ? (historyListMode === 'favorites' ? '收藏' : '历史')
      : isProfileView
        ? '个人'
        : stateLabel(session.state);
    elements.sessionDistance.textContent = formatDistance(summary.distanceMeters);
    elements.sessionBirds.textContent = summary.uncertainRecordCount
      ? `${summary.speciesCount} 种 · ${summary.uncertainRecordCount} 未定`
      : `${summary.speciesCount} 种`;

    const isStartPanelVisible = !isFullPageView && !isResultView &&
      (session.state === stateTools.STATES.IDLE || session.state === stateTools.STATES.ABORTED);
    elements.startPanel.hidden = !isStartPanelVisible;
    elements.profileButton.hidden = isFullPageView || isResultView ||
      (session.state !== stateTools.STATES.IDLE && session.state !== stateTools.STATES.ABORTED);
    elements.finishButton.hidden = isFullPageView || isResultView || session.state !== stateTools.STATES.RECORDING;
    elements.finishButton.disabled = session.state !== stateTools.STATES.RECORDING;
    elements.resultPanel.hidden = !isResultView;
    elements.profilePanel.hidden = !isProfileView;
    elements.historyPanel.hidden = !isHistoryListView;
    elements.mapFallback.dataset.mode = isResultView ? stateTools.STATES.FINISHED : session.state;
    elements.mapStage.classList.toggle('is-result-mode', isResultView);
    elements.mapStage.classList.toggle('is-full-page', isFullPageView);
    elements.mapStage.classList.toggle('is-idle', isIdleMain);
    elements.mapTools.hidden = isFullPageView;
    elements.birdNameToggle.hidden = isFullPageView || isIdleMain || (session.state !== stateTools.STATES.RECORDING && !isResultView);
    elements.birdNameToggle.setAttribute('aria-pressed', showBirdNames ? 'true' : 'false');

    const inHistoryEdit = isSavedResult && historyEditMode;
    // 编辑态采用「地图为主」布局：隐藏底部结果面板，改用顶部窄条承载保存/取消，
    // 让整张地图都可用于点选与拖动落点。
    elements.resultPanel.hidden = !isResultView || inHistoryEdit;
    elements.historyEditBar.hidden = !inHistoryEdit;
    elements.historyEditButton.hidden = !(isSavedResult && !historyEditMode);
    elements.mapStage.classList.toggle('is-history-edit', inHistoryEdit);

    if (!isFullPageView && !isResultView && canUseSimulatedFallbackStart()) {
      elements.addBirdButton.textContent = '使用测试起点';
      elements.addBirdButton.disabled = false;
    } else {
      elements.addBirdButton.textContent = '添加鸟种';
      elements.addBirdButton.disabled = isFullPageView || isResultView || session.state !== stateTools.STATES.RECORDING;
    }
    elements.addBirdButton.hidden = isFullPageView || isResultView ||
      (session.state !== stateTools.STATES.RECORDING && !canUseSimulatedFallbackStart());

    const activeStatusHint = locationHintOverride || tileErrorHint;
    const shouldPinHintTop = Boolean(tileErrorHint && !locationHintOverride);
    elements.hintStrip.classList.toggle('is-top', false);
    if (isFullPageView || isResultView) {
      elements.hintStrip.hidden = true;
    } else if (activeStatusHint) {
      elements.hintStrip.textContent = activeStatusHint;
      elements.hintStrip.classList.toggle('is-top', shouldPinHintTop);
      elements.hintStrip.hidden = false;
    } else if (session.state === stateTools.STATES.PICKING_START) {
      elements.hintStrip.textContent = locationHintOverride ||
        (config.locationSource === 'gps' ? config.mapInteraction.gpsPendingHint : config.mapInteraction.pickingHint);
      elements.hintStrip.hidden = false;
    } else if (session.state === stateTools.STATES.RECORDING) {
      if (config.locationSource === 'gps') {
        elements.hintStrip.hidden = true;
      } else {
        elements.hintStrip.textContent = locationHintOverride || config.mapInteraction.recordingHint;
        elements.hintStrip.hidden = false;
      }
    } else if (session.state === stateTools.STATES.FINISHED) {
      elements.hintStrip.hidden = true;
    } else {
      elements.hintStrip.hidden = true;
    }

    renderMapLayers();
    renderFallbackLayers();
    renderTestRouteLayer();
    renderBirdPointOverlay();
    renderResultView();
    renderProfileView();
    syncIdleToolsPosition();
  }

  // 底部「开始记录」卡片或编辑操作条会占据底部空间，把定位工具上移到其之上，避免被遮挡。
  function syncIdleToolsPosition() {
    if (elements.mapTools.hidden) {
      elements.mapTools.style.bottom = '';
      return;
    }
    const blockingPanel = !elements.startPanel.hidden
      ? elements.startPanel
      : (!elements.historyEditBar.hidden ? elements.historyEditBar : null);
    if (!blockingPanel) {
      elements.mapTools.style.bottom = '';
      return;
    }
    const stageRect = elements.mapStage.getBoundingClientRect();
    const panelRect = blockingPanel.getBoundingClientRect();
    const gap = 12;
    const bottom = Math.round(stageRect.bottom - panelRect.top + gap);
    elements.mapTools.style.bottom = `${bottom}px`;
  }

  function renderResultView() {
    const result = getActiveResult();
    if (!result) {
      elements.resultBirdList.replaceChildren();
      return;
    }

    const label = resultViewLabel();
    elements.resultPanel.setAttribute('aria-label', label);
    elements.resultTitle.textContent = isEditingHistory()
      ? `编辑${label}`
      : label;
    elements.resultMeta.textContent = formatResultMeta(result);
    elements.resultDuration.textContent = formatDuration(result.summary.durationMinutes);
    elements.resultDistance.textContent = formatDistance(result.summary.distanceMeters);
    elements.resultSpecies.textContent = `${result.summary.speciesCount} 种`;
    elements.resultUncertain.textContent = `${result.summary.uncertainRecordCount || 0} 未定`;
    elements.resultListCount.textContent = `${result.summary.birdRecordCount} 条`;
    elements.shareButton.disabled = !result;
    elements.favoriteResultButton.hidden = !selectedHistoryRecordId || historyEditMode;
    elements.favoriteResultButton.textContent = stateTools.isHistoryRecordFavorite(result) ? '取消收藏' : '收藏';

    if (result.birdRecords.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'result-empty';
      empty.textContent = '本次还没有添加鸟种记录。';
      elements.resultBirdList.replaceChildren(empty);
      return;
    }

    elements.resultBirdList.replaceChildren(...result.birdRecords.map((record) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'result-bird-item';
      button.classList.toggle('is-highlighted', record.id === highlightedBirdRecordId);

      const head = buildRecordHead(record);

      const detail = document.createElement('span');
      detail.textContent = birdRecordDetail(record);

      button.append(head, detail);
      button.addEventListener('click', () => {
        if (isEditingHistory()) {
          openBirdDialog(record);
        } else {
          focusBirdRecord(record);
        }
      });

      return button;
    }));
  }

  function renderProfileView() {
    const visibleHistory = getVisibleHistoryRecords();
    const isFavoritesMode = historyListMode === 'favorites';
    elements.historyPanel.setAttribute('aria-label', isFavoritesMode ? '收藏线路' : '历史记录');
    elements.historyPanelKicker.textContent = isFavoritesMode ? '收藏线路' : '历史记录';
    elements.historyListTitle.textContent = isFavoritesMode ? '收藏线路' : '历史列表';
    elements.historyListDescription.textContent = isFavoritesMode
      ? '从这里打开本机收藏的观鸟路线。'
      : '从这里打开过去保存的观鸟路线。';
    elements.historyCount.textContent = `${visibleHistory.length} 条`;
    elements.historyEmpty.textContent = isFavoritesMode
      ? '还没有收藏线路。可以在历史列表或历史详情中收藏路线。'
      : '还没有历史记录。完成一次路线记录后，会显示在这里。';
    elements.historyEmpty.hidden = visibleHistory.length > 0;

    if (visibleHistory.length === 0) {
      elements.historyList.replaceChildren();
      return;
    }

    elements.historyList.replaceChildren(...visibleHistory.map((record) => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'history-open';

      const title = document.createElement('strong');
      title.textContent = formatResultMeta(record);

      const detail = document.createElement('span');
      detail.textContent = historyRecordDetail(record);

      const metrics = document.createElement('div');
      metrics.className = 'history-metrics';
      [
        formatDuration(record.summary.durationMinutes),
        formatDistance(record.summary.distanceMeters),
        `${record.summary.speciesCount} 种`,
      ].forEach((text) => {
        const metric = document.createElement('em');
        metric.textContent = text;
        metrics.appendChild(metric);
      });

      open.append(title, detail, metrics);
      open.addEventListener('click', () => {
        if (item.classList.contains('is-delete-revealed')) {
          item.classList.remove('is-delete-revealed');
          return;
        }
        openHistoryRecord(record.id);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'history-delete';
      remove.textContent = '删除';
      remove.setAttribute('aria-label', `删除 ${formatResultMeta(record)}`);
      remove.addEventListener('click', () => {
        requestDeleteHistoryRecord(record.id);
      });

      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = 'history-favorite';
      const isFavorite = stateTools.isHistoryRecordFavorite(record);
      favorite.textContent = isFavorite ? '★' : '☆';
      favorite.setAttribute('aria-label', isFavorite ? '取消收藏' : '收藏');
      favorite.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      favorite.addEventListener('click', () => {
        toggleFavoriteForRecord(record.id);
      });

      const actions = document.createElement('div');
      actions.className = 'history-actions';
      actions.append(favorite, remove);

      item.append(open, actions);
      bindSwipeReveal(item);
      return item;
    }));
  }

  function bindSwipeReveal(item) {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    item.addEventListener('pointerdown', (event) => {
      startX = event.clientX;
      startY = event.clientY;
      tracking = true;
    });

    item.addEventListener('pointerup', (event) => {
      if (!tracking) {
        return;
      }

      tracking = false;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
      }

      if (deltaX < -40) {
        item.classList.add('is-delete-revealed');
      } else if (deltaX > 30) {
        item.classList.remove('is-delete-revealed');
      }
    });

    item.addEventListener('pointercancel', () => {
      tracking = false;
    });
  }

  function pushRouteHistory() {
    if (suppressRouteHistory || !window.history || typeof window.history.pushState !== 'function') {
      return;
    }

    window.history.pushState({ birdRouteView: activeView }, '', window.location.href);
  }

  function closeOpenDialog() {
    const dialogs = [
      elements.finishDialog,
      elements.shareDialog,
      elements.importDialog,
      elements.birdDialog,
      elements.deleteHistoryDialog,
      elements.birdPointDialog,
    ];
    const openDialog = dialogs.find((dialog) => dialog && dialog.open);
    if (!openDialog) {
      return false;
    }

    openDialog.close();
    return true;
  }

  function goBack() {
    if (isEditingHistory()) {
      cancelHistoryEdits();
      return;
    }

    if (selectedHistoryRecordId && activeView !== 'currentResult') {
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      historyEditMode = false;
      historyDraft = null;
      activeView = 'historyList';
      render();
      return;
    }

    if (activeView === 'currentResult') {
      resetToMain();
      return;
    }

    if (activeView === 'historyList') {
      activeView = 'profile';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
      return;
    }

    if (activeView === 'profile') {
      activeView = 'main';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
    }
  }

  function resetToMain() {
    stopGpsTracking();
    session = stateTools.createSession();
    selectedHistoryRecordId = null;
    highlightedBirdRecordId = null;
    historyEditMode = false;
    historyDraft = null;
    activeView = 'main';
    locationHintOverride = '';
    clearPersistedSession();
    render();
    primeIdleCurrentLocation();
  }

  function requestDeleteHistoryRecord(recordId) {
    pendingDeleteHistoryId = recordId;
    if (elements.deleteHistoryDialog.showModal) {
      elements.deleteHistoryDialog.showModal();
    }
  }

  function getVisibleHistoryRecords() {
    return historyListMode === 'favorites'
      ? stateTools.favoriteHistoryRecords(history)
      : history;
  }

  function toggleFavoriteForRecord(recordId) {
    if (!recordId) {
      return;
    }

    history = stateTools.toggleHistoryFavorite(history, recordId);
    if (historyDraft && historyDraft.id === recordId) {
      historyDraft = stateTools.findHistoryRecord(history, recordId);
    }
    persistHistory(history);
    render();
  }

  function getActiveResult() {
    if (selectedHistoryRecordId) {
      if (isEditingHistory()) {
        return historyDraft;
      }

      return stateTools.findHistoryRecord(history, selectedHistoryRecordId);
    }

    return stateTools.createSessionResult(session);
  }

  function resultViewLabel() {
    if (activeView === 'currentResult') {
      return '本次记录';
    }

    if (selectedHistoryRecordId && historyListMode === 'favorites') {
      return '收藏线路';
    }

    if (selectedHistoryRecordId) {
      return '历史记录';
    }

    return '本次记录';
  }

  function isEditingHistory() {
    return Boolean(historyEditMode && historyDraft);
  }

  function enterHistoryEditMode() {
    const record = stateTools.findHistoryRecord(history, selectedHistoryRecordId);
    if (!record) {
      return;
    }

    // 克隆一份草稿，所有改动只作用于草稿，保存前不影响已存历史。
    historyDraft = JSON.parse(JSON.stringify(record));
    historyEditMode = true;
    highlightedBirdRecordId = null;
    render();
  }

  function saveHistoryEdits() {
    if (!isEditingHistory()) {
      return;
    }

    const updated = stateTools.recomputeResultSummary(historyDraft);
    history = stateTools.replaceHistoryRecord(history, updated);
    persistHistory(history);
    historyEditMode = false;
    historyDraft = null;
    highlightedBirdRecordId = null;
    render();
  }

  function cancelHistoryEdits() {
    historyEditMode = false;
    historyDraft = null;
    highlightedBirdRecordId = null;
    render();
  }

  function getMapSource() {
    const activeResult = getActiveResult();
    if (activeResult) {
      return activeResult;
    }

    if ((session.state === stateTools.STATES.IDLE || session.state === stateTools.STATES.ABORTED) && idleCurrentPoint) {
      return {
        ...session,
        currentPoint: idleCurrentPoint,
        track: [],
      };
    }

    return session;
  }

  function openHistoryRecord(recordId) {
    const record = stateTools.findHistoryRecord(history, recordId);
    if (!record) {
      return;
    }

    selectedHistoryRecordId = record.id;
    highlightedBirdRecordId = null;
    historyEditMode = false;
    historyDraft = null;
    activeView = 'historyResult';
    pushRouteHistory();
    render();
  }

  function historyRecordDetail(record) {
    const endedAt = record.endedAt
      ? new Date(record.endedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '保存时间未知';
    const birdCount = record.summary.birdRecordCount || 0;

    return `${endedAt} · ${birdCount} 条鸟点记录`;
  }

  function formatResultMeta(result) {
    const date = result.endedAt
      ? new Date(result.endedAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
      : '今天';
    const place = routePlaceLabel(result);

    return `${date} · ${place}`;
  }

  function routePlaceLabel(result) {
    const endPoint = result.currentPoint || result.track[result.track.length - 1] || null;
    return `${pointLabel(result.startPoint, '起点')} - ${pointLabel(endPoint, '终点')}`;
  }

  function pointLabel(point, fallback) {
    return point && point.label ? point.label : fallback;
  }

  function formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} 分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
  }

  // 鸟点记录时间，精确到分钟（如 14:30）；无有效时间返回空串（旧数据留空）。
  function formatRecordTime(record) {
    const iso = record && record.createdAt;
    if (!iso) {
      return '';
    }
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // 鸟点条目统一的标题行：左侧鸟种名×数量，右侧记录时间。
  function buildRecordHead(record) {
    const head = document.createElement('div');
    head.className = 'bird-item-head';

    const title = document.createElement('strong');
    title.textContent = `${recordDisplayName(record)} × ${record.count}`;
    head.append(title);

    if (record.isSensitive) {
      const badge = document.createElement('span');
      badge.className = 'sensitive-badge';
      badge.textContent = '敏感';
      head.append(badge);
    }

    const time = formatRecordTime(record);
    if (time) {
      const timeEl = document.createElement('time');
      timeEl.className = 'record-time';
      timeEl.textContent = time;
      head.append(timeEl);
    }

    return head;
  }

  function birdRecordDetail(record) {
    const tags = record.tags.length ? record.tags.join('、') : '';
    const note = record.note || '';

    if (isUncertainRecord(record)) {
      const fuzzy = fuzzyRecordDetail(record);
      const fuzzyParts = [fuzzy, tags, note].filter(Boolean);
      return fuzzyParts.length ? fuzzyParts.join(' · ') : '特征未补充';
    }

    const parts = [record.scientificName, tags, note].filter(Boolean);
    return parts.length ? parts.join(' · ') : '无备注';
  }

  function isUncertainRecord(record) {
    return stateTools.normalizeIdentificationType(record.identificationType) === 'uncertain';
  }

  // 由一组鸟点记录计算分享摘要计数（剔除敏感后调用）。
  function summarizeRecordsForShare(records) {
    const confirmed = records.filter((record) => !isUncertainRecord(record));
    const uncertain = records.filter((record) => isUncertainRecord(record));
    const species = new Set(confirmed.map((record) => record.speciesName));
    const totalBirds = records.reduce((total, record) => total + record.count, 0);

    return {
      speciesCount: species.size,
      uncertainRecordCount: uncertain.length,
      totalBirds,
      birdRecordCount: records.length,
    };
  }

  function recordDisplayName(record) {
    return isUncertainRecord(record)
      ? config.fuzzyMatch.uncertainSpeciesName
      : record.speciesName;
  }

  function fuzzyRecordDetail(record) {
    const features = fuzzyTools.normalizeFeatures(record.fuzzyFeatures);
    const labels = [];
    const groupMap = new Map(config.fuzzyMatch.featureGroups.map((group) => [group.key, group]));

    if (features.size) {
      labels.push(optionLabel(groupMap.get('size'), features.size));
    }

    ['colors', 'behaviors', 'habitats', 'postures'].forEach((key) => {
      features[key].forEach((value) => labels.push(optionLabel(groupMap.get(key), value)));
    });

    const candidateText = Array.isArray(record.candidateBirds) && record.candidateBirds.length
      ? `候选：${record.candidateBirds.slice(0, 3).map((candidate) => candidate.name).join('、')}`
      : '';

    return [labels.filter(Boolean).join('、'), candidateText].filter(Boolean).join(' · ');
  }

  function optionLabel(group, value) {
    if (!group || !Array.isArray(group.options)) {
      return value;
    }

    const option = group.options.find((item) => item.value === value);
    return option ? option.label : value;
  }

  function focusBirdRecord(record) {
    highlightedBirdRecordId = record.id;

    if (map && !stageFallbackClickEnabled) {
      map.panTo([record.position.lat, record.position.lng]);
    }

    renderBirdPointOverlay();
    renderResultView();
  }

  function openShareDialog() {
    const result = getActiveResult();
    if (!result) {
      return;
    }

    renderShareDialog(result);

    if (elements.shareDialog.showModal) {
      elements.shareDialog.showModal();
    }
  }

  function renderShareDialog(result) {
    // 敏感鸟点不纳入分享内容：摘要的计数与名单都基于剔除敏感后的记录。
    const sensitiveCount = result.birdRecords.filter((record) => record.isSensitive).length;
    const shareableRecords = result.birdRecords.filter((record) => !record.isSensitive);
    const shareSummary = summarizeRecordsForShare(shareableRecords);

    const title = document.createElement('strong');
    title.textContent = selectedHistoryRecordId ? '历史记录分享' : '本次记录分享';

    const meta = document.createElement('span');
    meta.textContent = `${formatResultMeta(result)} · ${formatDuration(result.summary.durationMinutes)} · ${formatDistance(result.summary.distanceMeters)}`;

    const metrics = document.createElement('span');
    metrics.textContent = `${shareSummary.speciesCount} 种 · ${shareSummary.uncertainRecordCount} 未定 · ${shareSummary.totalBirds} 只 · ${shareSummary.birdRecordCount} 条鸟点`;

    const birds = document.createElement('span');
    birds.textContent = shareableRecords.length
      ? shareableRecords.map((record) => `${recordDisplayName(record)} × ${record.count}`).join('、')
      : '尚无可分享鸟种记录';

    const children = [title, meta, metrics, birds];
    if (sensitiveCount > 0) {
      const sensitiveNote = document.createElement('span');
      sensitiveNote.className = 'share-sensitive-note';
      sensitiveNote.textContent = `已隐去 ${sensitiveCount} 条敏感鸟点，不会出现在分享内容中。`;
      children.push(sensitiveNote);
    }

    elements.shareRecordSummary.replaceChildren(...children);
    elements.shareServiceStatus.textContent = config.shareImport.pendingServiceLabel;
    elements.copyShareLinkButton.disabled = !config.shareImport.serviceEnabled;
  }

  function openImportDialog() {
    elements.importUrlInput.value = '';
    elements.importServiceStatus.textContent = config.shareImport.pendingServiceLabel;
    elements.importPreview.textContent = '当前仅展示导入流程入口，真实链接解析与保存将在服务器服务接入后开放。';

    if (elements.importDialog.showModal) {
      elements.importDialog.showModal();
      elements.importUrlInput.focus();
    }
  }

  function previewImportLink() {
    const preview = stateTools.previewSharedRecordImport(history, null, config.shareImport);
    const url = elements.importUrlInput.value.trim();

    elements.importServiceStatus.textContent = config.shareImport.pendingServiceLabel;

    if (!url) {
      elements.importPreview.textContent = '请先粘贴分享链接。真实链接解析服务接入后，可在这里预览路线摘要。';
      return;
    }

    if (preview.status === 'serviceUnavailable') {
      elements.importPreview.textContent = '服务器链接服务待接入，当前仅能预览导入入口，暂不能保存到历史记录。';
      return;
    }

    elements.importPreview.textContent = '分享链接已读取，等待后续保存流程接入。';
  }

  function openBirdDialog(record = null) {
    birdDraft = createBirdDraft(record);
    elements.birdDialogTitle.textContent = record ? '编辑鸟点' : '添加鸟种';
    elements.birdSearchInput.value = record ? record.speciesName : '';
    elements.birdNoteInput.value = record ? record.note : '';
    elements.birdSubmitButton.textContent = record ? '保存修改' : '添加到当前位置';
    elements.birdDeleteButton.hidden = !record;
    renderFuzzyGroups();
    renderBirdResults(elements.birdSearchInput.value);
    renderBirdDraft();

    if (elements.birdDialog.showModal) {
      elements.birdDialog.showModal();
      elements.birdSearchInput.focus();
    }
  }

  function renderBirdResults(query) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      const empty = document.createElement('p');
      empty.className = 'bird-results-empty';
      empty.textContent = '输入中文名或学名后显示匹配鸟种。';
      elements.birdResults.replaceChildren(empty);
      return;
    }

    const birds = window.BIRD_CATALOG
      .filter((bird) => {
        return bird.name.toLowerCase().includes(normalizedQuery) ||
          bird.scientificName.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);

    if (birds.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'bird-results-empty';
      empty.textContent = '没有匹配的鸟种。请检查中文名或学名。';
      elements.birdResults.replaceChildren(empty);
      return;
    }

    elements.birdResults.replaceChildren(...birds.map((bird) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bird-result-button';
      if (birdDraft.selectedBird && birdDraft.selectedBird.name === bird.name) {
        button.classList.add('is-selected');
      }

      const name = document.createElement('strong');
      name.textContent = bird.name;
      const scientific = document.createElement('span');
      scientific.textContent = bird.scientificName;
      button.append(name, scientific);

      button.addEventListener('click', () => {
        birdDraft.selectedBird = bird;
        renderBirdResults(elements.birdSearchInput.value);
        renderBirdDraft();
      });
      return button;
    }));
  }

  function renderBirdDraft() {
    const isFuzzyMode = birdDraft.mode === 'fuzzy';
    elements.birdCountValue.textContent = String(birdDraft.count);
    elements.birdSearchModeButton.classList.toggle('is-selected', !isFuzzyMode);
    elements.birdSearchModeButton.setAttribute('aria-selected', isFuzzyMode ? 'false' : 'true');
    elements.birdFuzzyModeButton.classList.toggle('is-selected', isFuzzyMode);
    elements.birdFuzzyModeButton.setAttribute('aria-selected', isFuzzyMode ? 'true' : 'false');
    elements.birdSearchPanel.hidden = isFuzzyMode;
    elements.birdFuzzyPanel.hidden = !isFuzzyMode;
    elements.birdSelectedInfo.textContent = selectedInfoText();

    elements.tagToggles.forEach((button) => {
      button.classList.toggle('is-selected', birdDraft.tags.includes(button.dataset.tag));
    });

    const isSensitive = Boolean(birdDraft.isSensitive);
    elements.birdSensitiveToggle.classList.toggle('is-selected', isSensitive);
    elements.birdSensitiveToggle.setAttribute('aria-pressed', isSensitive ? 'true' : 'false');
    elements.birdSensitiveState.textContent = isSensitive ? '开' : '关';
    elements.birdSensitiveHint.hidden = !isSensitive;

    renderFuzzySelection();
    elements.birdSubmitButton.disabled = isFuzzyMode
      ? !fuzzyTools.hasManualFeature(birdDraft.fuzzyFeatures)
      : !birdDraft.selectedBird;
  }

  function submitBirdRecord() {
    if (birdDraft.mode === 'search' && !birdDraft.selectedBird) {
      elements.birdSelectedInfo.textContent = '请先选择一个鸟种。';
      return;
    }

    if (birdDraft.mode === 'fuzzy' && !fuzzyTools.hasManualFeature(birdDraft.fuzzyFeatures)) {
      elements.birdSelectedInfo.textContent = '请至少选择一个特征。';
      return;
    }

    const payload = birdDraft.mode === 'fuzzy'
      ? {
          identificationType: 'uncertain',
          speciesName: config.fuzzyMatch.uncertainSpeciesName,
          scientificName: '',
          count: birdDraft.count,
          tags: birdDraft.tags,
          note: elements.birdNoteInput.value.trim(),
          isSensitive: Boolean(birdDraft.isSensitive),
          fuzzyFeatures: fuzzyTools.normalizeFeatures(birdDraft.fuzzyFeatures),
          candidateBirds: fuzzyTools.matchCandidates(birdDraft.fuzzyFeatures),
        }
      : {
          identificationType: 'confirmed',
          speciesName: birdDraft.selectedBird.name,
          scientificName: birdDraft.selectedBird.scientificName,
          count: birdDraft.count,
          tags: birdDraft.tags,
          note: elements.birdNoteInput.value.trim(),
          isSensitive: Boolean(birdDraft.isSensitive),
          fuzzyFeatures: {},
          candidateBirds: [],
        };

    if (isEditingHistory()) {
      // 历史编辑：只改草稿中已有的落点，并即时重算概要以便界面同步更新。
      if (birdDraft.editingRecordId) {
        historyDraft = stateTools.updateBirdRecord(historyDraft, birdDraft.editingRecordId, payload);
        historyDraft = stateTools.recomputeResultSummary(historyDraft);
      }
      elements.birdDialog.close();
      render();
      return;
    }

    session = birdDraft.editingRecordId
      ? stateTools.updateBirdRecord(session, birdDraft.editingRecordId, payload)
      : stateTools.addBirdRecord(session, payload);
    persistSession(session);
    elements.birdDialog.close();
    render();
    showToast(birdDraft.editingRecordId
      ? `已更新：${recordDisplayName(payload)}`
      : `已添加：${recordDisplayName(payload)}`);
  }

  function deleteSelectedBirdRecord() {
    if (!birdDraft.editingRecordId) {
      return;
    }

    if (highlightedBirdRecordId === birdDraft.editingRecordId) {
      highlightedBirdRecordId = null;
    }

    if (isEditingHistory()) {
      historyDraft = stateTools.deleteBirdRecord(historyDraft, birdDraft.editingRecordId);
      historyDraft = stateTools.recomputeResultSummary(historyDraft);
      elements.birdDialog.close();
      render();
      return;
    }

    session = stateTools.deleteBirdRecord(session, birdDraft.editingRecordId);
    persistSession(session);
    elements.birdDialog.close();
    render();
    showToast('已删除鸟点记录');
  }

  function createBirdDraft(record = null) {
    if (record) {
      const isFuzzyRecord = isUncertainRecord(record);
      return {
        editingRecordId: record.id,
        mode: isFuzzyRecord ? 'fuzzy' : 'search',
        selectedBird: isFuzzyRecord ? null : {
          name: record.speciesName,
          scientificName: record.scientificName,
        },
        count: record.count,
        tags: [...record.tags],
        isSensitive: Boolean(record.isSensitive),
        fuzzyFeatures: fuzzyTools.normalizeFeatures(record.fuzzyFeatures),
      };
    }

    return {
      editingRecordId: null,
      mode: 'search',
      selectedBird: null,
      count: 1,
      tags: [],
      isSensitive: false,
      fuzzyFeatures: fuzzyTools.normalizeFeatures(),
    };
  }

  function setBirdDraftMode(mode) {
    birdDraft.mode = mode === 'fuzzy' ? 'fuzzy' : 'search';
    renderBirdDraft();
  }

  function renderFuzzyGroups() {
    const groups = config.fuzzyMatch.featureGroups.map((group) => {
      const wrapper = document.createElement('section');
      wrapper.className = 'fuzzy-group';

      const title = document.createElement('strong');
      title.className = 'fuzzy-group-title';
      title.textContent = group.label;

      const row = document.createElement('div');
      row.className = 'fuzzy-option-row';
      group.options.forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'fuzzy-option';
        button.dataset.fuzzyGroup = group.key;
        button.dataset.fuzzyValue = option.value;
        button.textContent = option.label;
        button.addEventListener('click', () => {
          toggleFuzzyFeature(group, option.value);
          renderBirdDraft();
        });
        row.appendChild(button);
      });

      wrapper.append(title, row);
      return wrapper;
    });

    elements.birdFuzzyGroups.replaceChildren(...groups);
  }

  function renderFuzzySelection() {
    elements.birdFuzzyContext.textContent = birdDraft.editingRecordId
      ? '正在编辑未确定鸟点；地点和时间沿用原鸟点记录。'
      : '地点和时间会随当前鸟点自动保存。';

    elements.birdFuzzyGroups.querySelectorAll('.fuzzy-option').forEach((button) => {
      const group = button.dataset.fuzzyGroup;
      const value = button.dataset.fuzzyValue;
      const selected = group === 'size'
        ? birdDraft.fuzzyFeatures.size === value
        : Array.isArray(birdDraft.fuzzyFeatures[group]) && birdDraft.fuzzyFeatures[group].includes(value);
      button.classList.toggle('is-selected', selected);
    });

    const candidates = fuzzyTools.matchCandidates(birdDraft.fuzzyFeatures);
    if (!fuzzyTools.hasManualFeature(birdDraft.fuzzyFeatures)) {
      const empty = document.createElement('span');
      empty.textContent = '选择特征后显示候选建议。';
      elements.birdFuzzyCandidates.replaceChildren(empty);
      return;
    }

    if (candidates.length === 0) {
      const empty = document.createElement('span');
      empty.textContent = '暂无明显候选，可先保存特征和备注。';
      elements.birdFuzzyCandidates.replaceChildren(empty);
      return;
    }

    elements.birdFuzzyCandidates.replaceChildren(...candidates.map((candidate) => {
      const item = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = candidate.name;
      const detail = document.createElement('span');
      detail.textContent = `${candidate.scientificName} · 匹配度 ${candidate.score}`;
      item.append(name, detail);
      return item;
    }));
  }

  function toggleFuzzyFeature(group, value) {
    if (group.key === 'size' || group.multiple === false) {
      birdDraft.fuzzyFeatures[group.key] = birdDraft.fuzzyFeatures[group.key] === value ? '' : value;
      return;
    }

    const current = Array.isArray(birdDraft.fuzzyFeatures[group.key])
      ? birdDraft.fuzzyFeatures[group.key]
      : [];
    birdDraft.fuzzyFeatures[group.key] = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
  }

  function selectedInfoText() {
    if (birdDraft.mode === 'fuzzy') {
      const candidates = fuzzyTools.matchCandidates(birdDraft.fuzzyFeatures);
      return fuzzyTools.hasManualFeature(birdDraft.fuzzyFeatures)
        ? `将保存为未确定鸟种，当前有 ${candidates.length} 个候选建议。`
        : '请选择一个或多个观察特征。';
    }

    return birdDraft.selectedBird
      ? `已选择：${birdDraft.selectedBird.name}（${birdDraft.selectedBird.scientificName}）`
      : '请选择一个鸟种。';
  }

  function renderMapLayers() {
    if (!map || !routeLayer) {
      return;
    }

    const mapSource = getMapSource();
    const isResultView = Boolean(getActiveResult());
    const latLngs = mapSource.track.map((point) => [point.lat, point.lng]);
    const startPoint = mapSource.startPoint;
    const currentPoint = mapSource.currentPoint || mapSource.track[mapSource.track.length - 1] || null;
    routeLayer.setLatLngs(latLngs);
    routeLayer.bringToFront();

    if (!startPoint && startMarker) {
      startMarker.remove();
      startMarker = null;
    }

    if (!currentPoint && currentMarker) {
      currentMarker.remove();
      currentMarker = null;
    }

    if (startPoint && !startMarker) {
      startMarker = L.circleMarker([startPoint.lat, startPoint.lng], {
        radius: 7,
        color: '#123f31',
        fillColor: '#f8f5ee',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    if (startMarker && startPoint) {
      startMarker.setLatLng([startPoint.lat, startPoint.lng]);
    }

    if (currentPoint && !currentMarker) {
      currentMarker = L.circleMarker([currentPoint.lat, currentPoint.lng], {
        radius: 8,
        color: '#ffffff',
        fillColor: '#c1842b',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    if (currentMarker && currentPoint) {
      currentMarker.setLatLng([currentPoint.lat, currentPoint.lng]);
    }

    updateHeadingMarker(currentPoint, isResultView);

    if (isResultView) {
      // 结果页 / 历史查看：一次性框选完整轨迹，方便概览全程。
      if (latLngs.length > 1) {
        map.fitBounds(routeLayer.getBounds(), {
          paddingTopLeft: [28, 96],
          paddingBottomRight: [28, 128],
          maxZoom: config.defaultZoom,
          animate: false,
        });
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], config.defaultZoom, { animate: false });
      }
    } else if (session.state === stateTools.STATES.RECORDING && currentPoint) {
      // 记录中：跟随当前位置但保持用户当前缩放级别，避免每加一个轨迹点就自动缩放。
      map.panTo([currentPoint.lat, currentPoint.lng], { animate: false });
    }
  }

  function renderFallbackLayers() {
    if (!fallbackMode || !elements.fallbackRouteLayer) {
      return;
    }

    const svg = elements.fallbackRouteLayer;
    const rect = elements.mapStage.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(rect.width, 1)} ${Math.max(rect.height, 1)}`);
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const mapSource = getMapSource();
    const points = mapSource.track.map(pointToFallbackPosition);
    if (points.length > 1) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('class', 'fallback-route-polyline');
      polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
      svg.appendChild(polyline);
    }

    if (points.length === 0 && mapSource.currentPoint) {
      points.push(pointToFallbackPosition(mapSource.currentPoint));
    }

    points.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'fallback-route-point');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', index === points.length - 1 ? '8' : '6');
      circle.setAttribute('fill', index === 0 ? '#f8f5ee' : '#c1842b');
      svg.appendChild(circle);
    });

  }

  function renderTestRouteLayer() {
    const svg = elements.testRouteLayer;
    if (!svg) {
      return;
    }

    const rect = elements.mapStage.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${Math.max(rect.width, 1)} ${Math.max(rect.height, 1)}`);
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    if (fallbackMode || (map && routeLayer)) {
      return;
    }

    const mapSource = getMapSource();
    if (!stageFallbackClickEnabled || mapSource.track.length === 0) {
      return;
    }

    const points = mapSource.track.map(pointToFallbackPosition);
    if (points.length > 1) {
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('class', 'test-route-polyline');
      polyline.setAttribute('points', points.map((point) => `${point.x},${point.y}`).join(' '));
      svg.appendChild(polyline);
    }

    points.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('class', 'test-route-point');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', index === points.length - 1 ? '8' : '6');
      circle.setAttribute('fill', index === 0 ? '#f8f5ee' : '#c1842b');
      svg.appendChild(circle);
    });

  }

  function renderBirdPointOverlay() {
    elements.birdPointLayer.replaceChildren();
    birdPointGroups = [];
    const mapSource = getMapSource();
    if (mapSource.birdRecords.length === 0) {
      return;
    }

    const groups = groupBirdRecordsByScreenPosition(mapSource.birdRecords);
    groups.forEach((group) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bird-point-button';
      if (group.records.length > 1) {
        button.classList.add('is-grouped');
      }
      if (group.records.some((record) => record.isSensitive)) {
        button.classList.add('is-sensitive');
      }
      if (group.records.some((record) => record.id === highlightedBirdRecordId)) {
        button.classList.add('is-highlighted');
      }

      button.style.left = `${group.x}px`;
      button.style.top = `${group.y}px`;
      button.textContent = birdPointLabel(group);

      // 仅在历史编辑态、单条落点、且有真实地图时允许拖动。
      const canDrag = isEditingHistory() && group.records.length === 1 && map && !stageFallbackClickEnabled;
      let dragged = false;
      if (canDrag) {
        button.classList.add('is-draggable');
        button.addEventListener('pointerdown', (event) => {
          startBirdPointDrag(event, button, group.records[0], () => {
            dragged = true;
          });
        });
      }

      button.addEventListener('click', () => {
        if (dragged) {
          // 本次是拖动而非点选，不打开编辑弹层。
          dragged = false;
          return;
        }

        if (isEditingHistory()) {
          openBirdPointPreview(group.records);
        } else if (selectedHistoryRecordId) {
          focusBirdRecord(group.records[0]);
        } else {
          openBirdPointPreview(group.records);
        }
      });
      elements.birdPointLayer.appendChild(button);
      // 记下「按钮 ↔ 其包含的记录」，供平移/缩放过程中实时重排位置。
      birdPointGroups.push({ button, records: group.records });
    });
  }

  // 平移/缩放过程中：只更新已有落点按钮的位置，不重建 DOM（避免元素反复销毁重建）。
  function repositionBirdPointOverlay() {
    if (!map) {
      return;
    }

    birdPointGroups.forEach(({ button, records }) => {
      const center = averageScreenPosition(records);
      button.style.left = `${center.x}px`;
      button.style.top = `${center.y}px`;
    });
  }

  function averageScreenPosition(records) {
    let sumX = 0;
    let sumY = 0;
    records.forEach((record) => {
      const position = screenPositionForBirdRecord(record);
      sumX += position.x;
      sumY += position.y;
    });

    return { x: sumX / records.length, y: sumY / records.length };
  }

  function groupBirdRecordsByScreenPosition(records) {
    const threshold = config.birdPoint.clusterDistancePx;
    const groups = [];

    records.forEach((record) => {
      const position = screenPositionForBirdRecord(record);
      const group = groups.find((candidate) => {
        const dx = candidate.x - position.x;
        const dy = candidate.y - position.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      });

      if (group) {
        group.records.push(record);
        group.x = (group.x * (group.records.length - 1) + position.x) / group.records.length;
        group.y = (group.y * (group.records.length - 1) + position.y) / group.records.length;
      } else {
        groups.push({
          x: position.x,
          y: position.y,
          records: [record],
        });
      }
    });

    return groups;
  }

  function screenPositionForBirdRecord(record) {
    if (map && !stageFallbackClickEnabled) {
      const point = map.latLngToContainerPoint([record.position.lat, record.position.lng]);
      return { x: point.x, y: point.y };
    }

    return pointToFallbackPosition(record.position);
  }

  function birdPointLabel(group) {
    if (group.records.length > 1) {
      return showBirdNames
        ? `${group.records.length}条`
        : String(group.records.length);
    }

    return showBirdNames ? recordDisplayName(group.records[0]) : '';
  }

  function openBirdPointPreview(records) {
    if (records.length === 1) {
      openBirdDialog(records[0]);
      return;
    }

    elements.birdPointList.replaceChildren(...records.map((record) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bird-point-list-button';

      const head = buildRecordHead(record);
      const detail = document.createElement('span');
      detail.textContent = birdRecordDetail(record);
      button.append(head, detail);

      button.addEventListener('click', () => {
        elements.birdPointDialog.close();
        openBirdDialog(record);
      });
      return button;
    }));

    if (elements.birdPointDialog.showModal) {
      elements.birdPointDialog.showModal();
    }
  }

  function fallbackPointFromEvent(event) {
    const rect = elements.mapStage.getBoundingClientRect();
    const xRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const yRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1);

    return {
      lat: config.defaultCenter.lat + ((0.5 - yRatio) * 0.02) / fallbackScale,
      lng: config.defaultCenter.lng + ((xRatio - 0.5) * 0.02) / fallbackScale,
      label: '流程测试点',
    };
  }

  function pointToFallbackPosition(point) {
    const rect = elements.mapStage.getBoundingClientRect();
    const xRatio = 0.5 + ((point.lng - config.defaultCenter.lng) / 0.02) * fallbackScale;
    const yRatio = 0.5 - ((point.lat - config.defaultCenter.lat) / 0.02) * fallbackScale;

    return {
      x: clamp(xRatio, 0, 1) * rect.width,
      y: clamp(yRatio, 0, 1) * rect.height,
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function startBirdPointDrag(event, button, record, onDragStart) {
    if (!isEditingHistory() || !map || stageFallbackClickEnabled) {
      return;
    }

    // 不在 pointerdown 上 preventDefault，以免抑制纯点选时的 click（点选用于打开编辑弹层）。
    // 监听挂在 window 上，确保指针移出落点后仍能持续接收移动与抬起事件。
    event.stopPropagation();

    let moved = false;

    const onMove = (moveEvent) => {
      if (!moved) {
        moved = true;
        onDragStart();
      }
      moveEvent.preventDefault();
      const position = pixelInStage(moveEvent);
      button.style.left = `${position.x}px`;
      button.style.top = `${position.y}px`;
    };

    const finish = (upEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);

      if (!moved) {
        return;
      }

      const snapped = snapPixelToRoute(pixelInStage(upEvent));
      if (snapped) {
        historyDraft = stateTools.updateBirdRecordPosition(historyDraft, record.id, snapped);
      }
      render();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  function pixelInStage(event) {
    const rect = elements.mapStage.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  // 将屏幕像素点吸附到行进轨迹上：取与各轨迹线段最近的投影点，再换回经纬度。
  function snapPixelToRoute(pixel) {
    const mapSource = getMapSource();
    const track = (mapSource && mapSource.track) || [];
    if (!map || stageFallbackClickEnabled || track.length === 0) {
      return null;
    }

    const points = track.map((point) => {
      const containerPoint = map.latLngToContainerPoint([point.lat, point.lng]);
      return { x: containerPoint.x, y: containerPoint.y };
    });

    let nearest = points[0];
    if (points.length > 1) {
      let best = null;
      for (let index = 0; index < points.length - 1; index += 1) {
        const projection = projectPointOnSegment(pixel, points[index], points[index + 1]);
        if (!best || projection.dist < best.dist) {
          best = projection;
        }
      }
      nearest = best;
    }

    const latLng = map.containerPointToLatLng([nearest.x, nearest.y]);
    return { lat: latLng.lat, lng: latLng.lng };
  }

  function projectPointOnSegment(point, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    let t = 0;
    if (lengthSquared > 0) {
      t = clamp(((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared, 0, 1);
    }

    const x = a.x + t * abx;
    const y = a.y + t * aby;
    const dx = point.x - x;
    const dy = point.y - y;
    return { x, y, dist: Math.sqrt(dx * dx + dy * dy) };
  }

  function enableStageFallbackClick() {
    if (stageFallbackClickEnabled) {
      return;
    }

    stageFallbackClickEnabled = true;
    elements.mapStage.addEventListener('click', (event) => {
      if (!shouldUseStageFallbackClick()) {
        return;
      }

      if (event.target.closest('button, dialog, .start-panel, .top-bar, .bottom-action')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      handleMapClick(fallbackPointFromEvent(event));
    }, true);
  }

  function shouldUseStageFallbackClick() {
    return canUseSimulatedFallbackStart() ||
      (session.state === stateTools.STATES.RECORDING && config.locationSource === 'simulated');
  }

  function canUseSimulatedFallbackStart() {
    return session.state === stateTools.STATES.PICKING_START &&
      stageFallbackClickEnabled &&
      config.locationSource !== 'gps';
  }

  function stateLabel(value) {
    const labels = {
      [stateTools.STATES.IDLE]: '未开始',
      [stateTools.STATES.PICKING_START]: '选起点',
      [stateTools.STATES.RECORDING]: '记录中',
      [stateTools.STATES.FINISHED]: '已结束',
      [stateTools.STATES.ABORTED]: '已中止',
    };

    return labels[value] || '未知';
  }

  function formatDistance(meters) {
    if (meters < 1000) {
      return `${meters} m`;
    }

    return `${(meters / 1000).toFixed(1)} km`;
  }

  function migrateFinishedSessionIntoHistory() {
    if (session.state !== stateTools.STATES.FINISHED) {
      return;
    }

    const savedRecord = addFinishedSessionToHistory(session, dateFromIso(session.endedAt));
    if (savedRecord && !selectedHistoryRecordId) {
      selectedHistoryRecordId = savedRecord.id;
      activeView = 'currentResult';
    }
  }

  function addFinishedSessionToHistory(value, savedAt = new Date()) {
    const record = stateTools.createHistoryRecord(value, savedAt);
    if (!record) {
      return null;
    }

    const existingRecord = stateTools.findHistoryRecord(history, record.id);
    if (existingRecord) {
      return existingRecord;
    }

    history = stateTools.addHistoryRecord(history, record);
    persistHistory(history);
    return record;
  }

  function persistSession(value) {
    localStorage.setItem(config.storageKey, JSON.stringify(value));
  }

  function loadPersistedSession() {
    const rawSession = localStorage.getItem(config.storageKey);
    if (!rawSession) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawSession);
      return parsed && typeof parsed.state === 'string' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function clearPersistedSession() {
    localStorage.removeItem(config.storageKey);
  }

  function persistHistory(value) {
    localStorage.setItem(config.historyStorageKey, JSON.stringify(value));
  }

  function loadHistory() {
    const rawHistory = localStorage.getItem(config.historyStorageKey);
    if (!rawHistory) {
      return [];
    }

    try {
      const parsed = JSON.parse(rawHistory);
      return Array.isArray(parsed) ? parsed.filter((record) => record && record.id) : [];
    } catch (error) {
      return [];
    }
  }

  function dateFromIso(value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : new Date();
  }
})();
