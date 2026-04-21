"use client";

import { useCallback, useState } from "react";
import { ApiConsole } from "@/components/api-console";
import { ResponseLog } from "@/components/response-log";
import { FormattedDomainList } from "@/components/formatted-domain-list";
import { StatsWidgets, LogCountBadge } from "@/components/stats-widgets";
import { DEFAULT_THRESHOLDS } from "@/lib/tagging";
import type {
  ApiCallLog,
  DomainRow,
  MarketplaceSource,
} from "@/lib/types";

interface PlaygroundProps {
  sources: MarketplaceSource[];
}

export function Playground({ sources }: PlaygroundProps) {
  const [sourceId, setSourceId] = useState<string>("");
  const [endpointId, setEndpointId] = useState<string>("");
  const [filters, setFilters] = useState<string>("");
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [rows, setRows] = useState<DomainRow[]>([]);

  // Thresholds are fixed to defaults for now — the tagging config panel
  // has been removed per UX simplification.
  const thresholds = DEFAULT_THRESHOLDS;

  const onSourceChange = useCallback((id: string) => {
    setSourceId(id);
    setEndpointId("");
  }, []);

  const loadSample = useCallback(() => {
    // Mock data — lets the user preview the formatted list + tagging behavior
    // before any real API is wired.
    const ts = new Date().toISOString();
    const activeSource = sources.find((s) => s.id === sourceId) ?? sources[0];
    const endpoint =
      activeSource?.endpoints.find((e) => e.id === endpointId) ??
      activeSource?.endpoints[0];

    const samples = buildSampleRows(activeSource?.id ?? "domcop", endpoint?.id);

    const log: ApiCallLog = {
      id: crypto.randomUUID(),
      timestamp: ts,
      sourceId: activeSource?.id ?? "domcop",
      endpointId: endpoint?.id ?? "sample",
      method: endpoint?.method ?? "GET",
      status: "stub",
      durationMs: Math.floor(80 + Math.random() * 120),
      responsePayload: { count: samples.length, items: samples },
    };

    setLogs((prev) => [log, ...prev]);

    // Dedupe by domain — newer data replaces the older row for the same
    // domain, so the tag-ready list stays at one entry per domain.
    setRows((prev) => {
      const byDomain = new Map(prev.map((r) => [r.domain.toLowerCase(), r]));
      for (const s of samples) {
        byDomain.set(s.domain.toLowerCase(), s);
      }
      return Array.from(byDomain.values());
    });
  }, [sourceId, endpointId, sources]);

  return (
    <div className="flex flex-col gap-6">
      <ApiConsole
        sources={sources}
        sourceId={sourceId}
        endpointId={endpointId}
        filters={filters}
        onSourceChange={onSourceChange}
        onEndpointChange={setEndpointId}
        onFiltersChange={setFilters}
        onLoadSample={loadSample}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Overview</h2>
          <LogCountBadge count={logs.length} />
        </div>
        <StatsWidgets rows={rows} logCount={logs.length} thresholds={thresholds} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ResponseLog
          sources={sources}
          logs={logs}
          onClear={() => setLogs([])}
        />
        <FormattedDomainList
          sources={sources}
          rows={rows}
          thresholds={thresholds}
          onClear={() => setRows([])}
        />
      </div>
    </div>
  );
}

// ───── Sample data generator ─────
// Produces a spread of rows that exercise each branch of the tagging logic:
// Authority-only, Traffic-only, both, skip (no signals), and low confidence.
function buildSampleRows(sourceId: string, endpointId?: string): DomainRow[] {
  const base = [
    {
      domain: "oldtravelblog.com",
      channel: "expired" as const,
      dr: 34,
      tf: 22,
      referringDomains: 240,
      monthlyTraffic: 1200,
      waybackSnapshots: 184,
      spamScore: 2,
    },
    {
      domain: "vintage-cameras.co",
      channel: "expired" as const,
      dr: 18,
      tf: 6,
      referringDomains: 45,
      monthlyTraffic: 0,
      waybackSnapshots: 62,
      spamScore: 4,
    },
    {
      domain: "indie-recipe-hub.net",
      channel: "expired" as const,
      dr: 3,
      tf: 1,
      referringDomains: 7,
      monthlyTraffic: 340,
      waybackSnapshots: 19,
      spamScore: 6,
    },
    {
      domain: "random-empty-name.xyz",
      channel: "expired" as const,
      dr: 0,
      tf: 0,
      referringDomains: 2,
      monthlyTraffic: 0,
      waybackSnapshots: 1,
      spamScore: 0,
    },
    {
      domain: "shady-pbn-shell.info",
      channel: "expired" as const,
      dr: 22,
      tf: 14,
      referringDomains: 88,
      monthlyTraffic: 12,
      waybackSnapshots: 0,
      spamScore: 68,
    },
    {
      domain: "squadhelp-brand-name.com",
      channel: "buy-now" as const,
      isBrandableMarketplace: true,
      dr: 0,
      tf: 0,
      referringDomains: 0,
      monthlyTraffic: 0,
      waybackSnapshots: 0,
    },
  ];
  return base.map((b) => ({
    id: crypto.randomUUID(),
    sourceId,
    endpointId,
    ...b,
  }));
}
