export function clampPosition(position, windowSize, viewport) {
  return {
    x: Math.max(0, Math.min(position.x, Math.max(0, viewport.width - windowSize.width))),
    y: Math.max(0, Math.min(position.y, Math.max(0, viewport.height - windowSize.height))),
  };
}
