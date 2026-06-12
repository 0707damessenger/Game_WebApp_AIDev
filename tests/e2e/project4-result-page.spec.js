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
  const sampleSession = {
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
  await expect(page.locator('#sharePlaceholderButton')).toBeDisabled();

  await page.locator('.result-bird-item').click();

  await expect(page.locator('.result-bird-item.is-highlighted')).toHaveCount(1);
  await expect(page.locator('.bird-point-button.is-highlighted')).toHaveCount(1);
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
