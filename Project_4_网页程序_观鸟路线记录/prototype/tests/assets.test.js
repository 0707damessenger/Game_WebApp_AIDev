const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const prototypeRoot = path.resolve(__dirname, '..');

test('Leaflet assets are served from local prototype files', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');

  assert.equal(html.includes('https://unpkg.com/leaflet'), false);
  assert.equal(html.includes('./vendor/leaflet/leaflet.css'), true);
  assert.equal(html.includes('./vendor/leaflet/leaflet.js'), true);
  assert.equal(fs.existsSync(path.join(prototypeRoot, 'vendor/leaflet/leaflet.css')), true);
  assert.equal(fs.existsSync(path.join(prototypeRoot, 'vendor/leaflet/leaflet.js')), true);
});

test('finished record result view is available in the prototype shell', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');

  assert.equal(html.includes('id="resultPanel"'), true);
  assert.equal(html.includes('id="resultSummary"'), true);
  assert.equal(html.includes('id="resultBirdList"'), true);
  assert.equal(html.includes('id="returnHomeButton"'), true);
  assert.equal(html.includes('id="sharePlaceholderButton"'), true);
  assert.equal(html.includes('分享（后续模块）'), true);
});

test('profile entry and standalone history list page are available in the prototype shell', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');
  const profilePanel = html.slice(
    html.indexOf('id="profilePanel"'),
    html.indexOf('id="historyPanel"'),
  );

  assert.equal(html.includes('id="profileButton"'), true);
  assert.equal(html.includes('id="profilePanel"'), true);
  assert.equal(html.includes('id="historyEntryButton"'), true);
  assert.equal(html.includes('id="historyPanel"'), true);
  assert.equal(html.includes('id="historyBackButton"'), true);
  assert.equal(html.includes('id="historyList"'), true);
  assert.equal(html.includes('id="historyEmpty"'), true);
  assert.equal(html.includes('id="profileInfoPlaceholderButton"'), true);
  assert.equal(html.includes('个人信息（后续模块）'), true);
  assert.equal(html.includes('登录 / 登出（后续模块）'), true);
  assert.equal(profilePanel.includes('id="historyList"'), false);
});

test('hidden map fallback does not overlay the interactive map', () => {
  const css = fs.readFileSync(path.join(prototypeRoot, 'css/styles.css'), 'utf8');

  assert.equal(css.includes('.map-fallback[hidden]'), true);
  assert.equal(css.includes('display: none'), true);
});

test('status hint strip does not intercept map or panel controls', () => {
  const css = fs.readFileSync(path.join(prototypeRoot, 'css/styles.css'), 'utf8');
  const hintRule = css.slice(css.indexOf('.hint-strip {'), css.indexOf('.bottom-action {'));

  assert.equal(hintRule.includes('pointer-events: none'), true);
});

test('gps location source is wired through browser geolocation APIs', () => {
  const config = fs.readFileSync(path.join(prototypeRoot, 'js/config.js'), 'utf8');
  const app = fs.readFileSync(path.join(prototypeRoot, 'js/app.js'), 'utf8');

  assert.equal(config.includes("locationSource: 'simulated'"), true);
  assert.equal(app.includes("config.locationSource === 'gps'"), true);
  assert.equal(app.includes('navigator.geolocation'), true);
  assert.equal(app.includes('watchPosition'), true);
  assert.equal(app.includes('clearWatch'), true);
  assert.equal(app.includes('无法获取定位'), true);
});

test('gps start selection does not expose simulated fallback start controls', () => {
  const app = fs.readFileSync(path.join(prototypeRoot, 'js/app.js'), 'utf8');
  const gpsGuard = "config.locationSource !== 'gps'";

  assert.equal(
    app.includes(gpsGuard),
    true,
  );
  assert.equal(
    app.includes('function canUseSimulatedFallbackStart()'),
    true,
  );
});
