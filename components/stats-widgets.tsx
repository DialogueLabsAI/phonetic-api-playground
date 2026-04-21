"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { applyTags } from "@/lib/tagging";
import type { DomainRow, TaggingThresholds } from "@/lib/types";
import {
  Database,
  Shield,
  TrendingUp,
  SkipForward,
  AlertTriangle,
  Inbox,
} from "lucide-react";

interface StatsWidgetsProps {
  rows: DomainRow[];
  logCount: number;
  thresholds: TaggingThresholds;
}

export function StatsWidgets({
  rows,
  logCount,
  thresholds,
}: StatsWidgetsProps) {
  const stats = useMemo(() => {
    let authority = 0;
    let traffic = 0;
    let both = 0;
    let skipped = 0;
    let lowConfidence = 0;
    for (const row of rows) {
      const tag = applyTags(row, thresholds);
      if (tag.skip) {
        skipped++;
        continue;
      }
      const hasAuth = tag.tags.includes("Authority");
      const hasTraf = tag.tags.includes("Traffic");
      if (hasAuth) authority++;
      if (hasTraf) traffic++;
      if (hasAuth && hasTraf) both++;
      if (tag.confidence === "low") lowConfidence++;
    }
    return { authority, traffic, both, skipped, lowConfidence };
  }, [rows, thresholds]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Widget
        icon={<Database className="h-4 w-4" />}
        label="Domains"
        value={rows.length}
        hint="Unique rows in the list"
        tone="default"
      />
      <Widget
        icon={<Shield className="h-4 w-4" />}
        label="Authority"
        value={stats.authority}
        hint="DR/TF/RefD over threshold"
        tone="success"
      />
      <Widget
        icon={<TrendingUp className="h-4 w-4" />}
        label="Traffic"
        value={stats.traffic}
        hint="Residual organic traffic"
        tone="info"
      />
      <Widget
        icon={<span className="text-[10px] font-bold">∩</span>}
        label="Both tags"
        value={stats.both}
        hint="Authority + Traffic"
        tone="accent"
      />
      <Widget
        icon={<SkipForward className="h-4 w-4" />}
        label="Skipped"
        value={stats.skipped}
        hint="No signals / ruled out"
        tone="muted"
      />
      <Widget
        icon={<AlertTriangle className="h-4 w-4" />}
        label="Low conf."
        value={stats.lowConfidence}
        hint="Wayback below threshold"
        tone="warning"
      />
    </div>
  );
}

type Tone =
  | "default"
  | "success"
  | "info"
  | "accent"
  | "muted"
  | "warning";

const TONE_CLASSES: Record<Tone, { ring: string; icon: string }> = {
  default: { ring: "", icon: "text-muted-foreground" },
  success: {
    ring: "border-emerald-500/40",
    icon: "text-emerald-500",
  },
  info: { ring: "border-sky-500/40", icon: "text-sky-500" },
  accent: { ring: "border-violet-500/40", icon: "text-violet-500" },
  muted: { ring: "", icon: "text-muted-foreground" },
  warning: { ring: "border-amber-500/40", icon: "text-amber-500" },
};

// Secondary widget for showing the total logged requests (kept as a separate
// helper so the page can render it inline if needed).
export function LogCountBadge({ count }: { count: number }) {
  return (
    <Card className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <Inbox className="h-3.5 w-3.5" />
      <span>{count} request{count === 1 ? "" : "s"} logged</span>
    </Card>
  );
}

function Widget({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  tone: Tone;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <Card className={`flex flex-col gap-1 p-4 ${t.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className={t.icon}>{icon}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </Card>
  );
}
