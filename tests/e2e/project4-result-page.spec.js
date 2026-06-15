const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { expect, test } = require('@playwright/test');

const TRANSPARENT_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

function project4PrototypeUrl() {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const projectDir = fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.startsWith('Project_4_'));

  if (!projectDir) {
    throw new Error('Project_4 directory was not found.');
  }

  return pathToFileURL(path.join(workspaceRoot, projectDir.name, 'prototype', 'index.html')).href;
}

function sampleFinishedSession() {
  return {
    state: 'finished',
    startedAt: '2026-06-10T01:05:00.000Z',
    endedAt: '2026-06-10T01:30:00.000Z',
    startPoint: { lat: 31.2304, lng: 121.4737, label: '上海' },
    currentPoint: { lat: 31.231, lng: 121.4742, label: '测试终点', timestamp: '2026-06-10T01:20:00.000Z' },
    track: [
      { lat: 31.2304, lng: 121.4737, label: '上海', timestamp: '2026-06-10T01:05:00.000Z' },
      { lat: 31.231, lng: 121.4742, label: '测试终点', timestamp: '2026-06-10T01:20:00.000Z' },
    ],
    birdRecords: [
      {
        id: 'bird-test-1',
        speciesName: '白头鹎',
        scientificName: 'Pycnonotus sinensis',
        count: 2,
        tags: ['成鸟'],
        note: '树梢鸣叫',
        position: { lat: 31.231, lng: 121.4742, label: '测试终点', timestamp: '2026-06-10T01:20:00.000Z' },
        createdAt: '2026-06-10T01:08:00.000Z',
      },
    ],
    distanceMeters: 152,
    createdAt: '2026-06-10T01:00:00.000Z',
  };
}

function sampleHistoryRecord() {
  return {
    ...sampleFinishedSession(),
    id: 'history-2026-06-10-sample',
    title: '本次记录',
    savedAt: '2026-06-10T01:31:00.000Z',
    summary: {
      state: 'finished',
      trackPointCount: 2,
      birdRecordCount: 1,
      speciesCount: 1,
      totalBirds: 2,
      distanceMeters: 152,
      durationMinutes: 25,
    },
  };
}

async function mockTiandituTiles(page) {
  await page.route('**/*.tianditu.gov.cn/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_TILE,
    });
  });
}

test('Project 4 shows the saved current record result page', async ({ page }) => {
  const sampleSession = sampleFinishedSession();

  await page.addInitScript((session) => {
    localStorage.setItem('bird-route-current-session', JSON.stringify(session));
  }, sampleSession);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultTitle')).toHaveText('本次记录');
  await expect(page.locator('#resultDuration')).toHaveText('25 分钟');
  await expect(page.locator('#resultDistance')).toHaveText('152 m');
  await expect(page.locator('#resultSpecies')).toHaveText('1 种');
  await expect(page.locator('#resultBirdTotal')).toHaveText('2 只');
  await expect(page.locator('#resultBirdList')).toContainText('白头鹎 × 2');
  await expect(page.locator('#shareButton')).toBeEnabled();
  await page.locator('#shareButton').click();
  await expect(page.locator('#shareDialog')).toBeVisible();
  await expect(page.locator('#shareDialog')).toContainText('完整路线和鸟点位置');
  await expect(page.locator('#shareServiceStatus')).toContainText('服务器链接服务待接入');
  await page.locator('#shareCloseButton').click();

  await page.locator('.result-bird-item').click();

  await expect(page.locator('.result-bird-item.is-highlighted')).toHaveCount(1);
  await expect(page.locator('.bird-point-button.is-highlighted')).toHaveCount(1);

  await page.locator('#returnHomeButton').click();
  await expect(page.locator('#resultPanel')).toBeHidden();
  await expect(page.locator('#startPanel')).toBeVisible();
  await expect(page.locator('#profileButton')).toBeVisible();
});

test('Project 4 can open the share skeleton from a history record result page', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('#profileButton').click();
  await page.locator('#historyEntryButton').click();
  await expect(page.locator('#historyCount')).toHaveText('1 条');
  await page.locator('.history-item').click();

  await expect(page.locator('#resultTitle')).toHaveText('历史记录');
  await expect(page.locator('#shareButton')).toBeEnabled();
  await page.locator('#shareButton').click();
  await expect(page.locator('#shareDialog')).toBeVisible();
  await expect(page.locator('#shareRecordSummary')).toContainText('白头鹎');
  await expect(page.locator('#shareServiceStatus')).toContainText('服务器链接服务待接入');
});

test('Project 4 import entry shows pending service state without adding history', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('#profileButton').click();
  await page.locator('#importEntryButton').click();
  await expect(page.locator('#importDialog')).toBeVisible();
  await page.locator('#importUrlInput').fill('https://bird-route.example/share/demo');
  await page.locator('#importPreviewButton').click();

  await expect(page.locator('#importServiceStatus')).toContainText('服务器链接服务待接入');
  await expect(page.locator('#importPreview')).toContainText('暂不能保存');

  const historyCount = await page.evaluate(() => {
    const history = JSON.parse(localStorage.getItem('bird-route-history') || '[]');
    return history.length;
  });
  expect(historyCount).toBe(1);
});

test('Project 4 searches the expanded bird catalog while adding a bird record', async ({ page }) => {
  const recordingSession = {
    state: 'recording',
    startedAt: '2026-06-10T01:05:00.000Z',
    startPoint: { lat: 31.2304, lng: 121.4737, label: '上海' },
    currentPoint: { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    track: [
      { lat: 31.2304, lng: 121.4737, label: '上海', timestamp: '2026-06-10T01:05:00.000Z' },
      { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    ],
    birdRecords: [],
    distanceMeters: 152,
    createdAt: '2026-06-10T01:00:00.000Z',
  };

  await page.addInitScript((session) => {
    localStorage.setItem('bird-route-current-session', JSON.stringify(session));
  }, recordingSession);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());
  await page.locator('#addBirdButton').click();

  await page.locator('#birdSearchInput').fill('中华秋沙鸭');
  await expect(page.locator('#birdResults .bird-result-button')).toHaveCount(1);
  await expect(page.locator('#birdResults')).toContainText('Mergus squamatus');

  await page.locator('#birdSearchInput').fill('Nipponia nippon');
  await expect(page.locator('#birdResults .bird-result-button')).toHaveCount(1);
  await expect(page.locator('#birdResults')).toContainText('朱鹮');

  await page.locator('#birdSearchInput').fill('不存在鸟种');
  await expect(page.locator('#birdResults .bird-result-button')).toHaveCount(0);

  await page.locator('#birdSearchInput').fill('中华秋沙鸭');
  await page.locator('#birdResults .bird-result-button').click();
  await expect(page.locator('#birdSelectedInfo')).toContainText('中华秋沙鸭');

  await page.locator('#birdSubmitButton').click();

  await expect(page.locator('#birdDialog')).not.toBeVisible();
  await expect(page.locator('#sessionBirds')).toHaveText('1 种');
  await expect(page.locator('.bird-point-button')).toHaveCount(1);
});

test('Project 4 renders a user bird note as literal text, never as HTML', async ({ page }) => {
  const sharedPosition = { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' };
  const maliciousNote = '<img src=x onerror="window.__xss=1">树梢';
  const recordingSession = {
    state: 'recording',
    startedAt: '2026-06-10T01:05:00.000Z',
    startPoint: { lat: 31.2304, lng: 121.4737, label: '上海' },
    currentPoint: sharedPosition,
    track: [
      { lat: 31.2304, lng: 121.4737, label: '上海', timestamp: '2026-06-10T01:05:00.000Z' },
      sharedPosition,
    ],
    // 两条落点位置完全相同，会聚合成一个组合点，点选后进入预览列表。
    birdRecords: [
      {
        id: 'bird-test-1', speciesName: '白头鹎', scientificName: 'Pycnonotus sinensis',
        count: 2, tags: ['成鸟'], note: maliciousNote, position: sharedPosition, createdAt: '2026-06-10T01:08:00.000Z',
      },
      {
        id: 'bird-test-2', speciesName: '麻雀', scientificName: 'Passer montanus',
        count: 1, tags: [], note: '', position: sharedPosition, createdAt: '2026-06-10T01:09:00.000Z',
      },
    ],
    distanceMeters: 152,
    createdAt: '2026-06-10T01:00:00.000Z',
  };

  await page.addInitScript((session) => {
    localStorage.setItem('bird-route-current-session', JSON.stringify(session));
  }, recordingSession);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('.bird-point-button.is-grouped').click();
  await expect(page.locator('#birdPointDialog')).toBeVisible();

  // 备注按字面文本展示，且不会被解析为 HTML 元素或触发脚本。
  await expect(page.locator('#birdPointList')).toContainText(maliciousNote);
  await expect(page.locator('#birdPointList img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

async function openHistoryRecordForEditing(page) {
  await page.locator('#profileButton').click();
  await page.locator('#historyEntryButton').click();
  await page.locator('.history-item').click();
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultTitle')).toHaveText('历史记录');
}

async function enterEditMode(page) {
  await openHistoryRecordForEditing(page);
  await page.locator('#historyEditButton').click();
  await expect(page.locator('#historyEditBar')).toBeVisible();
  await expect(page.locator('#resultPanel')).toBeHidden();
}

test('Project 4 edits a bird record inside a saved history entry and persists it', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await enterEditMode(page);

  // 编辑态为地图为主：点选地图上的落点打开编辑弹层。
  await page.locator('.bird-point-button').click();
  await expect(page.locator('#birdDialog')).toBeVisible();
  await page.locator('#birdCountPlus').click(); // 2 -> 3
  await page.locator('#birdSubmitButton').click();

  await page.locator('#historySaveButton').click();
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultTitle')).toHaveText('历史记录');
  await expect(page.locator('#resultBirdTotal')).toHaveText('3 只');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  expect(persisted[0].birdRecords[0].count).toBe(3);
  expect(persisted[0].summary.totalBirds).toBe(3);
});

test('Project 4 discards history edits when the user cancels', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await enterEditMode(page);

  await page.locator('.bird-point-button').click();
  await page.locator('#birdDeleteButton').click();
  await expect(page.locator('.bird-point-button')).toHaveCount(0);

  await page.locator('#historyCancelButton').click();

  // 取消后还原为编辑前内容，且本地存储未被改动。
  await expect(page.locator('#resultPanel')).toBeVisible();
  await expect(page.locator('#resultTitle')).toHaveText('历史记录');
  await expect(page.locator('#resultBirdTotal')).toHaveText('2 只');
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  expect(persisted[0].birdRecords).toHaveLength(1);
  expect(persisted[0].summary.totalBirds).toBe(2);
});

test('Project 4 snaps a dragged bird point onto the route while editing', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await enterEditMode(page);

  const point = page.locator('.bird-point-button.is-draggable');
  await expect(point).toHaveCount(1);
  const box = await point.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // 拖到明显偏离当前落点的位置。
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 90, startY - 70, { steps: 10 });
  await page.mouse.up();

  await page.locator('#historySaveButton').click();
  await expect(page.locator('#resultPanel')).toBeVisible();

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  const moved = persisted[0].birdRecords[0].position;
  const a = { lat: 31.2304, lng: 121.4737 };
  const b = { lat: 31.231, lng: 121.4742 };

  // 位置已改变。
  expect(moved.lat !== b.lat || moved.lng !== b.lng).toBe(true);
  // 仍落在路线（A-B 线段）上：位于线段 bbox 内（容差远小于线段长度，仅吸收端点像素取整），
  // 且与 A-B 近似共线。
  const tol = 1e-4;
  expect(moved.lat).toBeGreaterThanOrEqual(Math.min(a.lat, b.lat) - tol);
  expect(moved.lat).toBeLessThanOrEqual(Math.max(a.lat, b.lat) + tol);
  expect(moved.lng).toBeGreaterThanOrEqual(Math.min(a.lng, b.lng) - tol);
  expect(moved.lng).toBeLessThanOrEqual(Math.max(a.lng, b.lng) + tol);
  const cross = (b.lat - a.lat) * (moved.lng - a.lng) - (b.lng - a.lng) * (moved.lat - a.lat);
  expect(Math.abs(cross)).toBeLessThan(1e-6);
});

async function abortAllTiles(page) {
  await page.route('**/*.tianditu.gov.cn/**', (route) => route.abort());
  await page.route('**/*tile.openstreetmap.org/**', (route) => route.abort());
}

test('Project 4 keeps history bird points draggable even when map tiles fail', async ({ page }) => {
  await page.addInitScript((record) => {
    localStorage.setItem('bird-route-history', JSON.stringify([record]));
  }, sampleHistoryRecord());

  // 瓦片全部失败（占位 Key 的真实桌面情形）——地图仍可交互，落点仍走真实坐标。
  await abortAllTiles(page);
  await page.goto(project4PrototypeUrl());

  await enterEditMode(page);

  const point = page.locator('.bird-point-button.is-draggable');
  await expect(point).toHaveCount(1);
  const box = await point.boundingBox();
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 90, startY - 70, { steps: 10 });
  await page.mouse.up();

  await page.locator('#historySaveButton').click();

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  const moved = persisted[0].birdRecords[0].position;
  const b = { lat: 31.231, lng: 121.4742 };
  expect(moved.lat !== b.lat || moved.lng !== b.lng).toBe(true);
});

test('Project 4 keeps recording bird points following the map when tiles fail', async ({ page }) => {
  const recordingSession = {
    state: 'recording',
    startedAt: '2026-06-10T01:05:00.000Z',
    startPoint: { lat: 31.2304, lng: 121.4737, label: '上海' },
    currentPoint: { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    track: [
      { lat: 31.2304, lng: 121.4737, label: '上海', timestamp: '2026-06-10T01:05:00.000Z' },
      { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    ],
    birdRecords: [
      {
        id: 'bird-r-1', speciesName: '白头鹎', scientificName: 'Pycnonotus sinensis',
        count: 1, tags: [], note: '',
        position: { lat: 31.231, lng: 121.4742, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
        createdAt: '2026-06-10T01:08:00.000Z',
      },
    ],
    distanceMeters: 152,
    createdAt: '2026-06-10T01:00:00.000Z',
  };

  await page.addInitScript((session) => {
    localStorage.setItem('bird-route-current-session', JSON.stringify(session));
  }, recordingSession);
  await abortAllTiles(page);
  await page.goto(project4PrototypeUrl());

  const point = page.locator('.bird-point-button');
  await expect(point).toHaveCount(1);
  const before = await point.boundingBox();

  // 在地图空白处平移：落点应在拖动过程中（鼠标仍按下）就实时跟随，而非松手才瞬移。
  await page.mouse.move(200, 250);
  await page.mouse.down();
  await page.mouse.move(110, 250, { steps: 10 });

  await expect.poll(async () => {
    const box = await point.boundingBox();
    return box ? Math.abs(box.x - before.x) : 0;
  }).toBeGreaterThan(20);

  await page.mouse.up();
});

test('Project 4 deletes a whole history record only after confirmation', async ({ page }) => {
  const recordA = { ...sampleHistoryRecord(), id: 'history-a', savedAt: '2026-06-09T02:00:00.000Z' };
  const recordB = { ...sampleHistoryRecord(), id: 'history-b', savedAt: '2026-06-09T01:00:00.000Z' };

  await page.addInitScript((records) => {
    localStorage.setItem('bird-route-history', JSON.stringify(records));
  }, [recordA, recordB]);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('#profileButton').click();
  await page.locator('#historyEntryButton').click();
  await expect(page.locator('.history-item')).toHaveCount(2);

  // 取消时不删除。
  await page.locator('.history-item').first().locator('.history-delete').click();
  await expect(page.locator('#deleteHistoryDialog')).toBeVisible();
  await page.locator('#deleteHistoryDialog button[value="cancel"]').click();
  await expect(page.locator('.history-item')).toHaveCount(2);

  // 确认后删除该条。
  await page.locator('.history-item').first().locator('.history-delete').click();
  await page.locator('#deleteHistoryDialog button[value="delete"]').click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await expect(page.locator('#historyCount')).toHaveText('1 条');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  expect(persisted).toHaveLength(1);
  expect(persisted[0].id).toBe('history-b');
});

test('Project 4 can favorite routes from the history list and open them from favorites', async ({ page }) => {
  const recordA = { ...sampleHistoryRecord(), id: 'history-a', savedAt: '2026-06-09T02:00:00.000Z' };
  const recordB = { ...sampleHistoryRecord(), id: 'history-b', savedAt: '2026-06-09T01:00:00.000Z' };

  await page.addInitScript((records) => {
    localStorage.setItem('bird-route-history', JSON.stringify(records));
  }, [recordA, recordB]);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('#profileButton').click();
  await page.locator('#historyEntryButton').click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  const favoriteButton = page.locator('.history-item').first().locator('.history-favorite');
  await favoriteButton.click();
  await expect(favoriteButton).toHaveText('★');
  await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
  await expect(favoriteButton).toHaveAttribute('aria-label', '取消收藏');

  await page.locator('#historyBackButton').click();
  await page.locator('#favoritesEntryButton').click();
  await expect(page.locator('#historyListTitle')).toHaveText('收藏线路');
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item').click();

  await expect(page.locator('#resultTitle')).toHaveText('收藏线路');
  await expect(page.locator('#resultKicker')).toHaveText('收藏线路');
  await expect(page.locator('#favoriteResultButton')).toHaveText('取消收藏');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  expect(persisted.find((record) => record.id === 'history-a').isFavorite).toBe(true);
  expect(persisted.find((record) => record.id === 'history-b').isFavorite).toBeUndefined();
});

test('Project 4 can unfavorite from detail and shows an empty favorites list', async ({ page }) => {
  const favorite = { ...sampleHistoryRecord(), id: 'history-favorite', isFavorite: true };

  await page.addInitScript((records) => {
    localStorage.setItem('bird-route-history', JSON.stringify(records));
  }, [favorite]);

  await mockTiandituTiles(page);
  await page.goto(project4PrototypeUrl());

  await page.locator('#profileButton').click();
  await page.locator('#favoritesEntryButton').click();
  await expect(page.locator('.history-item')).toHaveCount(1);
  await page.locator('.history-item').click();
  await expect(page.locator('#resultTitle')).toHaveText('收藏线路');
  await expect(page.locator('#resultKicker')).toHaveText('收藏线路');
  await expect(page.locator('#favoriteResultButton')).toHaveText('取消收藏');

  await page.locator('#favoriteResultButton').click();
  await expect(page.locator('#favoriteResultButton')).toHaveText('收藏');
  await page.locator('#returnHomeButton').click();

  await expect(page.locator('#historyListTitle')).toHaveText('收藏线路');
  await expect(page.locator('.history-item')).toHaveCount(0);
  await expect(page.locator('#historyEmpty')).toContainText('还没有收藏线路');

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('bird-route-history')));
  expect(persisted[0].isFavorite).toBe(false);
});

test('Project 4 loads Tianditu tile layers by default', async ({ page }) => {
  const tileRequests = [];

  await page.route('**/*.tianditu.gov.cn/**', async (route) => {
    tileRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_TILE,
    });
  });

  await page.goto(project4PrototypeUrl());

  await expect.poll(() => tileRequests.length, {
    message: 'expected the default map provider to request Tianditu tiles',
    timeout: 5000,
  }).toBeGreaterThan(0);
  await expect(page.locator('#hintStrip')).toBeHidden();
});

test('Project 4 does not draw a duplicate SVG route when Tianditu tile errors enable fallback clicks', async ({ page }) => {
  const recordingSession = {
    state: 'recording',
    startedAt: '2026-06-10T01:05:00.000Z',
    startPoint: { lat: 31.2304, lng: 121.4737, label: '上海' },
    currentPoint: { lat: 31.232, lng: 121.475, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    track: [
      { lat: 31.2304, lng: 121.4737, label: '上海', timestamp: '2026-06-10T01:05:00.000Z' },
      { lat: 31.231, lng: 121.4742, label: '中途点', timestamp: '2026-06-10T01:12:00.000Z' },
      { lat: 31.232, lng: 121.475, label: '测试点', timestamp: '2026-06-10T01:20:00.000Z' },
    ],
    birdRecords: [],
    distanceMeters: 260,
    createdAt: '2026-06-10T01:00:00.000Z',
  };

  await page.route('**/*tile.openstreetmap.org/**', (route) => route.abort());
  await page.addInitScript((session) => {
    localStorage.setItem('bird-route-current-session', JSON.stringify(session));
  }, recordingSession);

  await page.route('**/*.tianditu.gov.cn/**', (route) => route.abort());
  await page.goto(project4PrototypeUrl());

  await expect(page.locator('#hintStrip')).toContainText('地图瓦片加载失败');
  await expect(page.locator('.route-line')).toHaveCount(1);
  await expect(page.locator('#testRouteLayer > *')).toHaveCount(0);

  await page.mouse.click(180, 320);

  await expect(page.locator('.route-line')).toHaveCount(1);
  await expect(page.locator('#testRouteLayer > *')).toHaveCount(0);
});
