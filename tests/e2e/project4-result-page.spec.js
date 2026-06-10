const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { expect, test } = require('@playwright/test');

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
