import type { RiskTier } from "./types";

// Semantic tier colors (SLARA_FRONTEND_PLAN §2). Hex is for inline styles (dynamic
// widths in EtaBand); the class map is for Tailwind — full literal strings so the
// JIT can see them (dynamically-built class names would be purged).

export const TIER_HEX: Record<RiskTier, string> = {
  SAFE: "#2fbf71",
  WARNING: "#f5a623",
  CRITICAL: "#e5484d",
};

export const TIER_BADGE_CLASS: Record<RiskTier, string> = {
  SAFE: "border-safe/40 bg-safe/10 text-safe",
  WARNING: "border-warning/40 bg-warning/10 text-warning",
  CRITICAL: "border-critical/40 bg-critical/10 text-critical",
};
