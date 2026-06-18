// 构建模糊匹配特征表：按学名(拉丁名)联结公开数据集，生成 prototype/js/bird_traits.js
//
// 数据源（放在 Project_4.../data_raw/ 下，缺失则跳过对应维度，下载步骤见 data_raw/README.md）：
//   - BirdFuncDat.csv                EltonTraits 1.0 -> 体型(size) + 行为(behaviors)
//   - AVONET.xlsx                    AVONET          -> 栖息地(habitats)   （多表 xlsx，自动选 BirdLife 表）
//   - hbw_color_legend.csv           HBW 24色图例     -> 颜色类别号 -> 颜色英文名
//   - hbw_color_proportion.csv       HBW 各种颜色占比 -> 主色(colors)
// 精校层：tools/trait_overrides.json（按学名键），构建时覆盖打底层，重新生成不被冲掉。
//
// 用法：node tools/build_traits.mjs   （在 Project_4 项目根运行；零三方依赖）

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data_raw');
const OUT = path.join(ROOT, 'prototype', 'js', 'bird_traits.js');

// ---- 可调阈值（数值集中于此，不写入设计文档）----
const SIZE_BUCKETS = [
  { max: 12, value: 'tiny' },
  { max: 50, value: 'small' },
  { max: 300, value: 'medium' },
  { max: 2000, value: 'large' },
  { max: Infinity, value: 'veryLarge' },
];
const FORSTRAT_MIN = 3;   // 觅食层占比(0-10) >= 该值才算相关
const COLOR_MIN = 0.12;   // 颜色占比(0-1) >= 该值才算主色
const COLOR_MAX_N = 3;    // 每种最多保留占比最高的前 N 个主色

// ================= 通用解析 =================
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function rowsToObjects(rows) {
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.length > 1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
    return o;
  });
}

function loadCSV(file) {
  const p = path.join(RAW, file);
  if (!fs.existsSync(p)) return null;
  return rowsToObjects(parseCSV(fs.readFileSync(p, 'utf8')));
}

// ================= 最小 XLSX 读取（零依赖：解析 ZIP + 工作表 XML）=================
function unzip(buf) {
  // 解析 ZIP 中央目录，返回 { 文件名: Buffer }
  const files = {};
  const eocd = buf.lastIndexOf(0x06054b50 & 0xff); // 粗定位，下面精确扫描
  // 精确找 EOCD 签名 0x06054b50
  let p = buf.length - 22;
  while (p >= 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('非法 zip：未找到 EOCD');
  const cdOffset = buf.readUInt32LE(p + 16);
  const cdCount = buf.readUInt16LE(p + 10);
  let o = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(o) !== 0x02014b50) break;
    const method = buf.readUInt16LE(o + 10);
    const compSize = buf.readUInt32LE(o + 20);
    const nameLen = buf.readUInt16LE(o + 28);
    const extraLen = buf.readUInt16LE(o + 30);
    const commentLen = buf.readUInt16LE(o + 32);
    const localOff = buf.readUInt32LE(o + 42);
    const name = buf.toString('utf8', o + 46, o + 46 + nameLen);
    // 读本地头取数据起点
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files[name] = method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
    o += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function xmlAttr(tag, attr) {
  const m = tag.match(new RegExp(`${attr}="([^"]*)"`));
  return m ? m[1] : '';
}

function readXlsxSheet(file, sheetMatcher) {
  const buf = fs.readFileSync(path.join(RAW, file));
  const files = unzip(buf);
  // sharedStrings
  const shared = [];
  if (files['xl/sharedStrings.xml']) {
    const xml = files['xl/sharedStrings.xml'].toString('utf8');
    for (const si of xml.split('<si>').slice(1)) {
      const texts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
      shared.push(decodeXml(texts.join('')));
    }
  }
  // 工作簿表名 -> rId
  const wb = files['xl/workbook.xml'].toString('utf8');
  const sheets = [...wb.matchAll(/<sheet [^>]*\/>/g)].map((m) => ({
    name: xmlAttr(m[0], 'name'),
    rid: xmlAttr(m[0], 'r:id'),
  }));
  const rels = files['xl/_rels/workbook.xml.rels'].toString('utf8');
  const ridToTarget = {};
  for (const m of rels.matchAll(/<Relationship [^>]*\/>/g)) {
    ridToTarget[xmlAttr(m[0], 'Id')] = xmlAttr(m[0], 'Target');
  }
  const sheet = sheets.find((s) => sheetMatcher.test(s.name));
  if (!sheet) throw new Error(`xlsx 未找到匹配表 ${sheetMatcher}，现有表：${sheets.map((s) => s.name).join(', ')}`);
  let target = ridToTarget[sheet.rid] || '';
  if (target.startsWith('/')) target = target.slice(1); else target = 'xl/' + target;
  const sx = files[target].toString('utf8');

  // 解析行列
  const out = [];
  for (const rowm of sx.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rowm[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = xmlAttr(attrs, 'r');
      const col = ref.replace(/[0-9]/g, '');
      const t = xmlAttr(attrs, 't');
      let val = '';
      const inner = cm[2] || '';
      if (t === 's') {
        const vi = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vi) val = shared[parseInt(vi[1], 10)] || '';
      } else if (t === 'inlineStr') {
        const ti = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (ti) val = decodeXml(ti[1]);
      } else {
        const vi = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vi) val = vi[1];
      }
      cells[col] = val;
    }
    out.push(cells);
  }
  // 第一行表头 -> 列字母映射
  const headerRow = out.find((r) => Object.keys(r).length);
  const colToName = {};
  for (const [col, name] of Object.entries(headerRow)) colToName[col] = name.trim();
  const objs = [];
  let started = false;
  for (const r of out) {
    if (!started) { started = true; continue; } // 跳过表头行
    if (!Object.keys(r).length) continue;
    const o = {};
    for (const [col, v] of Object.entries(r)) if (colToName[col]) o[colToName[col]] = v;
    objs.push(o);
  }
  return objs;
}

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// ================= 名录（主键）=================
function loadCatalog() {
  const txt = fs.readFileSync(path.join(ROOT, 'prototype', 'js', 'birds.js'), 'utf8');
  const out = [];
  const re = /\{\s*name:\s*"([^"]+)",\s*scientificName:\s*"([^"]+)"\s*\}/g;
  let m;
  while ((m = re.exec(txt))) out.push({ name: m[1], scientificName: m[2] });
  return out;
}

// ================= 映射 =================
function sizeFromMass(g) {
  const v = parseFloat(g);
  if (!isFinite(v) || v <= 0) return '';
  return SIZE_BUCKETS.find((b) => v <= b.max).value;
}

function behaviorsFromElton(row) {
  const f = (k) => parseFloat(row[k] || '0') || 0;
  const out = new Set();
  if (f('ForStrat-watbelowsurf') >= FORSTRAT_MIN) { out.add('diving'); out.add('swimming'); }
  if (f('ForStrat-wataroundsurf') >= FORSTRAT_MIN) out.add('swimming');
  if (f('ForStrat-ground') >= FORSTRAT_MIN) out.add('foragingGround');
  if (f('ForStrat-aerial') >= FORSTRAT_MIN) out.add('flying');
  if (f('ForStrat-understory') >= FORSTRAT_MIN ||
      f('ForStrat-midhigh') >= FORSTRAT_MIN ||
      f('ForStrat-canopy') >= FORSTRAT_MIN) out.add('perching');
  return [...out];
  // 涉水/盘旋/悬停/鸣叫无可靠数据源，留给精校层。
}

// AVONET 栖息地 -> 本项目 8 类
const HABITAT_MAP = {
  Wetland: ['wetland'], Riverine: ['river'], Coastal: ['coast'], Marine: ['coast'],
  Forest: ['forest'], Woodland: ['forest'], Shrubland: ['shrub'], Grassland: ['grassland'],
  'Human Modified': ['urban', 'farmland'], Rock: [], Desert: [],
};
function habitatsFromAvonet(row) {
  const h = (row['Habitat'] || '').trim();
  return HABITAT_MAP[h] || [];
}

// HBW 颜色英文名 -> 本项目 8 主色
const COLOR8 = {
  white: 'white', black: 'black', grey: 'gray', gray: 'gray', brown: 'brown',
  buff: 'brown', tan: 'brown', rufous: 'brown', chestnut: 'brown', cream: 'brown',
  yellow: 'yellow', gold: 'yellow', orange: 'yellow',
  green: 'green', olive: 'green', blue: 'blue', cyan: 'blue', purple: 'blue',
  red: 'red', pink: 'red', crimson: 'red',
};

// ================= 主流程 =================
const catalog = loadCatalog();
const elton = loadCSV('BirdFuncDat.csv');

let avonet = null;
try {
  if (fs.existsSync(path.join(RAW, 'AVONET.xlsx'))) avonet = readXlsxSheet('AVONET.xlsx', /AVONET1.*BirdLife|BirdLife/i);
} catch (e) { console.log('  ⚠ AVONET.xlsx 解析失败：' + e.message); }

// HBW：图例(类别号->英文名) + 各种占比
let colorLegend = null, colorProp = null;
const legendRows = loadCSV('hbw_color_legend.csv');
if (legendRows) {
  colorLegend = {};
  legendRows.forEach((r, i) => {
    const idx = (r['Color classification'] || r['Color'] || String(i + 1)).trim();
    const nm = (r['Colors'] || r['Color name'] || '').trim().toLowerCase();
    if (nm) colorLegend[idx] = nm;
  });
}
colorProp = loadCSV('hbw_color_proportion.csv');

const eltonBySci = new Map();
if (elton) for (const r of elton) if (r['Scientific']) eltonBySci.set(r['Scientific'].trim(), r);
const avonetBySci = new Map();
if (avonet) for (const r of avonet) {
  const k = (r['Species1'] || r['Species'] || r['Scientific'] || '').trim();
  if (k) avonetBySci.set(k, r);
}
// HBW 占比：同种多行(雌雄/亚种)聚合求和
const colorBySci = new Map();
if (colorProp && colorLegend) {
  for (const r of colorProp) {
    const k = (r['Sci_name'] || r['Scientific'] || '').trim();
    if (!k) continue;
    const acc = colorBySci.get(k) || { sums: {}, n: 0 };
    for (let i = 1; i <= 24; i++) {
      const p = parseFloat(r['color' + i] || r['Color' + i] || '0') || 0;
      const eng = colorLegend['color' + i] || colorLegend[String(i)];
      const c8 = eng && COLOR8[eng];
      if (c8) acc.sums[c8] = (acc.sums[c8] || 0) + p;
    }
    acc.n++;
    colorBySci.set(k, acc);
  }
}
function colorsFor(sci) {
  const acc = colorBySci.get(sci);
  if (!acc || !acc.n) return [];
  return Object.entries(acc.sums)
    .map(([c, s]) => [c, s / acc.n])
    .filter(([, avg]) => avg >= COLOR_MIN)
    .sort((a, b) => b[1] - a[1])
    .slice(0, COLOR_MAX_N)
    .map(([c]) => c);
}

let overrides = {};
const ovPath = path.join(ROOT, 'tools', 'trait_overrides.json');
if (fs.existsSync(ovPath)) overrides = JSON.parse(fs.readFileSync(ovPath, 'utf8'));

const stat = { size: 0, behaviors: 0, habitats: 0, colors: 0, overridden: 0 };
const out = catalog.map(({ name, scientificName }) => {
  const t = { name, scientificName, size: '', colors: [], behaviors: [], habitats: [] };
  const e = eltonBySci.get(scientificName);
  if (e) { t.size = sizeFromMass(e['BodyMass-Value']); t.behaviors = behaviorsFromElton(e); }
  const a = avonetBySci.get(scientificName);
  if (a) t.habitats = habitatsFromAvonet(a);
  t.colors = colorsFor(scientificName);

  const ov = overrides[scientificName];
  if (ov) { Object.assign(t, ov, { name, scientificName }); stat.overridden++; }
  if (t.size) stat.size++;
  if (t.behaviors.length) stat.behaviors++;
  if (t.habitats.length) stat.habitats++;
  if (t.colors.length) stat.colors++;
  return t;
});

const banner = `// 自动生成，请勿手改。改映射改 tools/build_traits.mjs；改个别鸟种改 tools/trait_overrides.json。\n` +
  `// 来源：EltonTraits 1.0(体型/行为) + AVONET(栖息地) + HBW(主色) + 人工精校。\n`;
fs.writeFileSync(OUT, `${banner}window.BIRD_TRAITS = ${JSON.stringify(out)};\n`, 'utf8');

const pct = (n) => `${n}(${(100 * n / catalog.length).toFixed(0)}%)`;
console.log(`名录 ${catalog.length} 种 -> 写入 ${path.relative(ROOT, OUT)}`);
console.log(`覆盖率: 体型 ${pct(stat.size)} | 行为 ${pct(stat.behaviors)} | 栖息地 ${pct(stat.habitats)} | 主色 ${pct(stat.colors)} | 精校 ${stat.overridden}`);
if (!elton) console.log('  ⚠ 缺 data_raw/BirdFuncDat.csv（EltonTraits）→ 体型/行为为空');
if (!avonet) console.log('  ⚠ 缺/未解析 data_raw/AVONET.xlsx → 栖息地仅靠精校');
if (!colorBySci.size) console.log('  ⚠ 缺 data_raw/hbw_color_legend.csv 或 hbw_color_proportion.csv → 主色仅靠精校');
