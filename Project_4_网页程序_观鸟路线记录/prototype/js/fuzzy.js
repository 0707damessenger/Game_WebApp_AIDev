(function attachFuzzyMatch(root) {
  function normalizeFeatures(features = {}) {
    return {
      size: features.size || '',
      colors: normalizeArray(features.colors),
      behaviors: normalizeArray(features.behaviors),
      habitats: normalizeArray(features.habitats),
    };
  }

  function hasManualFeature(features = {}) {
    const normalized = normalizeFeatures(features);
    return Boolean(normalized.size) ||
      normalized.colors.length > 0 ||
      normalized.behaviors.length > 0 ||
      normalized.habitats.length > 0;
  }

  function matchCandidates(features = {}, options = {}) {
    const config = options.config || root.CONFIG || {};
    const fuzzyConfig = config.fuzzyMatch || {};
    const weights = fuzzyConfig.weights || { size: 3, color: 1, behavior: 2, habitat: 2 };
    const maxCandidates = fuzzyConfig.maxCandidates || 5;
    const traitTable = Array.isArray(options.traits)
      ? options.traits
      : (Array.isArray(root.BIRD_TRAITS) ? root.BIRD_TRAITS : []);
    const normalized = normalizeFeatures(features);

    return traitTable
      .map((bird) => ({
        name: bird.name,
        scientificName: bird.scientificName || '',
        score: scoreBird(bird, normalized, weights),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, maxCandidates);
  }

  function scoreBird(bird, features, weights) {
    let score = 0;
    if (features.size && bird.size && bird.size === features.size) {
      score += weights.size;
    }
    score += overlapCount(bird.colors, features.colors) * weights.color;
    score += overlapCount(bird.behaviors, features.behaviors) * weights.behavior;
    score += overlapCount(bird.habitats, features.habitats) * weights.habitat;
    return score;
  }

  function overlapCount(birdValues, userValues) {
    const set = normalizeArray(birdValues);
    return normalizeArray(userValues).filter((value) => set.includes(value)).length;
  }

  function normalizeArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  const api = {
    normalizeFeatures,
    hasManualFeature,
    matchCandidates,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BirdFuzzyMatch = api;
})(typeof window !== 'undefined' ? window : globalThis);
