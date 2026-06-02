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

    // 先渲染物件（在底层地块之上）
    if (typeof window.drawPlacedObjects === 'function') {
      window.drawPlacedObjects(ctx, camera);
    }

    // 从远到近渲染地块
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        this.drawTile(ctx, gx, gy, camera, terrainCfg);
      }
    }

    // 渲染鸟类（在最上层）
    if (typeof Birds !== 'undefined') {
      Birds.drawBirds(ctx, camera);
    }
  },
};