export type Tier = "free" | "plus" | "legacy";

export interface Entitlements {
  dailyMessages: number;
  voice: boolean;
  fullMemoryTimeline: boolean;
  letters: boolean;
  roomCustomization: boolean;
  multipleAI: number;
  advancedExport: boolean;
  customGrowthSpeed: boolean;
  premiumKeepsakes: boolean;
}

export const TIER_ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: {
    dailyMessages: 30, voice: false, fullMemoryTimeline: false, letters: false,
    roomCustomization: false, multipleAI: 1, advancedExport: false,
    customGrowthSpeed: false, premiumKeepsakes: false,
  },
  plus: {
    dailyMessages: 250, voice: true, fullMemoryTimeline: true, letters: true,
    roomCustomization: true, multipleAI: 1, advancedExport: false,
    customGrowthSpeed: false, premiumKeepsakes: true,
  },
  legacy: {
    dailyMessages: 600, voice: true, fullMemoryTimeline: true, letters: true,
    roomCustomization: true, multipleAI: 5, advancedExport: true,
    customGrowthSpeed: true, premiumKeepsakes: true,
  },
};

export function normalizeTier(value: unknown): Tier {
  return value === "plus" || value === "legacy" ? value : "free";
}

export function entitlementsForTier(value: unknown): Entitlements {
  return TIER_ENTITLEMENTS[normalizeTier(value)];
}
