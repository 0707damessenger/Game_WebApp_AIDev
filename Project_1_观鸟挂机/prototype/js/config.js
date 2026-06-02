// 地形配置
CONFIG.TERRAINS = {
  stream_forest: {
    name: '溪流/森林',
    groundColor: '#4a7c3f',
    groundColorAlt: '#3d6b34',
    waterColor: '#4a90d9',
    feature: 'stream',
  },
  swamp_wetland: {
    name: '沼泽/湿地',
    groundColor: '#5a6b3a',
    groundColorAlt: '#4a5a2e',
    waterColor: '#3a6b4a',
    feature: 'swamp',
  },
  mudflat_coast: {
    name: '滩涂/海岸',
    groundColor: '#c4b896',
    groundColorAlt: '#b0a080',
    waterColor: '#5b8cbc',
    feature: 'coast',
  },
  plateau_mountain: {
    name: '高原/山地',
    groundColor: '#8a7a6a',
    groundColorAlt: '#7a6a5a',
    waterColor: '#6a8a9a',
    feature: 'mountain',
  },
};

// 物件配置
CONFIG.OBJECTS = {
  broadleaf_tree:  { name: '阔叶树',   category: 'plants',      icon: '🌳', color: '#3a7d2c', height: 30, width: 24 },
  conifer_tree:    { name: '针叶树',   category: 'plants',      icon: '🌲', color: '#2d5a1e', height: 36, width: 20 },
  bush:            { name: '灌木',     category: 'plants',      icon: '🌿', color: '#5a8a3a', height: 14, width: 16 },
  reed:            { name: '芦苇',     category: 'plants',      icon: '🌾', color: '#8a9a4a', height: 20, width: 8 },
  water_lily:      { name: '睡莲',     category: 'plants',      icon: '🪷', color: '#e87a9a', height: 6,  width: 14 },
  butterfly:       { name: '蝴蝶',     category: 'insects',     icon: '🦋', color: '#f0a0c0', height: 6,  width: 10 },
  dragonfly:       { name: '蜻蜓',     category: 'insects',     icon: '🦟', color: '#4ac0e0', height: 6,  width: 12 },
  squirrel:        { name: '松鼠',     category: 'insects',     icon: '🐿', color: '#c08050', height: 10, width: 10 },
  feeder:          { name: '喂食器',   category: 'facilities',  icon: '🍽', color: '#d4a040', height: 16, width: 12 },
  birdhouse:       { name: '鸟屋',     category: 'facilities',  icon: '🏠', color: '#8b6914', height: 22, width: 14 },
  water_basin:     { name: '水盆',     category: 'facilities',  icon: '🪣', color: '#6a8aaa', height: 8,  width: 16 },
};

// 鸟类配置
CONFIG.BIRDS = {
  egret:        { name: '白鹭',     icon: '🦢', color: '#fff',   baseProb: 0.05 },
  night_heron:  { name: '夜鹭',     icon: '🦩', color: '#445',   baseProb: 0.03 },
  kingfisher:   { name: '翠鸟',     icon: '🐦', color: '#0af',   baseProb: 0.02 },
  wagtail:      { name: '白鹡鸰',   icon: '🐤', color: '#ccc',   baseProb: 0.08 },
  sparrow:      { name: '麻雀',     icon: '🐦', color: '#963',   baseProb: 0.15 },
  woodpecker:   { name: '啄木鸟',   icon: '🪶', color: '#c33',   baseProb: 0.04 },
  eagle:        { name: '鹰',       icon: '🦅', color: '#630',   baseProb: 0.01 },
  seagull:      { name: '海鸥',     icon: '🕊', color: '#ddd',   baseProb: 0.10 },
  crane:        { name: '丹顶鹤',   icon: '🦩', color: '#f00',   baseProb: 0.02 },
  swallow:      { name: '燕子',     icon: '🐦', color: '#009',   baseProb: 0.06 },
};

// 地形-鸟种池映射
CONFIG.TERRAIN_BIRD_POOL = {
  stream_forest:   ['kingfisher', 'wagtail', 'sparrow', 'woodpecker', 'night_heron', 'swallow'],
  swamp_wetland:   ['egret', 'night_heron', 'crane', 'kingfisher', 'wagtail'],
  mudflat_coast:   ['seagull', 'egret', 'wagtail', 'swallow'],
  plateau_mountain:['eagle', 'sparrow', 'woodpecker', 'swallow'],
};

// 物件对鸟类的概率加成
CONFIG.OBJECT_BONUS = {
  reed:           { night_heron: 0.05, egret: 0.01 },
  water_lily:     { egret: 0.03, kingfisher: 0.02 },
  broadleaf_tree: { woodpecker: 0.04, sparrow: 0.03, swallow: 0.02 },
  conifer_tree:   { eagle: 0.02, sparrow: 0.02 },
  bush:           { wagtail: 0.03, sparrow: 0.02 },
  butterfly:      { swallow: 0.03, wagtail: 0.01 },
  dragonfly:      { kingfisher: 0.04, swallow: 0.02 },
  feeder:         { sparrow: 0.05, wagtail: 0.04, woodpecker: 0.02 },
  birdhouse:      { woodpecker: 0.05, sparrow: 0.03, swallow: 0.03 },
  water_basin:    { kingfisher: 0.05, egret: 0.04, wagtail: 0.03 },
};