(function attachFuzzyMatch(root) {
  function normalizeFeatures(features = {}) {
    return {
      size: features.size || '',
      colors: normalizeArray(features.colors),
      behaviors: normalizeArray(features.behaviors),
      habitats: normalizeArray(features.habitats),
      postures: normalizeArray(features.postures),
    };
  }

  function hasManualFeature(features = {}) {
    const normalized = normalizeFeatures(features);
    return Boolean(normalized.size) ||
      normalized.colors.length > 0 ||
      normalized.behaviors.length > 0 ||
      normalized.habitats.length > 0 ||
      normalized.postures.length > 0;
  }

  function matchCandidates(features = {}, options = {}) {
    const config = options.config || root.CONFIG || {};
    const rules = Array.isArray(config.fuzzyMatch && config.fuzzyMatch.candidateRules)
      ? config.fuzzyMatch.candidateRules
      : [];
    const normalized = normalizeFeatures(features);

    return rules
      .map((rule) => {
        const score = scoreRule(rule.traits || {}, normalized);
        return {
          name: rule.name,
          scientificName: rule.scientificName || '',
          score,
        };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
      .slice(0, 5);
  }

  function scoreRule(traits, features) {
    let score = 0;
    if (features.size && includesTrait(traits.size, features.size)) {
      score += 3;
    }
    score += overlapScore(traits.colors, features.colors);
    score += overlapScore(traits.behaviors, features.behaviors) * 2;
    score += overlapScore(traits.habitats, features.habitats) * 2;
    score += overlapScore(traits.postures, features.postures);
    return score;
  }

  function overlapScore(traits, values) {
    const traitValues = normalizeArray(traits);
    return normalizeArray(values).filter((value) => traitValues.includes(value)).length;
  }

  function includesTrait(traits, value) {
    return normalizeArray(traits).includes(value);
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
