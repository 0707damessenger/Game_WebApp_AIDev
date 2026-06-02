const Storage = {
  _key: 'birdwatching_game',

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : this.defaults();
    } catch (e) {
      return this.defaults();
    }
  },

  save(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  },

  defaults() {
    return {
      score: 0,
      currentTerrain: 'stream_forest',
      placedObjects: [],       // { type, gridX, gridY }
      unlockedObjects: ['broadleaf_tree', 'conifer_tree', 'bush', 'butterfly'],
      unlockedTerrains: ['stream_forest'],
      fieldGuide: {},          // { birdId: { discovered: bool, timestamp: number } }
    };
  }
};