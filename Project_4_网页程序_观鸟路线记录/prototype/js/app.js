(function attachApp() {
  const config = window.CONFIG;
  const stateTools = window.BirdRouteState;
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

    const tileLayer = L.tileLayer(config.tileLayer.url, {
      attribution: config.tileLayer.attribution,
      maxZoom: 19,
    });

    tileLayer.on('tileerror', () => {
      enableStageFallbackClick();
      render();
      elements.hintStrip.textContent = `${config.tileLayer.errorHint} 仍可点击地图区域继续测试流程。`;
      elements.hintStrip.hidden = false;
    });

    tileLayer.addTo(map);

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

  function bindEvents() {
    elements.startButton.addEventListener('click', () => {
      session = stateTools.beginStartSelection(session);
      const point = config.defaultCenter;
      if (map) {
        map.setView([point.lat, point.lng], config.defaultZoom);
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
        session = stateTools.finishSession(session);
        highlightedBirdRecordId = null;
        persistSession(session);
      }

      if (elements.finishDialog.returnValue === 'abort') {
        session = stateTools.abortSession(session);
        highlightedBirdRecordId = null;
        clearPersistedSession();
      }

      render();
    });

    elements.returnHomeButton.addEventListener('click', () => {
      session = stateTools.createSession();
      highlightedBirdRecordId = null;
      render();
    });

    elements.addBirdButton.addEventListener('click', () => {
      if (session.state === stateTools.STATES.PICKING_START && stageFallbackClickEnabled) {
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

  function render() {
    const summary = stateTools.summarizeSession(session);
    const isFinished = session.state === stateTools.STATES.FINISHED;
    elements.sessionState.textContent = stateLabel(session.state);
    elements.sessionDistance.textContent = formatDistance(summary.distanceMeters);
    elements.sessionBirds.textContent = `${summary.speciesCount} 种`;

    elements.startPanel.hidden = session.state !== stateTools.STATES.IDLE && session.state !== stateTools.STATES.ABORTED;
    elements.finishButton.hidden = isFinished;
    elements.finishButton.disabled = session.state !== stateTools.STATES.RECORDING;
    elements.resultPanel.hidden = !isFinished;
    elements.mapFallback.dataset.mode = session.state;
    elements.mapStage.classList.toggle('is-result-mode', isFinished);
    elements.birdNameToggle.setAttribute('aria-pressed', showBirdNames ? 'true' : 'false');

    if (session.state === stateTools.STATES.PICKING_START && stageFallbackClickEnabled) {
      elements.addBirdButton.textContent = '使用测试起点';
      elements.addBirdButton.disabled = false;
    } else {
      elements.addBirdButton.textContent = '添加鸟种';
      elements.addBirdButton.disabled = session.state !== stateTools.STATES.RECORDING;
    }
    elements.addBirdButton.hidden = isFinished;

    if (session.state === stateTools.STATES.PICKING_START) {
      elements.hintStrip.textContent = config.mapInteraction.pickingHint;
      elements.hintStrip.hidden = false;
    } else if (session.state === stateTools.STATES.RECORDING) {
      elements.hintStrip.textContent = config.mapInteraction.recordingHint;
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
  }

  function renderResultView() {
    const result = stateTools.createSessionResult(session);
    if (!result) {
      return;
    }

    elements.resultTitle.textContent = result.title;
    elements.resultMeta.textContent = formatResultMeta(result);
    elements.resultDuration.textContent = formatDuration(result.summary.durationMinutes);
    elements.resultDistance.textContent = formatDistance(result.summary.distanceMeters);
    elements.resultSpecies.textContent = `${result.summary.speciesCount} 种`;
    elements.resultBirdTotal.textContent = `${result.summary.totalBirds} 只`;
    elements.resultListCount.textContent = `${result.summary.birdRecordCount} 条`;

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
      button.innerHTML = `<strong>${bird.name}</strong><span>${bird.scientificName}</span>`;
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

    const latLngs = session.track.map((point) => [point.lat, point.lng]);
    routeLayer.setLatLngs(latLngs);
    routeLayer.bringToFront();

    if (!session.startPoint && startMarker) {
      startMarker.remove();
      startMarker = null;
    }

    if (!session.currentPoint && currentMarker) {
      currentMarker.remove();
      currentMarker = null;
    }

    if (session.startPoint && !startMarker) {
      startMarker = L.circleMarker([session.startPoint.lat, session.startPoint.lng], {
        radius: 7,
        color: '#123f31',
        fillColor: '#f8f5ee',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    if (startMarker && session.startPoint) {
      startMarker.setLatLng([session.startPoint.lat, session.startPoint.lng]);
    }

    if (session.currentPoint && !currentMarker) {
      currentMarker = L.circleMarker([session.currentPoint.lat, session.currentPoint.lng], {
        radius: 8,
        color: '#ffffff',
        fillColor: '#c1842b',
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    if (currentMarker && session.currentPoint) {
      currentMarker.setLatLng([session.currentPoint.lat, session.currentPoint.lng]);
    }

    if (latLngs.length > 1) {
      map.fitBounds(routeLayer.getBounds(), {
        paddingTopLeft: [28, 96],
        paddingBottomRight: [28, 128],
        maxZoom: config.defaultZoom,
      });
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

    const points = session.track.map(pointToFallbackPosition);
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

    if (!stageFallbackClickEnabled || session.track.length === 0) {
      return;
    }

    const points = session.track.map(pointToFallbackPosition);
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
    if (session.birdRecords.length === 0) {
      return;
    }

    const groups = groupBirdRecordsByScreenPosition(session.birdRecords);
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
        openBirdPointPreview(group.records);
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
      button.innerHTML = `<strong>${record.speciesName} × ${record.count}</strong><span>${record.scientificName}${tags}${note}</span>`;
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
    return session.state === stateTools.STATES.PICKING_START ||
      (session.state === stateTools.STATES.RECORDING && config.locationSource === 'simulated');
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
})();
