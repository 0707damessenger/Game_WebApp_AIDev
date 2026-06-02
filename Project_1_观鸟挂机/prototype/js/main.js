(function () {
  const canvas = document.getElementById('scene-canvas');
  const ctx = canvas.getContext('2d');

  // 游戏状态
  const state = {
    camera: { x: 0, y: 0, angle: 0 },
    terrain: 'stream_forest',
  };

  // 初始化摄像机位置（居中）
  function initCamera() {
    const container = document.getElementById('scene-container');
    state.camera.x = container.clientWidth / 2;
    state.camera.y = container.clientHeight / 2;
  }

  // 调整画布大小
  function resize() {
    const container = document.getElementById('scene-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    render();
  }

  // 渲染
  function render() {
    Terrain.drawScene(ctx, state.camera, state.terrain);
    updateStatusBar();
    updateScore();
  }

  // 更新状态栏
  function updateStatusBar() {
    const terrainCfg = CONFIG.TERRAINS[state.terrain];
    document.getElementById('terrain-name').textContent =
      '地形: ' + terrainCfg.name;
    document.getElementById('camera-info').textContent =
      '📷 镜头: (' + Math.round(state.camera.x) + ', ' + Math.round(state.camera.y) + ') ' +
      Math.round(state.camera.angle * 180 / Math.PI) + '°';
  }

  // 更新积分显示
  function updateScore() {
    const saveData = Storage.load();
    document.getElementById('score-value').textContent = saveData.score;
  }

  // 暴露给后续模块
  window.gameState = state;
  window.gameRender = render;

  // 启动
  initCamera();
  window.addEventListener('resize', resize);
  resize();

  // ===== 摄像机控制 =====
  let isDragging = false;
  let isRotating = false;
  let lastMouse = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0) {
      isDragging = true;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      canvas.style.cursor = 'grabbing';
    } else if (e.button === 2) {
      isRotating = true;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('mousemove', function (e) {
    if (isDragging) {
      state.camera.x += e.clientX - lastMouse.x;
      state.camera.y += e.clientY - lastMouse.y;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      render();
    }
    if (isRotating) {
      state.camera.angle += (e.clientX - lastMouse.x) * CONFIG.CAMERA_ROTATE_SPEED;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      render();
    }
  });

  window.addEventListener('mouseup', function () {
    isDragging = false;
    isRotating = false;
    canvas.style.cursor = 'grab';
  });

  canvas.style.cursor = 'grab';

  // ===== 物件面板 =====
  function renderObjectPanel(category) {
    const list = document.getElementById('object-list');
    list.innerHTML = '';

    const saveData = Storage.load();
    const unlocked = saveData.unlockedObjects;

    Object.entries(CONFIG.OBJECTS).forEach(function (entry) {
      var key = entry[0];
      var obj = entry[1];
      if (obj.category !== category) return;

      var div = document.createElement('div');
      div.className = 'object-item' + (unlocked.includes(key) ? '' : ' locked');
      div.textContent = obj.icon + ' ' + obj.name;
      div.draggable = unlocked.includes(key);

      if (unlocked.includes(key)) {
        div.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', key);
        });
      }

      list.appendChild(div);
    });
  }

  function placeObject(type, gridX, gridY) {
    var saveData = Storage.load();
    saveData.placedObjects.push({ type: type, gridX: gridX, gridY: gridY });
    Storage.save(saveData);
    render();
  }

  canvas.addEventListener('dragover', function (e) { e.preventDefault(); });

  canvas.addEventListener('drop', function (e) {
    e.preventDefault();
    var objType = e.dataTransfer.getData('text/plain');
    if (!objType) return;

    var rect = canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left;
    var sy = e.clientY - rect.top;
    var grid = Iso.screenToGrid(sx, sy, state.camera);

    if (grid.gx >= 0 && grid.gx < CONFIG.GRID_COLS &&
        grid.gy >= 0 && grid.gy < CONFIG.GRID_ROWS) {
      placeObject(objType, grid.gx, grid.gy);
    }
  });

  // 初始化物件面板
  renderObjectPanel('plants');

  // 标签切换
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderObjectPanel(btn.dataset.tab);
    });
  });

  // 物件渲染（在 drawScene 中调用）
  window.drawPlacedObjects = function (ctx, camera) {
    var saveData = Storage.load();
    var placed = saveData.placedObjects;

    placed.forEach(function (placedObj) {
      var objCfg = CONFIG.OBJECTS[placedObj.type];
      if (!objCfg) return;

      var pos = Iso.gridToScreen(placedObj.gridX, placedObj.gridY, camera);
      var cx = pos.x;
      var cy = pos.y - objCfg.height / 2;

      // 树干（矩形）
      ctx.fillStyle = objCfg.color;
      ctx.fillRect(
        cx - objCfg.width / 4,
        cy - objCfg.height / 3,
        objCfg.width / 2,
        objCfg.height * 0.6
      );

      // 树冠/顶部（圆形）
      ctx.beginPath();
      ctx.arc(cx, cy - objCfg.height / 3, objCfg.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = objCfg.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  };

  // 重写 Terrain.drawPlacedObjects 以使用 main.js 中的实现
  Terrain.drawPlacedObjects = function (ctx, camera) {
    window.drawPlacedObjects(ctx, camera);
  };

  // ===== 打开取景器小窗口 =====
  document.getElementById('open-viewer-btn').addEventListener('click', function () {
    window.open('viewer.html', 'viewfinder',
      'width=420,height=380,left=100,top=100,resizable=yes');
  });

  // 摄像机状态同步到 localStorage
  var originalRender = render;
  render = function () {
    originalRender();
    var saveData = Storage.load();
    localStorage.setItem('birdwatching_camera', JSON.stringify({
      camera: state.camera,
      terrain: state.terrain,
      placedObjects: saveData.placedObjects,
    }));
  };
  window.gameRender = render;

  // ===== 鸟类生成 =====
  Birds.startSpawnLoop();

  // 鸟类数据同步到 localStorage（供小窗口读取）
  window.birdsSyncInterval = setInterval(function () {
    localStorage.setItem('birdwatching_active_birds', JSON.stringify(Birds.activeBirds));
  }, 1000);

  // ===== 地形切换 =====
  var terrainKeys = Object.keys(CONFIG.TERRAINS);
  var terrainIndex = terrainKeys.indexOf(state.terrain);

  document.getElementById('terrain-switch-btn').addEventListener('click', function () {
    var saveData = Storage.load();
    terrainIndex = (terrainIndex + 1) % terrainKeys.length;
    var nextTerrain = terrainKeys[terrainIndex];

    if (saveData.unlockedTerrains.includes(nextTerrain)) {
      state.terrain = nextTerrain;
      saveData.currentTerrain = nextTerrain;
      Storage.save(saveData);
      render();
    } else {
      alert('该地形未解锁！需要积分来解锁。');
    }
  });

  // ===== 图鉴弹窗 =====
  document.getElementById('fieldguide-btn').addEventListener('click', function () {
    var saveData = Storage.load();
    var birdIds = Object.keys(CONFIG.BIRDS);
    var html = '<div style="padding:16px;max-height:60vh;overflow-y:auto;">';
    html += '<h3 style="color:#f0a500;margin-bottom:12px;">📖 鸟类图鉴</h3>';

    birdIds.forEach(function (id) {
      var bird = CONFIG.BIRDS[id];
      var discovered = saveData.fieldGuide[id] && saveData.fieldGuide[id].discovered;
      html += '<div style="display:flex;align-items:center;gap:8px;padding:6px;margin:4px 0;background:' +
        (discovered ? '#1a3a1a' : '#1a1a1a') + ';border-radius:4px;">';
      html += '<span style="font-size:24px;">' + (discovered ? bird.icon : '❓') + '</span>';
      html += '<span style="color:' + (discovered ? '#fff' : '#666') + ';">' +
        (discovered ? bird.name : '???') + '</span>';
      if (discovered) {
        html += '<span style="margin-left:auto;color:#888;font-size:11px;">已发现</span>';
      }
      html += '</div>';
    });

    html += '</div>';
    var popup = window.open('', 'fieldguide', 'width=320,height=500,left=200,top=100');
    popup.document.write(
      '<html><head><title>鸟类图鉴</title>' +
      '<style>body{font-family:system-ui,sans-serif;background:#111;color:#ccc;margin:0;}</style>' +
      '</head><body>' + html + '</body></html>'
    );
  });
})();