/**
 * Pick the right Piper TTS model tier for this machine.
 *
 * Heuristic deliberately ignores GPU — Piper's CPU path is fast enough that
 * adding CUDA/ROCm/MPS plumbing is net-negative for first release. RAM is the
 * bottleneck on small laptops; CPU count gates whether we can afford the
 * higher-quality (slower) model without choking live cue latency.
 */

import os from 'node:os';

/**
 * @param {{ totalRamGB: number, cpuCount: number }} hw
 * @returns {'low' | 'medium' | 'high'}
 */
export function pickModelTier({ totalRamGB, cpuCount }) {
  if (totalRamGB >= 16 && cpuCount >= 8) return 'high';
  if (totalRamGB >= 6 && cpuCount >= 4) return 'medium';
  return 'low';
}

/**
 * Read the host hardware. Round RAM down to whole GB so a 7.9 GB machine
 * doesn't tip into the 8 GB tier on rounding.
 */
export function detectHardware() {
  const totalRamGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
  const cpuCount = os.cpus().length;
  return {
    totalRamGB,
    cpuCount,
    platform: process.platform,
    arch: process.arch,
  };
}

/**
 * One-shot: detect + pick. The companion calls this on first launch and
 * caches the result in `config.json` so subsequent launches don't re-decide.
 */
export function recommendVoice() {
  const hw = detectHardware();
  const tier = pickModelTier(hw);
  return {
    hardware: hw,
    tier,
    voice: defaultVoiceForTier(tier),
  };
}

const TIER_DEFAULT_VOICE = {
  low: { lang: 'en', region: 'en_US', name: 'amy', quality: 'low' },
  medium: { lang: 'en', region: 'en_US', name: 'amy', quality: 'medium' },
  high: { lang: 'en', region: 'en_US', name: 'libritts', quality: 'high' },
};

export function defaultVoiceForTier(tier) {
  return TIER_DEFAULT_VOICE[tier] ?? TIER_DEFAULT_VOICE.medium;
}
