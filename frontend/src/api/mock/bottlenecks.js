/**
 * @file bottlenecks.js
 * Mock handlers for active hospital operational bottlenecks and cascade chains.
 */

import { hospitalState } from './seed.js';

/**
 * Get active bottlenecks with cascade propagation chains.
 */
export function mockGetBottlenecks() {
  return hospitalState.bottlenecks;
}

/**
 * Get bottleneck by ID.
 */
export function mockGetBottleneckById(id) {
  const btn = hospitalState.bottlenecks.find((b) => b.id === id);
  if (!btn) throw new Error(`Bottleneck ${id} not found`);
  return btn;
}
