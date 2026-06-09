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
