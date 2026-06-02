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
    saveData.placedObjects.forEach(function (obj) {
      objectCounts[obj.type] = (objectCounts[obj.type] || 0) + 1;
    });

    var self = this;
    self.activeBirds = [];

    pool.forEach(function (birdId) {
      const birdCfg = CONFIG.BIRDS[birdId];
      let prob = birdCfg.baseProb;

      // 累加物件加成
      Object.entries(objectCounts).forEach(function (entry) {
        var objType = entry[0];
        var count = entry[1];
        const bonus = (CONFIG.OBJECT_BONUS[objType] || {})[birdId] || 0;
        prob += bonus * count;
      });

      // 上限为 1
      prob = Math.min(prob, 1);

      // 掷骰
      if (Math.random() < prob) {
        self.activeBirds.push({
          id: birdId,
          gridX: Math.floor(Math.random() * CONFIG.GRID_COLS),
          gridY: Math.floor(Math.random() * CONFIG.GRID_ROWS),
        });
      }
    });
  },

  // 渲染在场鸟类
  drawBirds(ctx, camera) {
    var self = this;
    this.activeBirds.forEach(function (bird) {
      const birdCfg = CONFIG.BIRDS[bird.id];
      const pos = Iso.gridToScreen(bird.gridX, bird.gridY, camera);

      // 鸟的身体（椭圆）
      ctx.fillStyle = birdCfg.color;
      ctx.beginPath();
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
    setInterval(function () {
      Birds.spawnTick();
      window.gameRender();
    }, CONFIG.SPAWN_INTERVAL);
  },
};