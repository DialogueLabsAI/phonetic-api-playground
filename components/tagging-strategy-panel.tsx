"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_THRESHOLDS } from "@/lib/tagging";
import type { TaggingThresholds } from "@/lib/types";
import { Tag, Check, X, Archive } from "lucide-react";

interface TaggingStrategyPanelProps {
  thresholds: TaggingThresholds;
  onChange: (next: TaggingThresholds) => void;
}

export function TaggingStrategyPanel({
  thresholds,
  onChange,
}: TaggingStrategyPanelProps) {
  const update = (key: keyof TaggingThresholds, value: number) => {
    onChange({ ...thresholds, [key]: value });
  };

  const reset = () => onChange(DEFAULT_THRESHOLDS);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tagging strategy (MVP)
            </CardTitle>
            <CardDescription>
              Rule-out then confirm. Thresholds here feed directly into the
              tag-ready list.
            </CardDescription>
          </div>
          <button
            onClick={reset}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Reset defaults
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <Stage
          number={1}
          title="Rule out for free (source metadata only)"
          description="Decide before any skill fires, using only the acquisition channel."
        >
          <RuleRow
            ok={false}
            text="Unregistered channel → rule out Traffic & Authority (no visitors, no aged backlinks)."
          />
          <RuleRow
            ok={false}
            text="Brandable marketplaces (Atom, BrandBucket, Squadhelp) → ruled out by seller classification."
          />
          <RuleRow
            ok
            text="Expired / Auction / Buy Now → Traffic & Authority remain possible. Proceed to Stage 2."
          />
        </Stage>

        <Separator />

        <Stage
          number={2}
          title="Confirm using signals already in the feed"
          description="DomCop & SpamZilla already attach these signals — no extra API calls."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ThresholdInput
              label="DR ≥"
              sub="Authority tag"
              value={thresholds.drMin}
              onChange={(v) => update("drMin", v)}
            />
            <ThresholdInput
              label="TF ≥"
              sub="Authority tag"
              value={thresholds.tfMin}
              onChange={(v) => update("tfMin", v)}
            />
            <ThresholdInput
              label="Referring domains ≥"
              sub="Authority tag"
              value={thresholds.referringDomainsMin}
              onChange={(v) => update("referringDomainsMin", v)}
            />
            <ThresholdInput
              label="Monthly traffic >"
              sub="Traffic tag"
              value={thresholds.monthlyTrafficMin}
              onChange={(v) => update("monthlyTrafficMin", v)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A single domain can carry both tags — many expired domains have
            residual authority <em>and</em> residual traffic. Feed shows zero
            on both → skip the domain entirely.
          </p>
        </Stage>

        <Separator />

        <Stage
          number={3}
          title="One cheap confirmatory skill (Wayback)"
          description="Free, rate-limited. Confirms a real site ever existed on the domain."
        >
          <div className="flex flex-wrap items-end gap-3">
            <ThresholdInput
              label={
                <span className="flex items-center gap-1">
                  <Archive className="h-3 w-3" /> Min snapshots
                </span>
              }
              sub="Below this → downgrade confidence"
              value={thresholds.minWaybackSnapshots}
              onChange={(v) => update("minWaybackSnapshots", v)}
            />
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Healthy history:</strong>{" "}
                tags confirmed at full confidence.
              </p>
              <p>
                <strong className="text-foreground">Low history:</strong>{" "}
                shown as &ldquo;low confidence&rdquo; flag; likely parking /
                PBN shell.
              </p>
            </div>
          </div>
        </Stage>

        <Separator />

        <div className="rounded-md border bg-muted/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="info">Current rule</Badge>
            <span className="text-xs text-muted-foreground">
              As applied by the tag-ready list
            </span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {formatRule(thresholds)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function Stage({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {number}
        </div>
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="ml-9 flex flex-col gap-3">{children}</div>
    </div>
  );
}

function RuleRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{text}</span>
    </div>
  );
}

function ThresholdInput({
  label,
  sub,
  value,
  onChange,
}: {
  label: React.ReactNode;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="h-8 font-mono text-xs"
      />
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </label>
  );
}

function formatRule(t: TaggingThresholds): string {
  return (
    `// MVP tagging rules (Section 4.4)\n` +
    `function tag(domain) {\n` +
    `  if (channel === "unregistered") return { skip: true };\n` +
    `  if (isBrandableMarketplace(channel)) return { skip: true };\n` +
    `\n  const tags = new Set();\n` +
    `  if (\n` +
    `    domain.dr >= ${t.drMin} ||\n` +
    `    domain.tf >= ${t.tfMin} ||\n` +
    `    domain.referringDomains >= ${t.referringDomainsMin}\n` +
    `  ) tags.add("Authority");\n` +
    `  if (domain.monthlyTraffic > ${t.monthlyTrafficMin}) tags.add("Traffic");\n` +
    `  if (tags.size === 0) return { skip: true };\n` +
    `\n  // Stage 3 — Wayback confirmation\n` +
    `  const confidence =\n` +
    `    domain.waybackSnapshots < ${t.minWaybackSnapshots} ? "low" : "full";\n` +
    `  return { tags: [...tags], confidence };\n` +
    `}`
  );
}
