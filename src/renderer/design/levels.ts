// Learner-facing Help Ladder names. Internal ids stay 1..4; the deterministic LevelEngine owns the level.
import type { HelpLevel } from '../../shared/protocol';

export type HelpLevelId = HelpLevel;

export const LEVEL_NAMES: Readonly<Record<HelpLevelId, string>> = {
  1: 'Watch me',
  2: 'Walk with me',
  3: 'Nudge me',
  4: 'On my own',
};

export const LEVEL_BLURBS: Readonly<Record<HelpLevelId, string>> = {
  1: 'I show you each step first.',
  2: 'One step at a time, and I check each one.',
  3: 'You lead. I only step in if you pause.',
  4: 'You do it your way. I stay quiet.',
};

// How much of the ladder is "support" at each level: drives the chip's draining bars.
export const LEVEL_SUPPORT: Readonly<Record<HelpLevelId, number>> = { 1: 4, 2: 3, 3: 2, 4: 1 };
