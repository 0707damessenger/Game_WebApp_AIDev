const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const prototypeRoot = path.resolve(__dirname, '..');

function loadBirdCatalog() {
  const script = fs.readFileSync(path.join(prototypeRoot, 'js/birds.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(script, sandbox);
  return sandbox.window.BIRD_CATALOG;
}

function loadConfig() {
  const script = fs.readFileSync(path.join(prototypeRoot, 'js/config.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(script, sandbox);
  return sandbox.window.CONFIG;
}

function loadFuzzyTools(config) {
  const script = fs.readFileSync(path.join(prototypeRoot, 'js/fuzzy.js'), 'utf8');
  const sandbox = { window: { CONFIG: config } };
  vm.runInNewContext(script, sandbox);
  return sandbox.window.BirdFuzzyMatch;
}

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
  assert.equal(html.includes('id="shareButton"'), true);
  assert.equal(html.includes('id="shareDialog"'), true);
  assert.equal(html.includes('id="shareServiceStatus"'), true);
});

test('profile entry, import entry, and standalone history list page are available in the prototype shell', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');
  const profilePanel = html.slice(
    html.indexOf('id="profilePanel"'),
    html.indexOf('id="historyPanel"'),
  );

  assert.equal(html.includes('id="profileButton"'), true);
  assert.equal(html.includes('id="profilePanel"'), true);
  assert.equal(html.includes('id="historyEntryButton"'), true);
  assert.equal(html.includes('id="favoritesEntryButton"'), true);
  assert.equal(html.includes('id="importEntryButton"'), true);
  assert.equal(html.includes('id="importDialog"'), true);
  assert.equal(html.includes('id="importPreviewButton"'), true);
  assert.equal(html.includes('id="importServiceStatus"'), true);
  assert.equal(html.includes('id="historyPanel"'), true);
  assert.equal(html.includes('id="historyBackButton"'), true);
  assert.equal(html.includes('id="historyListTitle"'), true);
  assert.equal(html.includes('id="historyListDescription"'), true);
  assert.equal(html.includes('id="historyList"'), true);
  assert.equal(html.includes('id="historyEmpty"'), true);
  assert.equal(html.includes('id="favoriteResultButton"'), true);
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
  assert.equal(hintRule.includes('.hint-strip.is-top'), true);
  assert.equal(hintRule.includes('right: 112px'), true);
});

test('gps location source is wired through browser geolocation APIs', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');
  const config = fs.readFileSync(path.join(prototypeRoot, 'js/config.js'), 'utf8');
  const app = fs.readFileSync(path.join(prototypeRoot, 'js/app.js'), 'utf8');

  assert.equal(html.includes('id="currentLocationButton"'), true);
  assert.equal(html.includes('id="zoomInButton"'), false);
  assert.equal(html.includes('id="zoomOutButton"'), false);
  assert.equal(config.includes("locationSource: 'gps'"), true);
  assert.equal(app.includes("config.locationSource === 'gps'"), true);
  assert.equal(app.includes('navigator.geolocation'), true);
  assert.equal(app.includes('window.isSecureContext'), true);
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

test('map tile source configuration defaults to Tianditu with OpenStreetMap fallback', () => {
  const configScript = fs.readFileSync(path.join(prototypeRoot, 'js/config.js'), 'utf8');
  const config = loadConfig();

  assert.equal((configScript.match(/window\.CONFIG\s*=/g) || []).length, 1);
  assert.equal(config.activeProvider, 'tianditu');
  assert.equal(typeof config.providers, 'object');
  assert.equal(Array.isArray(config.providers.tianditu.layers), true);
  assert.equal(config.providers.tianditu.layers.length, 2);
  assert.equal(config.providers.tianditu.layers[0].key, 'tianditu-vector');
  assert.equal(config.providers.tianditu.layers[1].key, 'tianditu-label');
  assert.equal(typeof config.providers.tianditu.token, 'string');
  assert.notEqual(config.providers.tianditu.token.trim(), '');
  assert.equal(Array.isArray(config.providers.osm.layers), true);
  assert.equal(config.providers.osm.layers.length, 1);
});

test('share and import configuration reserves server-link service while disabled', () => {
  const config = loadConfig();

  assert.equal(typeof config.shareImport, 'object');
  assert.equal(config.shareImport.serviceEnabled, false);
  assert.equal(config.shareImport.duplicateStrategy, 'openExisting');
  assert.equal(config.shareImport.sharedLocationScope, 'fullRoute');
  assert.equal(typeof config.shareImport.pendingServiceLabel, 'string');
  assert.notEqual(config.shareImport.pendingServiceLabel.trim(), '');
});

test('fuzzy match UI and configuration are available in the prototype shell', () => {
  const html = fs.readFileSync(path.join(prototypeRoot, 'index.html'), 'utf8');
  const config = loadConfig();

  assert.equal(html.includes('id="birdModeTabs"'), true);
  assert.equal(html.includes('id="birdSearchModeButton"'), true);
  assert.equal(html.includes('id="birdFuzzyModeButton"'), true);
  assert.equal(html.includes('id="birdFuzzyPanel"'), true);
  assert.equal(html.includes('./js/fuzzy.js'), true);
  assert.equal(typeof config.fuzzyMatch, 'object');
  assert.equal(Array.isArray(config.fuzzyMatch.featureGroups), true);
  assert.equal(Array.isArray(config.fuzzyMatch.candidateRules), true);
});

test('fuzzy match rules return waterbird candidates for large wetland swimmers', () => {
  const config = loadConfig();
  const fuzzy = loadFuzzyTools(config);

  const candidates = fuzzy.matchCandidates({
    size: 'large',
    colors: ['white'],
    behaviors: ['swimming'],
    habitats: ['wetland'],
    postures: ['floating'],
  });

  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].name, '大天鹅');
  assert.equal(candidates[0].scientificName, 'Cygnus cygnus');
  assert.ok(candidates[0].score > 0);
});

test('design documents move fuzzy match into current-stage scope', () => {
  const design = fs.readFileSync(path.resolve(prototypeRoot, '..', 'docs/design.md'), 'utf8');
  const exploration = fs.readFileSync(path.resolve(prototypeRoot, '..', 'docs/exploration.md'), 'utf8');

  assert.equal(design.includes('鸟种模糊匹配'), true);
  assert.equal(design.includes('当前阶段不实现'), false);
  assert.equal(exploration.includes('鸟种模糊匹配的特征维度'), false);
});

test('map initialization reads tile layers from the active provider', () => {
  const app = fs.readFileSync(path.join(prototypeRoot, 'js/app.js'), 'utf8');

  assert.equal(app.includes('config.tileLayer.url'), false);
  assert.equal(app.includes('getActiveTileProvider'), true);
  assert.equal(app.includes('createTileLayerUrl'), true);
});

test('design documents lock duplicate import as open existing without duplicate saves', () => {
  const design = fs.readFileSync(path.resolve(prototypeRoot, '..', 'docs/design.md'), 'utf8');
  const exploration = fs.readFileSync(path.resolve(prototypeRoot, '..', 'docs/exploration.md'), 'utf8');

  assert.equal(design.includes('重复导入时不新增副本'), true);
  assert.equal(design.includes('打开已有记录'), true);
  assert.equal(exploration.includes('服务器短链接'), true);
});

test('design documents lock local favorites as current-stage personal data', () => {
  const design = fs.readFileSync(path.resolve(prototypeRoot, '..', 'docs/design.md'), 'utf8');

  assert.equal(design.includes('本地收藏线路'), true);
  assert.equal(design.includes('旧记录没有收藏状态时按未收藏处理'), true);
  assert.equal(design.includes('删除一条历史记录时，其收藏状态随该记录一并删除'), true);
});

test('bird catalog contains the expanded national formal checklist data', () => {
  const catalog = loadBirdCatalog();
  const names = new Set(catalog.map((bird) => bird.name));

  assert.equal(Array.isArray(catalog), true);
  assert.ok(catalog.length > 1000, `expected expanded catalog, got ${catalog.length} entries`);
  assert.equal(names.has('白头鹎'), true);
  assert.equal(names.has('丹顶鹤'), true);
  assert.equal(names.has('朱鹮'), true);
  assert.equal(names.has('中华秋沙鸭'), true);
  assert.equal(names.has('褐马鸡'), true);
});

test('bird catalog entries keep searchable Chinese and scientific names without duplicates', () => {
  const catalog = loadBirdCatalog();
  const keys = new Set();

  for (const bird of catalog) {
    assert.equal(typeof bird.name, 'string');
    assert.notEqual(bird.name.trim(), '');
    assert.equal(typeof bird.scientificName, 'string');
    assert.notEqual(bird.scientificName.trim(), '');

    const key = `${bird.name}::${bird.scientificName}`;
    assert.equal(keys.has(key), false, `duplicate bird catalog entry: ${key}`);
    keys.add(key);
  }
});
