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