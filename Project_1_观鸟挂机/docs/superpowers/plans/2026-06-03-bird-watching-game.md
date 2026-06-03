# 观鸟挂机游戏 — 实施计划

> ⚠️ **冻结过程稿，非真相源。** 本计划为一次性实施记录，不再维护。模块结构以 [design.md](../../design.md) 为准，配置数值以 `prototype/js/config.js` 为准；本文内的示例代码与数值可能已与实现漂移，仅供回溯。

> **For agentic workers:** 按任务顺序逐个实现，每步使用 checkbox（`- [ ]`）跟踪进度。每个模块完成后在浏览器中验证通过再推进下一个。

**Goal:** 实现观鸟桌面挂机游戏的网页原型，包含等距场景编辑、物件摆放、摄像机控制、双窗口取景器、鸟类概率生成、拍照图鉴和积分解锁系统。

**Architecture:** 纯前端 HTML/CSS/JS 单页应用，Canvas 渲染等距场景。主窗口 `index.html` 为场景编辑器，弹出窗口 `viewer.html` 为取景器。两窗口通过 `localStorage` 通信。所有配置集中在 `CONFIG` 对象中。

**Tech Stack:** HTML5 Canvas, vanilla JavaScript, CSS, localStorage

---

## 文件结构

```
prototype/
├── index.html          # 主窗口（场景编辑器）
├── viewer.html         # 小窗口（取景器/观察窗）
├── css/
│   └── style.css       # 公共样式
└── js/
    ├── config.js       # 全局 CONFIG 对象
    ├── isometric.js    # 等距坐标变换、地块渲染
    ├── terrain.js      # 地形模板渲染
    ├── objects.js      # 物件数据、摆放逻辑
    ├── camera.js       # 摄像机平移/旋转/视口变换
    ├── birds.js        # 鸟类数据、概率判定、生成
    ├── fieldguide.js   # 图鉴数据、拍照判定、解锁
    └── storage.js      # localStorage 读写、积分管理
```

---

### Task 1: 项目骨架搭建

**Files:**
- Create: `prototype/index.html`
- Create: `prototype/css/style.css`
- Create: `prototype/js/config.js`
- Create: `prototype/js/storage.js`

- [ ] **Step 1: 创建 index.html 骨架**

创建 `prototype/index.html`，包含 HTML 结构、CONFIG 对象、CSS 引用和 JS 引用：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>观鸟挂机 — 场景编辑器</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app">
    <!-- 顶部工具栏 -->
    <div id="toolbar">
      <div id="tab-buttons">
        <button class="tab-btn active" data-tab="plants">🌿 植物</button>
        <button class="tab-btn" data-tab="insects">🦋 昆虫</button>
        <button class="tab-btn" data-tab="facilities">🏠 设施</button>
      </div>
      <div id="score-display">★ 积分: <span id="score-value">0</span></div>
    </div>
    <!-- 左侧物件面板 -->
    <div id="object-panel">
      <div id="object-list"></div>
    </div>
    <!-- 场景画布 -->
    <div id="scene-container">
      <canvas id="scene-canvas"></canvas>
    </div>
    <!-- 底部状态栏 -->
    <div id="status-bar">
      <span id="terrain-name">地形: 溪流/森林</span>
      <span id="camera-info">📷 镜头: (0, 0) 0°</span>
    </div>
  </div>

  <script>
    // ===== CONFIG =====
    const CONFIG = {
      // 场景
      GRID_COLS: 10,
      GRID_ROWS: 10,
      TILE_WIDTH: 80,
      TILE_HEIGHT: 40,

      // 摄像机
      CAMERA_PAN_SPEED: 0.5,
      CAMERA_ROTATE_SPEED: 0.02,

      // 判定周期（毫秒）
      SPAWN_INTERVAL: 30000,

      // 积分
      FIRST_PHOTO_REWARD: 100,
      REPEAT_PHOTO_REWARD: 10,
    };
  </script>
  <script src="js/config.js"></script>
  <script src="js/storage.js"></script>
  <script src="js/isometric.js"></script>
  <script src="js/terrain.js"></script>
  <script src="js/objects.js"></script>
  <script src="js/camera.js"></script>
  <script src="js/birds.js"></script>
  <script src="js/fieldguide.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 style.css**

创建 `prototype/css/style.css`：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #1a1a2e;
  color: #ccc;
  overflow: hidden;
  height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* 顶部工具栏 */
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
}

#tab-buttons { display: flex; gap: 4px; }

.tab-btn {
  padding: 6px 14px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #aaa;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.tab-btn.active {
  background: #0f3460;
  color: #fff;
  border-color: #e94560;
}

.tab-btn:hover { background: #16213e; }

#score-display {
  margin-left: auto;
  color: #f0a500;
  font-weight: 600;
  font-size: 14px;
}

/* 主体区域 */
#main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 物件面板 */
#object-panel {
  width: 140px;
  background: #16213e;
  border-right: 1px solid #0f3460;
  padding: 8px;
  overflow-y: auto;
  flex-shrink: 0;
}

.object-item {
  padding: 8px;
  margin: 4px 0;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  cursor: grab;
  font-size: 12px;
  color: #ccc;
  user-select: none;
}

.object-item:hover { background: #0f3460; }

.object-item.locked {
  opacity: 0.4;
  cursor: not-allowed;
  color: #666;
}

.object-item.locked:hover { background: #1a1a2e; }

/* 场景容器 */
#scene-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #1a1a2e;
}

#scene-canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* 底部状态栏 */
#status-bar {
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  background: #16213e;
  border-top: 1px solid #0f3460;
  font-size: 12px;
  color: #888;
  flex-shrink: 0;
}
```

- [ ] **Step 3: 创建 config.js 基础结构**

创建 `prototype/js/config.js`，将 CONFIG 从 HTML 内联提取到独立文件（后续模块会扩展）：

```js
// CONFIG 已在 index.html 中定义，此处为扩展预留
// 后续模块将在此文件中添加生物、物件、地形等配置数据
```

- [ ] **Step 4: 创建 storage.js**

创建 `prototype/js/storage.js`：

```js
const Storage = {
  _key: 'birdwatching_game',

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : this.defaults();
    } catch (e) {
      return this.defaults();
    }
  },

  save(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },

  defaults() {
    return {
      score: 0,
      currentTerrain: 'stream_forest',
      placedObjects: [],       // { type, gridX, gridY }
      unlockedObjects: ['broadleaf_tree', 'conifer_tree', 'bush', 'butterfly'],
      unlockedTerrains: ['stream_forest'],
      fieldGuide: {},          // { birdId: { discovered: bool, timestamp: number } }
    };
  }
};
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`，确认页面骨架正确渲染：
- 顶部工具栏可见（植物/昆虫/设施标签 + 积分显示）
- 左侧物件面板预留
- 中央场景区域为深色背景
- 底部状态栏显示地形和镜头信息

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/
git commit -m "完成项目骨架搭建：index.html骨架、样式、CONFIG和storage基础结构"
```

---

### Task 2: 等距场景渲染引擎

**Files:**
- Create: `prototype/js/isometric.js`
- Create: `prototype/js/terrain.js`
- Create: `prototype/js/main.js`
- Modify: `prototype/js/config.js` - 添加地形配置
- Modify: `prototype/index.html` - 确认 main.js 引用

- [ ] **Step 1: 更新 config.js 添加地形配置**

修改 `prototype/js/config.js`：

```js
// 地形配置
CONFIG.TERRAINS = {
  stream_forest: {
    name: '溪流/森林',
    groundColor: '#4a7c3f',
    groundColorAlt: '#3d6b34',
    waterColor: '#4a90d9',
    feature: 'stream',
  },
  swamp_wetland: {
    name: '沼泽/湿地',
    groundColor: '#5a6b3a',
    groundColorAlt: '#4a5a2e',
    waterColor: '#3a6b4a',
    feature: 'swamp',
  },
  mudflat_coast: {
    name: '滩涂/海岸',
    groundColor: '#c4b896',
    groundColorAlt: '#b0a080',
    waterColor: '#5b8cbc',
    feature: 'coast',
  },
  plateau_mountain: {
    name: '高原/山地',
    groundColor: '#8a7a6a',
    groundColorAlt: '#7a6a5a',
    waterColor: '#6a8a9a',
    feature: 'mountain',
  },
};
```

- [ ] **Step 2: 创建 isometric.js 等距坐标变换**

创建 `prototype/js/isometric.js`：

```js
// 等距坐标工具
const Iso = {
  // 网格坐标 → 屏幕坐标（等距投影）
  gridToScreen(gx, gy, camera) {
    const cx = camera.x;
    const cy = camera.y;
    const angle = camera.angle || 0;
    const tw = CONFIG.TILE_WIDTH;
    const th = CONFIG.TILE_HEIGHT;

    // 旋转前的基础等距投影
    const sx = (gx - gy) * (tw / 2);
    const sy = (gx + gy) * (th / 2);

    // 应用旋转
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = sx * cos - sy * sin;
    const ry = sx * sin + sy * cos;

    return {
      x: rx + cx,
      y: ry + cy,
    };
  },

  // 屏幕坐标 → 网格坐标（逆变换，用于点击检测）
  screenToGrid(sx, sy, camera) {
    const cx = camera.x;
    const cy = camera.y;
    const angle = camera.angle || 0;
    const tw = CONFIG.TILE_WIDTH;
    const th = CONFIG.TILE_HEIGHT;

    // 逆旋转
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const rx = (sx - cx) * cos - (sy - cy) * sin;
    const ry = (sx - cx) * sin + (sy - cy) * cos;

    // 逆等距投影
    const gx = (rx / (tw / 2) + ry / (th / 2)) / 2;
    const gy = (ry / (th / 2) - rx / (tw / 2)) / 2;

    return {
      gx: Math.round(gx),
      gy: Math.round(gy),
    };
  },

  // 获取场景中心屏幕坐标
  getSceneCenter(camera) {
    const cols = CONFIG.GRID_COLS;
    const rows = CONFIG.GRID_ROWS;
    return this.gridToScreen(cols / 2, rows / 2, camera);
  },
};
```

- [ ] **Step 3: 创建 terrain.js 地形渲染**

创建 `prototype/js/terrain.js`：

```js
const Terrain = {
  // 渲染单个地块
  drawTile(ctx, gx, gy, camera, terrainCfg) {
    const pos = Iso.gridToScreen(gx, gy, camera);
    const tw = CONFIG.TILE_WIDTH;
    const th = CONFIG.TILE_HEIGHT;

    // 菱形地块
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - th / 2);
    ctx.lineTo(pos.x + tw / 2, pos.y);
    ctx.lineTo(pos.x, pos.y + th / 2);
    ctx.lineTo(pos.x - tw / 2, pos.y);
    ctx.closePath();

    // 棋盘格底色
    const isAlt = (gx + gy) % 2 === 0;
    ctx.fillStyle = isAlt ? terrainCfg.groundColor : terrainCfg.groundColorAlt;
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // 渲染整个场景
  drawScene(ctx, camera, terrainKey) {
    const terrainCfg = CONFIG.TERRAINS[terrainKey];
    const cols = CONFIG.GRID_COLS;
    const rows = CONFIG.GRID_ROWS;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 从远到近渲染（先渲染 y 小的行）
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        this.drawTile(ctx, gx, gy, camera, terrainCfg);
      }
    }
  },
};
```

- [ ] **Step 4: 创建 main.js 初始化入口**

创建 `prototype/js/main.js`：

```js
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
  }

  // 更新状态栏
  function updateStatusBar() {
    const terrainCfg = CONFIG.TERRAINS[state.terrain];
    document.getElementById('terrain-name').textContent =
      '地形: ' + terrainCfg.name;
    document.getElementById('camera-info').textContent =
      `📷 镜头: (${Math.round(state.camera.x)}, ${Math.round(state.camera.y)}) ${Math.round(state.camera.angle * 180 / Math.PI)}°`;
  }

  // 启动
  initCamera();
  window.addEventListener('resize', resize);
  resize();

  // 暴露给后续模块
  window.gameState = state;
  window.gameRender = render;
})();
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`，确认：
- 等距菱形网格可见（10x10 棋盘格）
- 棋盘格颜色交替
- 底部状态栏显示地形名称和摄像机坐标
- 调整浏览器窗口大小，画布跟随缩放

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/js/isometric.js Project_1_观鸟挂机/prototype/js/terrain.js Project_1_观鸟挂机/prototype/js/main.js Project_1_观鸟挂机/prototype/js/config.js
git commit -m "完成等距场景渲染引擎：等距坐标变换、地形棋盘格渲染、画布自适应"
```

---

### Task 3: 摄像机平移与旋转

**Files:**
- Create: `prototype/js/camera.js`
- Modify: `prototype/js/main.js` - 集成摄像机控制

- [ ] **Step 1: 创建 camera.js**

创建 `prototype/js/camera.js`：

```js
const Camera = {
  init(canvas) {
    const state = window.gameState;

    // 鼠标拖拽平移
    let isDragging = false;
    let lastMouse = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // 左键
        isDragging = true;
        lastMouse.x = e.clientX;
        lastMouse.y = e.clientY;
        canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      state.camera.x += dx;
      state.camera.y += dy;
      lastMouse.x = e.clientX;
      lastMouse.y = e.clientY;
      window.gameRender();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      canvas.style.cursor = 'grab';
    });

    // 右键拖拽旋转
    let isRotating = false;
    let lastRotateX = 0;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // 右键
        isRotating = true;
        lastRotateX = e.clientX;
        canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isRotating) return;
      const dx = e.clientX - lastRotateX;
      state.camera.angle += dx * CONFIG.CAMERA_ROTATE_SPEED;
      lastRotateX = e.clientX;
      window.gameRender();
    });

    window.addEventListener('mouseup', () => {
      isRotating = false;
      canvas.style.cursor = 'grab';
    });

    canvas.style.cursor = 'grab';
  },
};
```

- [ ] **Step 2: 集成到 main.js**

修改 `prototype/js/main.js`，在 `resize()` 调用后添加：

```js
  // 在 resize() 之后添加：
  Camera.init(canvas);
```

- [ ] **Step 3: 浏览器验证**

打开 `prototype/index.html`，确认：
- 鼠标左键拖拽可平移场景
- 鼠标右键拖拽可旋转场景（等距网格绕中心旋转）
- 状态栏中摄像机坐标和角度实时更新
- 平移和旋转后渲染正确，地块无错位

- [ ] **Step 4: 提交**

```bash
git add Project_1_观鸟挂机/prototype/js/camera.js Project_1_观鸟挂机/prototype/js/main.js
git commit -m "完成摄像机平移与旋转控制"
```

---

### Task 4: 物件系统（面板 + 拖放摆放）

**Files:**
- Create: `prototype/js/objects.js`
- Modify: `prototype/js/config.js` - 添加物件配置
- Modify: `prototype/js/terrain.js` - 渲染已摆放物件
- Modify: `prototype/js/main.js` - 集成物件系统

- [ ] **Step 1: 更新 config.js 添加物件配置**

修改 `prototype/js/config.js`，追加：

```js
// 物件配置
CONFIG.OBJECTS = {
  broadleaf_tree:  { name: '阔叶树',   category: 'plants',      icon: '🌳', color: '#3a7d2c', height: 30, width: 24 },
  conifer_tree:    { name: '针叶树',   category: 'plants',      icon: '🌲', color: '#2d5a1e', height: 36, width: 20 },
  bush:            { name: '灌木',     category: 'plants',      icon: '🌿', color: '#5a8a3a', height: 14, width: 16 },
  reed:            { name: '芦苇',     category: 'plants',      icon: '🌾', color: '#8a9a4a', height: 20, width: 8 },
  water_lily:      { name: '睡莲',     category: 'plants',      icon: '🪷', color: '#e87a9a', height: 6,  width: 14 },
  butterfly:       { name: '蝴蝶',     category: 'insects',     icon: '🦋', color: '#f0a0c0', height: 6,  width: 10 },
  dragonfly:       { name: '蜻蜓',     category: 'insects',     icon: '🦟', color: '#4ac0e0', height: 6,  width: 12 },
  squirrel:        { name: '松鼠',     category: 'insects',     icon: '🐿', color: '#c08050', height: 10, width: 10 },
  feeder:          { name: '喂食器',   category: 'facilities',  icon: '🍽', color: '#d4a040', height: 16, width: 12 },
  birdhouse:       { name: '鸟屋',     category: 'facilities',  icon: '🏠', color: '#8b6914', height: 22, width: 14 },
  water_basin:     { name: '水盆',     category: 'facilities',  icon: '🪣', color: '#6a8aaa', height: 8,  width: 16 },
};
```

- [ ] **Step 2: 创建 objects.js**

创建 `prototype/js/objects.js`：

```js
const Objects = {
  // 渲染物件面板
  renderPanel(category) {
    const list = document.getElementById('object-list');
    list.innerHTML = '';

    const saveData = Storage.load();
    const unlocked = saveData.unlockedObjects;

    Object.entries(CONFIG.OBJECTS).forEach(([key, obj]) => {
      if (obj.category !== category) return;

      const div = document.createElement('div');
      div.className = 'object-item' + (unlocked.includes(key) ? '' : ' locked');
      div.textContent = obj.icon + ' ' + obj.name;
      div.draggable = unlocked.includes(key);

      if (unlocked.includes(key)) {
        div.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', key);
        });
      }

      list.appendChild(div);
    });
  },

  // 在场景中渲染已摆放的物件
  drawPlacedObjects(ctx, camera) {
    const saveData = Storage.load();
    const placed = saveData.placedObjects;

    placed.forEach((placedObj) => {
      const objCfg = CONFIG.OBJECTS[placedObj.type];
      if (!objCfg) return;

      const pos = Iso.gridToScreen(placedObj.gridX, placedObj.gridY, camera);
      const tw = CONFIG.TILE_WIDTH;
      const th = CONFIG.TILE_HEIGHT;

      // 物件绘制在地块中心偏上
      const cx = pos.x;
      const cy = pos.y - objCfg.height / 2;

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
  },

  // 放置物件
  placeObject(type, gridX, gridY) {
    const saveData = Storage.load();
    saveData.placedObjects.push({ type, gridX, gridY });
    Storage.save(saveData);
    window.gameRender();
  },

  // 初始化拖放区域
  initDropZone(canvas) {
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const objType = e.dataTransfer.getData('text/plain');
      if (!objType) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const grid = Iso.screenToGrid(sx, sy, window.gameState.camera);

      if (grid.gx >= 0 && grid.gx < CONFIG.GRID_COLS &&
          grid.gy >= 0 && grid.gy < CONFIG.GRID_ROWS) {
        this.placeObject(objType, grid.gx, grid.gy);
      }
    });
  },
};
```

- [ ] **Step 3: 更新 terrain.js 渲染物件**

修改 `prototype/js/terrain.js`，在 `drawScene` 方法的 `clearRect` 之后、地块渲染循环之前添加物件渲染：

```js
  drawScene(ctx, camera, terrainKey) {
    const terrainCfg = CONFIG.TERRAINS[terrainKey];
    const cols = CONFIG.GRID_COLS;
    const rows = CONFIG.GRID_ROWS;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // 先渲染物件（在底层地块之上）
    Objects.drawPlacedObjects(ctx, camera);

    // 从远到近渲染地块
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        this.drawTile(ctx, gx, gy, camera, terrainCfg);
      }
    }
  },
```

- [ ] **Step 4: 更新 main.js 集成物件系统**

修改 `prototype/js/main.js`，在 `Camera.init(canvas)` 之后添加：

```js
  // 初始化物件面板
  Objects.renderPanel('plants');
  Objects.initDropZone(canvas);

  // 标签切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.dataset.tab;
      Objects.renderPanel(category);
    });
  });
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`，确认：
- 左侧物件面板显示植物列表（阔叶树、针叶树、灌木可拖放，芦苇、睡莲锁定）
- 点击顶部标签可切换植物/昆虫/设施分类
- 从面板拖拽物件到场景中，物件出现在对应地块上
- 平移和旋转场景后，物件位置跟随正确

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/js/objects.js Project_1_观鸟挂机/prototype/js/config.js Project_1_观鸟挂机/prototype/js/terrain.js Project_1_观鸟挂机/prototype/js/main.js
git commit -m "完成物件系统：面板渲染、分类切换、拖放摆放、物件渲染"
```

---

### Task 5: 小窗口取景器

**Files:**
- Create: `prototype/viewer.html`
- Modify: `prototype/js/camera.js` - 同步摄像机状态到 localStorage
- Modify: `prototype/js/main.js` - 添加打开小窗口按钮

- [ ] **Step 1: 创建 viewer.html**

创建 `prototype/viewer.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>取景器</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111;
      font-family: 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
      user-select: none;
    }

    #viewfinder {
      flex: 1;
      position: relative;
      overflow: hidden;
      border: 3px solid #333;
      margin: 8px;
      border-radius: 4px;
    }

    #viewfinder::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 2px solid rgba(255,255,255,0.15);
      pointer-events: none;
      z-index: 10;
    }

    /* 取景框十字线 */
    #crosshair {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 11;
    }

    #crosshair::before,
    #crosshair::after {
      content: '';
      position: absolute;
      background: rgba(255,255,255,0.1);
    }

    #crosshair::before {
      left: 50%;
      top: 0;
      bottom: 0;
      width: 1px;
    }

    #crosshair::after {
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
    }

    #controls {
      display: flex;
      gap: 8px;
      padding: 8px;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
    }

    #shutter-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 3px solid #e94560;
      background: #1a1a2e;
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s;
    }

    #shutter-btn:active {
      transform: scale(0.9);
      background: #e94560;
    }

    #shutter-btn:hover {
      border-color: #ff6b81;
    }

    .hint {
      color: #666;
      font-size: 11px;
      padding: 0 8px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div id="viewfinder">
    <canvas id="view-canvas"></canvas>
    <div id="crosshair"></div>
  </div>

  <div class="hint">左键拖拽平移 · 右键拖拽旋转 · 底部按钮拍照</div>

  <div id="controls">
    <button id="shutter-btn" title="拍照">📷</button>
  </div>

  <script>
    const canvas = document.getElementById('view-canvas');
    const ctx = canvas.getContext('2d');

    // 摄像机状态（从 localStorage 读取）
    let camera = { x: 0, y: 0, angle: 0 };
    let terrain = 'stream_forest';
    let placedObjects = [];

    function loadState() {
      try {
        const raw = localStorage.getItem('birdwatching_camera');
        if (raw) {
          const data = JSON.parse(raw);
          camera = data.camera;
          terrain = data.terrain;
          placedObjects = data.placedObjects || [];
        }
      } catch (e) {}
    }

    function resize() {
      const container = document.getElementById('viewfinder');
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      camera.x = canvas.width / 2;
      camera.y = canvas.height / 2;
      render();
    }

    // 简化版渲染（复用等距逻辑）
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 渲染地块
      const cols = 10, rows = 10;
      const tw = 80, th = 40;

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const sx = (gx - gy) * (tw / 2);
          const sy = (gx + gy) * (th / 2);
          const cos = Math.cos(camera.angle);
          const sin = Math.sin(camera.angle);
          const rx = sx * cos - sy * sin + camera.x;
          const ry = sx * sin + sy * cos + camera.y;

          ctx.beginPath();
          ctx.moveTo(rx, ry - th / 2);
          ctx.lineTo(rx + tw / 2, ry);
          ctx.lineTo(rx, ry + th / 2);
          ctx.lineTo(rx - tw / 2, ry);
          ctx.closePath();

          const isAlt = (gx + gy) % 2 === 0;
          ctx.fillStyle = isAlt ? '#4a7c3f' : '#3d6b34';
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 摄像机控制（独立于主窗口）
    let isDragging = false, isRotating = false;
    let lastMouse = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { isDragging = true; lastMouse = { x: e.clientX, y: e.clientY }; }
      else if (e.button === 2) { isRotating = true; lastMouse = { x: e.clientX, y: e.clientY }; }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        camera.x += e.clientX - lastMouse.x;
        camera.y += e.clientY - lastMouse.y;
        lastMouse = { x: e.clientX, y: e.clientY };
        render();
      }
      if (isRotating) {
        camera.angle += (e.clientX - lastMouse.x) * 0.02;
        lastMouse = { x: e.clientX, y: e.clientY };
        render();
      }
    });

    window.addEventListener('mouseup', () => { isDragging = false; isRotating = false; });

    // 定期同步主窗口状态
    setInterval(loadState, 500);

    window.addEventListener('resize', resize);
    resize();
  </script>
</body>
</html>
```

- [ ] **Step 2: 更新 camera.js 同步摄像机状态**

修改 `prototype/js/camera.js`，在 `Camera.init` 方法末尾添加状态同步：

```js
    // 每次渲染后同步摄像机状态到 localStorage
    const originalRender = window.gameRender;
    window.gameRender = function() {
      originalRender();
      // 同步摄像机状态
      const saveData = Storage.load();
      localStorage.setItem('birdwatching_camera', JSON.stringify({
        camera: window.gameState.camera,
        terrain: window.gameState.terrain,
        placedObjects: saveData.placedObjects,
      }));
    };
```

- [ ] **Step 3: 更新 main.js 添加打开小窗口按钮**

修改 `prototype/js/main.js`，在 `#toolbar` 区域添加按钮。修改 `index.html` 的 toolbar：

```html
    <div id="toolbar">
      <div id="tab-buttons">
        <button class="tab-btn active" data-tab="plants">🌿 植物</button>
        <button class="tab-btn" data-tab="insects">🦋 昆虫</button>
        <button class="tab-btn" data-tab="facilities">🏠 设施</button>
      </div>
      <button id="open-viewer-btn" style="padding:6px 14px;border:1px solid #0f3460;background:#1a1a2e;color:#aaa;border-radius:4px;cursor:pointer;font-size:13px;">📷 打开取景器</button>
      <div id="score-display">★ 积分: <span id="score-value">0</span></div>
    </div>
```

在 `main.js` 中添加事件处理：

```js
  // 打开取景器小窗口
  document.getElementById('open-viewer-btn').addEventListener('click', () => {
    window.open('viewer.html', 'viewfinder',
      'width=420,height=380,left=100,top=100,resizable=yes');
  });
```

- [ ] **Step 4: 浏览器验证**

打开 `prototype/index.html`，确认：
- 点击"打开取景器"按钮，弹出独立小窗口
- 小窗口显示与主窗口相同的等距场景
- 小窗口内可独立拖拽平移和旋转
- 主窗口场景变化后，小窗口在 500ms 内同步更新

- [ ] **Step 5: 提交**

```bash
git add Project_1_观鸟挂机/prototype/viewer.html Project_1_观鸟挂机/prototype/js/camera.js Project_1_观鸟挂机/prototype/js/main.js Project_1_观鸟挂机/prototype/index.html
git commit -m "完成小窗口取景器：独立弹出窗口、取景框、同步渲染"
```

---

### Task 6: 生境与鸟类生成

**Files:**
- Create: `prototype/js/birds.js`
- Modify: `prototype/js/config.js` - 添加鸟类和概率配置
- Modify: `prototype/js/terrain.js` - 渲染出现的鸟类
- Modify: `prototype/js/main.js` - 集成鸟类生成循环

- [ ] **Step 1: 更新 config.js 添加鸟类和概率配置**

修改 `prototype/js/config.js`，追加：

```js
// 鸟类配置
CONFIG.BIRDS = {
  egret:        { name: '白鹭',     icon: '🦢', color: '#fff',   baseProb: 0.05 },
  night_heron:  { name: '夜鹭',     icon: '🦩', color: '#445',   baseProb: 0.03 },
  kingfisher:   { name: '翠鸟',     icon: '🐦', color: '#0af',   baseProb: 0.02 },
  wagtail:      { name: '白鹡鸰',   icon: '🐤', color: '#ccc',   baseProb: 0.08 },
  sparrow:      { name: '麻雀',     icon: '🐦', color: '#963',   baseProb: 0.15 },
  woodpecker:   { name: '啄木鸟',   icon: '🪶', color: '#c33',   baseProb: 0.04 },
  eagle:        { name: '鹰',       icon: '🦅', color: '#630',   baseProb: 0.01 },
  seagull:      { name: '海鸥',     icon: '🕊', color: '#ddd',   baseProb: 0.10 },
  crane:        { name: '丹顶鹤',   icon: '🦩', color: '#f00',   baseProb: 0.02 },
  swallow:      { name: '燕子',     icon: '🐦', color: '#009',   baseProb: 0.06 },
};

// 地形-鸟种池映射
CONFIG.TERRAIN_BIRD_POOL = {
  stream_forest:   ['kingfisher', 'wagtail', 'sparrow', 'woodpecker', 'night_heron', 'swallow'],
  swamp_wetland:   ['egret', 'night_heron', 'crane', 'kingfisher', 'wagtail'],
  mudflat_coast:   ['seagull', 'egret', 'wagtail', 'swallow'],
  plateau_mountain:['eagle', 'sparrow', 'woodpecker', 'swallow'],
};

// 物件对鸟类的概率加成
CONFIG.OBJECT_BONUS = {
  reed:           { night_heron: 0.05, egret: 0.01 },
  water_lily:     { egret: 0.03, kingfisher: 0.02 },
  broadleaf_tree: { woodpecker: 0.04, sparrow: 0.03, swallow: 0.02 },
  conifer_tree:   { eagle: 0.02, sparrow: 0.02 },
  bush:           { wagtail: 0.03, sparrow: 0.02 },
  butterfly:      { swallow: 0.03, wagtail: 0.01 },
  dragonfly:      { kingfisher: 0.04, swallow: 0.02 },
  feeder:         { sparrow: 0.05, wagtail: 0.04, woodpecker: 0.02 },
  birdhouse:      { woodpecker: 0.05, sparrow: 0.03, swallow: 0.03 },
  water_basin:    { kingfisher: 0.05, egret: 0.04, wagtail: 0.03 },
};
```

- [ ] **Step 2: 创建 birds.js**

创建 `prototype/js/birds.js`：

```js
const Birds = {
  // 当前在场的鸟类列表
  activeBirds: [],

  // 执行一轮判定
  spawnTick() {
    const state = window.gameState;
    const saveData = Storage.load();
    const pool = CONFIG.TERRAIN_BIRD_POOL[state.terrain] || [];

    // 计算每个物件类型的出现次数
    const objectCounts = {};
    saveData.placedObjects.forEach(obj => {
      objectCounts[obj.type] = (objectCounts[obj.type] || 0) + 1;
    });

    this.activeBirds = [];

    pool.forEach(birdId => {
      const birdCfg = CONFIG.BIRDS[birdId];
      let prob = birdCfg.baseProb;

      // 累加物件加成
      Object.entries(objectCounts).forEach(([objType, count]) => {
        const bonus = (CONFIG.OBJECT_BONUS[objType] || {})[birdId] || 0;
        prob += bonus * count;
      });

      // 上限为 1
      prob = Math.min(prob, 1);

      // 掷骰
      if (Math.random() < prob) {
        this.activeBirds.push({
          id: birdId,
          gridX: Math.floor(Math.random() * CONFIG.GRID_COLS),
          gridY: Math.floor(Math.random() * CONFIG.GRID_ROWS),
        });
      }
    });
  },

  // 渲染在场鸟类
  drawBirds(ctx, camera) {
    this.activeBirds.forEach(bird => {
      const birdCfg = CONFIG.BIRDS[bird.id];
      const pos = Iso.gridToScreen(bird.gridX, bird.gridY, camera);

      // 鸟类图标 + 简单鸟形
      ctx.fillStyle = birdCfg.color;
      ctx.beginPath();
      // 鸟的身体（椭圆）
      ctx.ellipse(pos.x, pos.y - 15, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 头部
      ctx.beginPath();
      ctx.arc(pos.x + 6, pos.y - 18, 4, 0, Math.PI * 2);
      ctx.fill();
      // 翅膀
      ctx.beginPath();
      ctx.moveTo(pos.x - 3, pos.y - 15);
      ctx.lineTo(pos.x - 8, pos.y - 22);
      ctx.lineTo(pos.x + 2, pos.y - 18);
      ctx.fill();
      // 名字标签
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(birdCfg.name, pos.x, pos.y - 26);
    });
  },

  // 启动判定循环
  startSpawnLoop() {
    this.spawnTick();
    setInterval(() => {
      this.spawnTick();
      window.gameRender();
    }, CONFIG.SPAWN_INTERVAL);
  },
};
```

- [ ] **Step 3: 更新 terrain.js 渲染鸟类**

修改 `prototype/js/terrain.js`，在 `drawScene` 方法中地块渲染后添加鸟类渲染：

```js
    // 地块渲染循环之后
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        this.drawTile(ctx, gx, gy, camera, terrainCfg);
      }
    }

    // 渲染鸟类（在最上层）
    Birds.drawBirds(ctx, camera);
```

- [ ] **Step 4: 更新 main.js 启动鸟类生成**

修改 `prototype/js/main.js`，在 `Objects.initDropZone(canvas)` 之后添加：

```js
  Birds.startSpawnLoop();
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`，确认：
- 等待约 30 秒后场景中出现鸟类（带名字标签的彩色鸟形）
- 不同摆放物件组合会影响出现的鸟类种类
- 鸟类在场景中持续可见（直到下次判定）
- 打开取景器小窗口也能看到鸟类

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/js/birds.js Project_1_观鸟挂机/prototype/js/config.js Project_1_观鸟挂机/prototype/js/terrain.js Project_1_观鸟挂机/prototype/js/main.js
git commit -m "完成生境与鸟类生成：概率判定、物件加成、鸟类渲染、周期性刷新"
```

---

### Task 7: 拍照判定与图鉴解锁

**Files:**
- Create: `prototype/js/fieldguide.js`
- Modify: `prototype/viewer.html` - 集成拍照功能和图鉴展示
- Modify: `prototype/js/main.js` - 添加图鉴展示按钮

- [ ] **Step 1: 创建 fieldguide.js**

创建 `prototype/js/fieldguide.js`：

```js
const FieldGuide = {
  // 拍照判定：检查当前视口内是否有鸟
  takePhoto() {
    const saveData = Storage.load();
    const activeBirds = this.getActiveBirds();
    const camera = this.getViewerCamera();

    const captured = [];
    activeBirds.forEach(bird => {
      // 简化判定：鸟在视口中心周围一定范围内即算入镜
      const pos = this.birdToScreen(bird, camera);
      const viewW = 420; // viewer 窗口默认宽
      const viewH = 340; // viewer 窗口默认高
      const margin = 100; // 容差边距

      if (pos.x > -margin && pos.x < viewW + margin &&
          pos.y > -margin && pos.y < viewH + margin) {
        captured.push(bird.id);
      }
    });

    return { captured, timestamp: Date.now() };
  },

  // 从 localStorage 获取当前在场的鸟类
  getActiveBirds() {
    try {
      const raw = localStorage.getItem('birdwatching_active_birds');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  // 获取取景器摄像机状态
  getViewerCamera() {
    try {
      const raw = localStorage.getItem('birdwatching_camera');
      return raw ? JSON.parse(raw).camera : { x: 210, y: 170, angle: 0 };
    } catch (e) {
      return { x: 210, y: 170, angle: 0 };
    }
  },

  // 鸟的网格坐标 → 屏幕坐标
  birdToScreen(bird, camera) {
    const tw = 80, th = 40;
    const sx = (bird.gridX - bird.gridY) * (tw / 2);
    const sy = (bird.gridX + bird.gridY) * (th / 2);
    const cos = Math.cos(camera.angle);
    const sin = Math.sin(camera.angle);
    return {
      x: sx * cos - sy * sin + camera.x,
      y: sx * sin + sy * cos + camera.y,
    };
  },

  // 处理拍照结果并更新图鉴
  processPhoto(photoResult) {
    const saveData = Storage.load();
    let newDiscoveries = 0;
    let totalReward = 0;

    photoResult.captured.forEach(birdId => {
      if (!saveData.fieldGuide[birdId]) {
        // 首次发现
        saveData.fieldGuide[birdId] = {
          discovered: true,
          timestamp: photoResult.timestamp,
        };
        totalReward += CONFIG.FIRST_PHOTO_REWARD;
        newDiscoveries++;
      } else {
        // 重复拍摄
        totalReward += CONFIG.REPEAT_PHOTO_REWARD;
      }
    });

    saveData.score += totalReward;
    Storage.save(saveData);

    return {
      newDiscoveries,
      totalReward,
      captured: photoResult.captured,
      score: saveData.score,
    };
  },
};
```

- [ ] **Step 2: 更新 main.js 同步鸟类数据到 localStorage**

修改 `prototype/js/main.js`，在 `Birds.startSpawnLoop()` 之后添加同步逻辑：

```js
  // 同步鸟类数据到 localStorage（供小窗口读取）
  setInterval(() => {
    localStorage.setItem('birdwatching_active_birds', JSON.stringify(Birds.activeBirds));
  }, 1000);
```

- [ ] **Step 3: 更新 viewer.html 集成拍照功能**

修改 `prototype/viewer.html`，在 `<script>` 标签中添加拍照逻辑。替换快门按钮的事件处理：

```html
  <script>
    // ... 现有代码 ...
    // 在 resize() 调用之后添加：

    // ===== 拍照功能 =====
    const FieldGuide = {
      getActiveBirds() {
        try {
          const raw = localStorage.getItem('birdwatching_active_birds');
          return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
      },

      getViewerCamera() {
        return camera;
      },

      birdToScreen(bird, cam) {
        const tw = 80, th = 40;
        const sx = (bird.gridX - bird.gridY) * (tw / 2);
        const sy = (bird.gridX + bird.gridY) * (th / 2);
        const cos = Math.cos(cam.angle);
        const sin = Math.sin(cam.angle);
        return {
          x: sx * cos - sy * sin + cam.x,
          y: sx * sin + sy * cos + cam.y,
        };
      },

      takePhoto() {
        const activeBirds = this.getActiveBirds();
        const viewW = canvas.width;
        const viewH = canvas.height;
        const margin = 50;

        const captured = [];
        activeBirds.forEach(bird => {
          const pos = this.birdToScreen(bird, camera);
          if (pos.x > -margin && pos.x < viewW + margin &&
              pos.y > -margin && pos.y < viewH + margin) {
            captured.push(bird.id);
          }
        });
        return { captured, timestamp: Date.now() };
      },

      processPhoto(photoResult) {
        try {
          const raw = localStorage.getItem('birdwatching_game');
          const saveData = raw ? JSON.parse(raw) : { score: 0, fieldGuide: {} };
          let newDiscoveries = 0;
          let totalReward = 0;

          photoResult.captured.forEach(birdId => {
            if (!saveData.fieldGuide[birdId] || !saveData.fieldGuide[birdId].discovered) {
              saveData.fieldGuide[birdId] = { discovered: true, timestamp: photoResult.timestamp };
              totalReward += 100;
              newDiscoveries++;
            } else {
              totalReward += 10;
            }
          });

          saveData.score = (saveData.score || 0) + totalReward;
          localStorage.setItem('birdwatching_game', JSON.stringify(saveData));
          return { newDiscoveries, totalReward, captured: photoResult.captured, score: saveData.score };
        } catch (e) {
          return { newDiscoveries: 0, totalReward: 0, captured: [], score: 0 };
        }
      },
    };

    document.getElementById('shutter-btn').addEventListener('click', () => {
      const result = FieldGuide.processPhoto(FieldGuide.takePhoto());
      // 拍照反馈
      const btn = document.getElementById('shutter-btn');
      if (result.newDiscoveries > 0) {
        btn.style.background = '#f0a500';
        btn.textContent = '✨';
        setTimeout(() => {
          btn.style.background = '';
          btn.textContent = '📷';
        }, 1500);
        alert(`发现新鸟类！(${result.newDiscoveries} 种) 获得 ${result.totalReward} 积分`);
      } else if (result.captured.length > 0) {
        btn.style.background = '#4a7';
        btn.textContent = '✓';
        setTimeout(() => {
          btn.style.background = '';
          btn.textContent = '📷';
        }, 800);
        alert(`拍照成功！(${result.captured.length} 种已记录) 获得 ${result.totalReward} 积分`);
      } else {
        btn.style.background = '#c44';
        btn.textContent = '✗';
        setTimeout(() => {
          btn.style.background = '';
          btn.textContent = '📷';
        }, 800);
        alert('画面中没有鸟类，继续等待吧~');
      }
    });
  </script>
```

- [ ] **Step 4: 更新 main.js 同步积分显示**

修改 `prototype/js/main.js`，在 render 函数中更新积分显示：

```js
  function render() {
    Terrain.drawScene(ctx, state.camera, state.terrain);
    updateStatusBar();
    updateScore();
  }

  function updateScore() {
    const saveData = Storage.load();
    document.getElementById('score-value').textContent = saveData.score;
  }
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`：
- 摆放物件，等待鸟类出现
- 打开取景器，调整视角使鸟类入镜
- 点击快门按钮拍照
- 首次拍到新鸟：弹出"发现新鸟类"提示，积分增加
- 重复拍摄已解锁鸟类：积分少量增加
- 无鸟入镜：提示无鸟

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/js/fieldguide.js Project_1_观鸟挂机/prototype/viewer.html Project_1_观鸟挂机/prototype/js/main.js
git commit -m "完成拍照判定与图鉴解锁：入镜检测、首次发现判定、积分奖励、拍照反馈"
```

---

### Task 8: 积分与解锁系统

**Files:**
- Modify: `prototype/js/main.js` - 积分解锁逻辑
- Modify: `prototype/js/objects.js` - 解锁刷新面板
- Modify: `prototype/index.html` - 添加地形切换按钮和图鉴按钮

- [ ] **Step 1: 更新 index.html 添加地形切换和图鉴按钮**

修改 `prototype/index.html` 的 `#status-bar`：

```html
    <div id="status-bar">
      <span id="terrain-name">地形: 溪流/森林</span>
      <button id="terrain-switch-btn" style="padding:2px 10px;border:1px solid #0f3460;background:#1a1a2e;color:#aaa;border-radius:3px;cursor:pointer;font-size:11px;">切换地形</button>
      <span style="flex:1;"></span>
      <button id="fieldguide-btn" style="padding:2px 10px;border:1px solid #0f3460;background:#1a1a2e;color:#aaa;border-radius:3px;cursor:pointer;font-size:11px;">📖 图鉴</button>
      <span id="camera-info">📷 镜头: (0, 0) 0°</span>
    </div>
```

- [ ] **Step 2: 更新 main.js 添加地形切换逻辑**

修改 `prototype/js/main.js`，添加地形切换：

```js
  // 地形切换
  const terrainKeys = Object.keys(CONFIG.TERRAINS);
  let terrainIndex = terrainKeys.indexOf(state.terrain);

  document.getElementById('terrain-switch-btn').addEventListener('click', () => {
    const saveData = Storage.load();
    terrainIndex = (terrainIndex + 1) % terrainKeys.length;
    const nextTerrain = terrainKeys[terrainIndex];

    if (saveData.unlockedTerrains.includes(nextTerrain)) {
      state.terrain = nextTerrain;
      saveData.currentTerrain = nextTerrain;
      Storage.save(saveData);
      render();
    } else {
      alert('该地形未解锁！需要积分来解锁。');
    }
  });
```

- [ ] **Step 3: 更新 main.js 添加图鉴弹窗**

修改 `prototype/js/main.js`，添加图鉴展示：

```js
  // 图鉴弹窗
  document.getElementById('fieldguide-btn').addEventListener('click', () => {
    const saveData = Storage.load();
    const birdIds = Object.keys(CONFIG.BIRDS);
    let html = '<div style="padding:16px;max-height:60vh;overflow-y:auto;">';
    html += '<h3 style="color:#f0a500;margin-bottom:12px;">📖 鸟类图鉴</h3>';

    birdIds.forEach(id => {
      const bird = CONFIG.BIRDS[id];
      const discovered = saveData.fieldGuide[id] && saveData.fieldGuide[id].discovered;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:6px;margin:4px 0;background:${discovered ? '#1a3a1a' : '#1a1a1a'};border-radius:4px;">`;
      html += `<span style="font-size:24px;">${discovered ? bird.icon : '❓'}</span>`;
      html += `<span style="color:${discovered ? '#fff' : '#666'};">${discovered ? bird.name : '???'}</span>`;
      if (discovered) {
        html += `<span style="margin-left:auto;color:#888;font-size:11px;">已发现</span>`;
      }
      html += '</div>';
    });

    html += '</div>';
    const popup = window.open('', 'fieldguide', 'width=320,height=500,left=200,top=100');
    popup.document.write(`
      <html><head><title>鸟类图鉴</title>
      <style>body{font-family:system-ui,sans-serif;background:#111;color:#ccc;margin:0;}</style>
      </head><body>${html}</body></html>
    `);
  });
```

- [ ] **Step 4: 更新 main.js 添加积分刷新物件面板**

在 `updateScore` 函数中，每次渲染后刷新物件面板的解锁状态：

```js
  const originalRender = window.gameRender;
  window.gameRender = function() {
    originalRender();
    updateScore();
    // 刷新物件面板
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
      Objects.renderPanel(activeTab.dataset.tab);
    }
  };
```

- [ ] **Step 5: 浏览器验证**

打开 `prototype/index.html`：
- 点击"切换地形"按钮可在已解锁地形间切换，场景颜色变化
- 点击"图鉴"按钮弹出图鉴窗口，显示所有鸟类的发现状态
- 拍到新鸟后积分增加，积分显示实时更新
- 物件面板反映解锁状态

- [ ] **Step 6: 提交**

```bash
git add Project_1_观鸟挂机/prototype/index.html Project_1_观鸟挂机/prototype/js/main.js
git commit -m "完成积分与解锁系统：地形切换、图鉴弹窗、积分刷新、面板状态更新"
```

---

## 验收检查清单

- [ ] 等距网格场景正常渲染，棋盘格颜色交替
- [ ] 鼠标左键拖拽平移、右键拖拽旋转场景
- [ ] 物件面板分类切换，拖拽物件到场景中摆放
- [ ] 独立取景器小窗口弹出，取景框显示
- [ ] 取景器同步主窗口场景，可独立控制视角
- [ ] 周期性鸟类判定，鸟类在场景中可见
- [ ] 物件影响鸟类出现概率
- [ ] 拍照判定：入镜检测、首次发现/重复拍摄
- [ ] 积分累计和显示
- [ ] 图鉴弹窗展示所有鸟类的发现状态
- [ ] 地形切换功能正常