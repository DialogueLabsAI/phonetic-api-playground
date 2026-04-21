"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AccessStatusBadge } from "@/components/access-status-badge";
import type { MarketplaceSource } from "@/lib/types";
import { Play, Sparkles, Terminal } from "lucide-react";

interface ApiConsoleProps {
  sources: MarketplaceSource[];
  sourceId: string;
  endpointId: string;
  filters: string;
  onSourceChange: (id: string) => void;
  onEndpointChange: (id: string) => void;
  onFiltersChange: (value: string) => void;
  onLoadSample: () => void;
}

export function ApiConsole({
  sources,
  sourceId,
  endpointId,
  filters,
  onSourceChange,
  onEndpointChange,
  onFiltersChange,
  onLoadSample,
}: ApiConsoleProps) {
  const selectedSource = useMemo(
    () => sources.find((s) => s.id === sourceId) ?? null,
    [sources, sourceId]
  );
  const selectedEndpoint = useMemo(
    () =>
      selectedSource?.endpoints.find((e) => e.id === endpointId) ?? null,
    [selectedSource, endpointId]
  );

  const runDisabled = true; // API calls not wired yet

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Console
        </CardTitle>
        <CardDescription>
          Pick a platform, pick an endpoint, optionally add filters, and Run.
          Run is disabled until the API layer is wired — use{" "}
          <em>Load sample rows</em> to preview the tagging output.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* Platform */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="platform">Platform</Label>
            <Select
              id="platform"
              value={sourceId}
              onChange={(e) => onSourceChange(e.target.value)}
            >
              <option value="">Select a marketplace…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.category}
                </option>
              ))}
            </Select>
            {selectedSource && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <AccessStatusBadge status={selectedSource.accessStatus} />
                <span className="text-[10px] text-muted-foreground">
                  {selectedSource.monthlyCost}
                </span>
              </div>
            )}
          </div>

          {/* Endpoint */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Select
              id="endpoint"
              value={endpointId}
              onChange={(e) => onEndpointChange(e.target.value)}
              disabled={!selectedSource}
            >
              <option value="">
                {selectedSource
                  ? "Select an endpoint…"
                  : "Select a platform first"}
              </option>
              {selectedSource?.endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.method} · {e.name}
                </option>
              ))}
            </Select>
            {selectedEndpoint && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge
                  variant={
                    selectedEndpoint.method === "GET" ? "info" : "warning"
                  }
                  className="font-mono"
                >
                  {selectedEndpoint.method}
                </Badge>
                <code className="truncate font-mono text-[10px] text-muted-foreground">
                  {selectedEndpoint.path}
                </code>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-1.5 md:col-span-2 xl:col-span-1">
            <Label htmlFor="filters">Filters (optional)</Label>
            <Textarea
              id="filters"
              value={filters}
              onChange={(e) => onFiltersChange(e.target.value)}
              placeholder={'{\n  "min_dr": 20,\n  "max_spam": 30\n}'}
              className="min-h-[90px] font-mono text-xs"
            />
          </div>
        </div>

        {selectedEndpoint?.description && (
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedEndpoint.name}:
            </span>{" "}
            {selectedEndpoint.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={runDisabled || !selectedEndpoint}
            title={
              runDisabled
                ? "API wiring not implemented yet"
                : "Run this endpoint"
            }
          >
            <Play className="h-3.5 w-3.5" />
            Run endpoint
          </Button>
          <Button variant="secondary" onClick={onLoadSample}>
            <Sparkles className="h-3.5 w-3.5" />
            Load sample rows
          </Button>
          <span className="text-xs text-muted-foreground">
            Sample rows populate the log and the tag-ready list with mock data
            so you can see tagging behavior.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
