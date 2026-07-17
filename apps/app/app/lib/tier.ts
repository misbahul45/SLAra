import type { RiskTier } from "./types";

// Semantic tier colors (SLARA_FRONTEND_PLAN §2). Hex is for inline styles (dynamic
// widths in EtaBand); the class map is for Tailwind — full literal strings so the
// JIT can see them (dynamically-built class names would be purged).

// MUST stay in sync with the @theme tokens in app.css (--color-safe/-warning/
// -critical) — badges use the Tailwind classes, maps/EtaBand use these hex values,
// and the same tier has to read as the same color in both.
export const TIER_HEX: Record<RiskTier, string> = {
  SAFE: "#2f9e6b",
  WARNING: "#e0a83a",
  CRITICAL: "#c00000",
};

export const TIER_BADGE_CLASS: Record<RiskTier, string> = {
  SAFE: "border-safe/40 bg-safe/10 text-safe",
  WARNING: "border-warning/40 bg-warning/10 text-warning",
  CRITICAL: "border-critical/40 bg-critical/10 text-critical",
};
