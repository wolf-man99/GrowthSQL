/**
 * Seeded randomness, re-exported from the Meta simulator.
 *
 * Deliberately not a second implementation. Both engines need the same guarantee —
 * that a run is byte-identical given its seed — and two copies of a PRNG is two
 * places for that guarantee to quietly stop being true.
 */
export { mulberry32, stringSeed, streamFor, jitter, type Rng } from '@/lib/simulator/engine/rng';
