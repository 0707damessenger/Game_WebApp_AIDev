(function attachApp() {
  const config = window.CONFIG;
  const stateTools = window.BirdRouteState;
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
  let activeView = 'main';
  let gpsWatchId = null;
  let locationHintOverride = '';

  const elements = {
    mapStage: document.querySelector('#mapStage'),
    mapFallback: document.querySelector('#mapFallback'),
    fallbackRouteLayer: document.querySelector('#fallbackRouteLayer'),
    testRouteLayer: document.querySelector('#testRouteLayer'),
    birdPointLayer: document.querySelector('#birdPointLayer'),
    zoomInButton: document.querySelector('#zoomInButton'),
    zoomOutButton: document.querySelector('#zoomOutButton'),
    birdNameToggle: document.querySelector('#birdNameToggle'),
    startPanel: document.querySelector('#startPanel'),
    startButton: document.querySelector('#startButton'),
    finishButton: document.querySelector('#finishButton'),
    addBirdButton: document.querySelector('#addBirdButton'),
    hintStrip: document.querySelector('#hintStrip'),
    sessionState: document.querySelector('#sessionState'),
    sessionDistance: document.querySelector('#sessionDistance'),
    sessionBirds: document.querySelector('#sessionBirds'),
    profileButton: document.querySelector('#profileButton'),
    finishDialog: document.querySelector('#finishDialog'),
    saveFinishButton: document.querySelector('#saveFinishButton'),
    abortButton: document.querySelector('#abortButton'),
    resultPanel: document.querySelector('#resultPanel'),
    resultTitle: document.querySelector('#resultTitle'),
    resultMeta: document.querySelector('#resultMeta'),
    resultSummary: document.querySelector('#resultSummary'),
    resultDuration: document.querySelector('#resultDuration'),
    resultDistance: document.querySelector('#resultDistance'),
    resultSpecies: document.querySelector('#resultSpecies'),
    resultBirdTotal: document.querySelector('#resultBirdTotal'),
    resultListCount: document.querySelector('#resultListCount'),
    resultBirdList: document.querySelector('#resultBirdList'),
    returnHomeButton: document.querySelector('#returnHomeButton'),
    profilePanel: document.querySelector('#profilePanel'),
    historyEntryButton: document.querySelector('#historyEntryButton'),
    historyPanel: document.querySelector('#historyPanel'),
    historyCount: document.querySelector('#historyCount'),
    historyEmpty: document.querySelector('#historyEmpty'),
    historyList: document.querySelector('#historyList'),
    profileBackButton: document.querySelector('#profileBackButton'),
    historyBackButton: document.querySelector('#historyBackButton'),
    birdDialog: document.querySelector('#birdDialog'),
    birdDialogTitle: document.querySelector('#birdDialogTitle'),
    birdCloseButton: document.querySelector('#birdCloseButton'),
    birdSearchInput: document.querySelector('#birdSearchInput'),
    birdResults: document.querySelector('#birdResults'),
    birdSelectedInfo: document.querySelector('#birdSelectedInfo'),
    birdCountMinus: document.querySelector('#birdCountMinus'),
    birdCountPlus: document.querySelector('#birdCountPlus'),
    birdCountValue: document.querySelector('#birdCountValue'),
    birdNoteInput: document.querySelector('#birdNoteInput'),
    birdSubmitButton: document.querySelector('#birdSubmitButton'),
    birdDeleteButton: document.querySelector('#birdDeleteButton'),
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
        enableStageFallbackClick();
        render();
        elements.hintStrip.textContent = `${tileProvider.errorHint} 仍可点击地图区域继续测试流程。`;
        elements.hintStrip.hidden = false;
      });

      tileLayer.addTo(map);
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
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
        addFinishedSessionToHistory(session);
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

    elements.returnHomeButton.addEventListener('click', () => {
      if (selectedHistoryRecordId) {
        selectedHistoryRecordId = null;
        highlightedBirdRecordId = null;
        activeView = 'historyList';
        render();
        return;
      }

      session = stateTools.createSession();
      highlightedBirdRecordId = null;
      activeView = 'main';
      locationHintOverride = '';
      stopGpsTracking();
      clearPersistedSession();
      render();
    });

    elements.profileButton.addEventListener('click', () => {
      activeView = 'profile';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
    });

    elements.historyEntryButton.addEventListener('click', () => {
      activeView = 'historyList';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
    });

    elements.profileBackButton.addEventListener('click', () => {
      activeView = 'main';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
    });

    elements.historyBackButton.addEventListener('click', () => {
      activeView = 'profile';
      selectedHistoryRecordId = null;
      highlightedBirdRecordId = null;
      render();
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

    elements.zoomInButton.addEventListener('click', () => {
      zoomMap(1);
    });

    elements.zoomOutButton.addEventListener('click', () => {
      zoomMap(-1);
    });

    if (map) {
      map.on('click', (event) => {
        handleMapClick({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
        });
      });

      map.on('zoomend moveend', () => {
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
    locationHintOverride = message;
    render();
  }

  function render() {
    const activeResult = getActiveResult();
    const isResultView = Boolean(activeResult);
    const isHistoryResult = Boolean(selectedHistoryRecordId && activeResult);
    const isProfileView = activeView === 'profile';
    const isHistoryListView = activeView === 'historyList';
    const summary = activeResult ? activeResult.summary : stateTools.summarizeSession(session);

    elements.sessionState.textContent = isHistoryResult
      ? '历史'
      : isHistoryListView
        ? '历史'
      : isProfileView
        ? '个人'
        : stateLabel(session.state);
    elements.sessionDistance.textContent = formatDistance(summary.distanceMeters);
    elements.sessionBirds.textContent = `${summary.speciesCount} 种`;

    elements.startPanel.hidden = isProfileView || isHistoryListView || isResultView ||
      (session.state !== stateTools.STATES.IDLE && session.state !== stateTools.STATES.ABORTED);
    elements.profileButton.hidden = isProfileView || isHistoryListView || isResultView ||
      (session.state !== stateTools.STATES.IDLE && session.state !== stateTools.STATES.ABORTED);
    elements.finishButton.hidden = isProfileView || isHistoryListView || isResultView || session.state !== stateTools.STATES.RECORDING;
    elements.finishButton.disabled = session.state !== stateTools.STATES.RECORDING;
    elements.resultPanel.hidden = !isResultView;
    elements.profilePanel.hidden = !isProfileView;
    elements.historyPanel.hidden = !isHistoryListView;
    elements.mapFallback.dataset.mode = isResultView ? stateTools.STATES.FINISHED : session.state;
    elements.mapStage.classList.toggle('is-result-mode', isResultView);
    elements.birdNameToggle.setAttribute('aria-pressed', showBirdNames ? 'true' : 'false');

    if (!isProfileView && !isHistoryListView && !isResultView && canUseSimulatedFallbackStart()) {
      elements.addBirdButton.textContent = '使用测试起点';
      elements.addBirdButton.disabled = false;
    } else {
      elements.addBirdButton.textContent = '添加鸟种';
      elements.addBirdButton.disabled = isProfileView || isHistoryListView || isResultView || session.state !== stateTools.STATES.RECORDING;
    }
    elements.addBirdButton.hidden = isProfileView || isHistoryListView || isResultView;

    if (isProfileView || isHistoryListView || isResultView) {
      elements.hintStrip.hidden = true;
    } else if (session.state === stateTools.STATES.PICKING_START) {
      elements.hintStrip.textContent = locationHintOverride ||
        (config.locationSource === 'gps' ? config.mapInteraction.gpsPendingHint : config.mapInteraction.pickingHint);
      elements.hintStrip.hidden = false;
    } else if (session.state === stateTools.STATES.RECORDING) {
      elements.hintStrip.textContent = locationHintOverride ||
        (config.locationSource === 'gps' ? config.mapInteraction.gpsRecordingHint : config.mapInteraction.recordingHint);
      elements.hintStrip.hidden = false;
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
  }

  function renderResultView() {
    const result = getActiveResult();
    if (!result) {
      elements.resultBirdList.replaceChildren();
      return;
    }

    elements.resultTitle.textContent = selectedHistoryRecordId ? '历史记录' : result.title;
    elements.resultMeta.textContent = formatResultMeta(result);
    elements.resultDuration.textContent = formatDuration(result.summary.durationMinutes);
    elements.resultDistance.textContent = formatDistance(result.summary.distanceMeters);
    elements.resultSpecies.textContent = `${result.summary.speciesCount} 种`;
    elements.resultBirdTotal.textContent = `${result.summary.totalBirds} 只`;
    elements.resultListCount.textContent = `${result.summary.birdRecordCount} 条`;
    elements.returnHomeButton.textContent = selectedHistoryRecordId ? '返回历史列表' : '返回主界面';

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

      const title = document.createElement('strong');
      title.textContent = `${record.speciesName} × ${record.count}`;

      const detail = document.createElement('span');
      detail.textContent = birdRecordDetail(record);

      button.append(title, detail);
      button.addEventListener('click', () => {
        focusBirdRecord(record);
      });

      return button;
    }));
  }

  function renderProfileView() {
    elements.historyCount.textContent = `${history.length} 条`;
    elements.historyEmpty.hidden = history.length > 0;

    if (history.length === 0) {
      elements.historyList.replaceChildren();
      return;
    }

    elements.historyList.replaceChildren(...history.map((record) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-item';

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
        `${record.summary.totalBirds} 只`,
      ].forEach((text) => {
        const item = document.createElement('em');
        item.textContent = text;
        metrics.appendChild(item);
      });

      button.append(title, detail, metrics);
      button.addEventListener('click', () => {
        openHistoryRecord(record.id);
      });

      return button;
    }));
  }

  function getActiveResult() {
    if (selectedHistoryRecordId) {
      return stateTools.findHistoryRecord(history, selectedHistoryRecordId);
    }

    return stateTools.createSessionResult(session);
  }

  function getMapSource() {
    const activeResult = getActiveResult();
    if (activeResult) {
      return activeResult;
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
    activeView = 'historyResult';
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
    const place = result.startPoint && result.startPoint.label
      ? result.startPoint.label
      : '起点附近';

    return `${date} · ${place}`;
  }

  function formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes} 分钟`;
    }

    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
  }

  function birdRecordDetail(record) {
    const tags = record.tags.length ? record.tags.join('、') : '';
    const note = record.note || '';
    const parts = [record.scientificName, tags, note].filter(Boolean);

    return parts.length ? parts.join(' · ') : '无备注';
  }

  function focusBirdRecord(record) {
    highlightedBirdRecordId = record.id;

    if (map && !stageFallbackClickEnabled) {
      map.panTo([record.position.lat, record.position.lng]);
    }

    renderBirdPointOverlay();
    renderResultView();
  }

  function openBirdDialog(record = null) {
    birdDraft = createBirdDraft(record);
    elements.birdDialogTitle.textContent = record ? '编辑鸟点' : '添加鸟种';
    elements.birdSearchInput.value = record ? record.speciesName : '';
    elements.birdNoteInput.value = record ? record.note : '';
    elements.birdSubmitButton.textContent = record ? '保存修改' : '添加到当前位置';
    elements.birdDeleteButton.hidden = !record;
    renderBirdResults(elements.birdSearchInput.value);
    renderBirdDraft();

    if (elements.birdDialog.showModal) {
      elements.birdDialog.showModal();
      elements.birdSearchInput.focus();
    }
  }

  function renderBirdResults(query) {
    const normalizedQuery = query.trim().toLowerCase();
    const birds = window.BIRD_CATALOG
      .filter((bird) => {
        if (!normalizedQuery) {
          return true;
        }

        return bird.name.toLowerCase().includes(normalizedQuery) ||
          bird.scientificName.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 6);

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
    elements.birdCountValue.textContent = String(birdDraft.count);
    elements.birdSelectedInfo.textContent = birdDraft.selectedBird
      ? `已选择：${birdDraft.selectedBird.name}（${birdDraft.selectedBird.scientificName}）`
      : '请选择一个鸟种。';

    elements.tagToggles.forEach((button) => {
      button.classList.toggle('is-selected', birdDraft.tags.includes(button.dataset.tag));
    });

    elements.birdSubmitButton.disabled = !birdDraft.selectedBird;
  }

  function submitBirdRecord() {
    if (!birdDraft.selectedBird) {
      elements.birdSelectedInfo.textContent = '请先选择一个鸟种。';
      return;
    }

    const payload = {
      speciesName: birdDraft.selectedBird.name,
      scientificName: birdDraft.selectedBird.scientificName,
      count: birdDraft.count,
      tags: birdDraft.tags,
      note: elements.birdNoteInput.value.trim(),
    };

    session = birdDraft.editingRecordId
      ? stateTools.updateBirdRecord(session, birdDraft.editingRecordId, payload)
      : stateTools.addBirdRecord(session, payload);
    persistSession(session);
    elements.birdDialog.close();
    render();
    elements.hintStrip.textContent = birdDraft.editingRecordId
      ? `已更新：${birdDraft.selectedBird.name}`
      : `已添加：${birdDraft.selectedBird.name}`;
    elements.hintStrip.hidden = false;
  }

  function deleteSelectedBirdRecord() {
    if (!birdDraft.editingRecordId) {
      return;
    }

    session = stateTools.deleteBirdRecord(session, birdDraft.editingRecordId);
    if (highlightedBirdRecordId === birdDraft.editingRecordId) {
      highlightedBirdRecordId = null;
    }
    persistSession(session);
    elements.birdDialog.close();
    render();
    elements.hintStrip.textContent = '已删除鸟点记录';
    elements.hintStrip.hidden = false;
  }

  function createBirdDraft(record = null) {
    if (record) {
      return {
        editingRecordId: record.id,
        selectedBird: {
          name: record.speciesName,
          scientificName: record.scientificName,
        },
        count: record.count,
        tags: [...record.tags],
      };
    }

    return {
      editingRecordId: null,
      selectedBird: null,
      count: 1,
      tags: [],
    };
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

    if (isResultView) {
      // 结果页 / 历史查看：一次性框选完整轨迹，方便概览全程。
      if (latLngs.length > 1) {
        map.fitBounds(routeLayer.getBounds(), {
          paddingTopLeft: [28, 96],
          paddingBottomRight: [28, 128],
          maxZoom: config.defaultZoom,
        });
      } else if (latLngs.length === 1) {
        map.setView(latLngs[0], config.defaultZoom);
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
      if (group.records.some((record) => record.id === highlightedBirdRecordId)) {
        button.classList.add('is-highlighted');
      }

      button.style.left = `${group.x}px`;
      button.style.top = `${group.y}px`;
      button.textContent = birdPointLabel(group);
      button.addEventListener('click', () => {
        if (selectedHistoryRecordId) {
          focusBirdRecord(group.records[0]);
        } else {
          openBirdPointPreview(group.records);
        }
      });
      elements.birdPointLayer.appendChild(button);
    });
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

    return showBirdNames ? group.records[0].speciesName : '';
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
      const tags = record.tags.length ? ` · ${record.tags.join('、')}` : '';
      const note = record.note ? ` · ${record.note}` : '';

      const title = document.createElement('strong');
      title.textContent = `${record.speciesName} × ${record.count}`;
      const detail = document.createElement('span');
      detail.textContent = `${record.scientificName}${tags}${note}`;
      button.append(title, detail);

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

  function zoomMap(direction) {
    if (map && !stageFallbackClickEnabled) {
      if (direction > 0) {
        map.zoomIn();
      } else {
        map.zoomOut();
      }
      return;
    }

    fallbackScale = clamp(fallbackScale + direction * 0.25, 0.75, 2.5);
    render();
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

    addFinishedSessionToHistory(session, dateFromIso(session.endedAt));
  }

  function addFinishedSessionToHistory(value, savedAt = new Date()) {
    const record = stateTools.createHistoryRecord(value, savedAt);
    if (!record) {
      return;
    }

    history = stateTools.addHistoryRecord(history, record);
    persistHistory(history);
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
