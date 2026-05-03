import type { GoalType } from "@/types";

export const GOAL_TYPE_META: Record<GoalType, { label: string; emoji: string; bg: string; badge: string }> = {
  EMERGENCY_FUND: { label: "Emergency Fund", emoji: "🛡️", bg: "bg-amber-500/15",  badge: "bg-amber-500/10 text-amber-400 border-amber-500/25" },
  SAVINGS:        { label: "Savings",         emoji: "🐷", bg: "bg-emerald-500/15", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
  INVESTMENT:     { label: "Investment",      emoji: "📈", bg: "bg-blue-500/15",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/25" },
  TRAVEL:         { label: "Travel",          emoji: "✈️", bg: "bg-cyan-500/15",    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" },
  DEBT_PAYOFF:    { label: "Debt Payoff",     emoji: "💳", bg: "bg-rose-500/15",    badge: "bg-rose-500/10 text-rose-400 border-rose-500/25" },
  CUSTOM:         { label: "Custom",          emoji: "⭐", bg: "bg-purple-500/15",  badge: "bg-purple-500/10 text-purple-400 border-purple-500/25" },
};
