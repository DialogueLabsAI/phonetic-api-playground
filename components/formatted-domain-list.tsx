"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { applyTags } from "@/lib/tagging";
import type {
  DomainRow,
  MarketplaceSource,
  TaggingThresholds,
  TagResult,
} from "@/lib/types";
import { ListChecks, Trash2, Download } from "lucide-react";

interface FormattedDomainListProps {
  sources: MarketplaceSource[];
  rows: DomainRow[];
  thresholds: TaggingThresholds;
  onClear: () => void;
}

type FilterMode = "all" | "tagged" | "skipped";

export function FormattedDomainList({
  sources,
  rows,
  thresholds,
  onClear,
}: FormattedDomainListProps) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const tagged = useMemo(
    () => rows.map((r) => ({ row: r, tag: applyTags(r, thresholds) })),
    [rows, thresholds]
  );

  const visible = useMemo(() => {
    return tagged.filter(({ row, tag }) => {
      if (filterMode === "tagged" && tag.skip) return false;
      if (filterMode === "skipped" && !tag.skip) return false;
      if (search && !row.domain.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [tagged, filterMode, search]);

  const taggedCount = tagged.filter((t) => !t.tag.skip).length;
  const skippedCount = tagged.length - taggedCount;

  const copyAsCsv = () => {
    const header =
      "domain,source,channel,dr,tf,ref_domains,monthly_traffic,wayback,tags,confidence,skip_reason";
    const body = tagged
      .map(({ row, tag }) =>
        [
          row.domain,
          sources.find((s) => s.id === row.sourceId)?.name ?? row.sourceId,
          row.channel ?? "",
          row.dr ?? "",
          row.tf ?? "",
          row.referringDomains ?? "",
          row.monthlyTraffic ?? "",
          row.waybackSnapshots ?? "",
          tag.tags.join("|"),
          tag.confidence,
          tag.skipReason ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    navigator.clipboard?.writeText([header, body].join("\n"));
  };

  return (
    <Card className="flex min-h-[680px] flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="h-5 w-5" />
              Tag-ready list
            </CardTitle>
            <CardDescription className="text-sm">
              One row per domain. Tags applied per the MVP Section 4.4 rules.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={copyAsCsv}
              disabled={rows.length === 0}
              title="Copy as CSV"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              disabled={rows.length === 0}
              title="Clear rows"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain…"
            className="h-8 max-w-[14rem] text-xs"
          />
          <Select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            className="h-8 w-auto text-xs"
          >
            <option value="all">All rows</option>
            <option value="tagged">Tagged only</option>
            <option value="skipped">Skipped only</option>
          </Select>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="success">{taggedCount} tagged</Badge>
            <Badge variant="muted">{skippedCount} skipped</Badge>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto rounded-md border bg-muted/20">
          {rows.length === 0 ? (
            <EmptyState />
          ) : visible.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No rows match your filter.
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map(({ row, tag }) => (
                <DomainRowView
                  key={row.id}
                  row={row}
                  tag={tag}
                  source={sources.find((s) => s.id === row.sourceId)}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background">
        <ListChecks className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">No domains yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Once a response comes back, each domain shows up here with its
        signals and applied tags. Click <em>Load sample rows</em> to preview.
      </p>
    </div>
  );
}

function DomainRowView({
  row,
  tag,
  source,
}: {
  row: DomainRow;
  tag: TagResult;
  source?: MarketplaceSource;
}) {
  return (
    <li className="grid grid-cols-1 gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto]">
      {/* Left: domain + source */}
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{row.domain}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{source?.name ?? row.sourceId}</span>
          {row.channel && (
            <>
              <span>·</span>
              <span className="capitalize">{row.channel}</span>
            </>
          )}
        </div>
      </div>

      {/* Middle: signals */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {row.dr != null && <Signal label="DR" value={row.dr} />}
        {row.tf != null && <Signal label="TF" value={row.tf} />}
        {row.referringDomains != null && (
          <Signal label="RefD" value={row.referringDomains} />
        )}
        {row.monthlyTraffic != null && (
          <Signal label="Traffic" value={row.monthlyTraffic} />
        )}
        {row.waybackSnapshots != null && (
          <Signal label="Wayback" value={row.waybackSnapshots} />
        )}
        {row.spamScore != null && (
          <Signal label="Spam" value={row.spamScore} />
        )}
      </div>

      {/* Right: tags */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {tag.skip ? (
          <Badge
            variant="muted"
            title={tag.skipReason ?? "No signals triggered tagging."}
          >
            Skip
          </Badge>
        ) : (
          <>
            {tag.tags.map((t) => (
              <Badge key={t} variant={t === "Authority" ? "success" : "info"}>
                {t}
              </Badge>
            ))}
            {tag.confidence === "low" && (
              <Badge
                variant="warning"
                title="Wayback snapshots below threshold — may be a parking/PBN shell."
              >
                low confidence
              </Badge>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <span className="font-mono">
      <span className="text-foreground">{label}</span>{" "}
      <span>{value.toLocaleString()}</span>
    </span>
  );
}
