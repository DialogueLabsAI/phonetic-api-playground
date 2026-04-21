"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiCallLog, MarketplaceSource } from "@/lib/types";
import { Activity, Trash2 } from "lucide-react";

interface ResponseLogProps {
  sources: MarketplaceSource[];
  logs: ApiCallLog[];
  onClear: () => void;
}

export function ResponseLog({ sources, logs, onClear }: ResponseLogProps) {
  return (
    <Card className="flex min-h-[680px] flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Response log
            </CardTitle>
            <CardDescription className="text-sm">
              Raw request/response entries as they come in from each endpoint.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            disabled={logs.length === 0}
            title="Clear logs"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex-1 overflow-auto rounded-md border bg-muted/20">
          {logs.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y">
              {logs.map((log) => (
                <LogRow key={log.id} log={log} sources={sources} />
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
          <span className="font-mono text-xs">ready for API wiring</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background">
        <Activity className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">No calls yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Select a platform and endpoint above, or click{" "}
        <em>Load sample rows</em> to see a mock entry.
      </p>
    </div>
  );
}

function LogRow({
  log,
  sources,
}: {
  log: ApiCallLog;
  sources: MarketplaceSource[];
}) {
  const source = sources.find((s) => s.id === log.sourceId);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <Badge
          variant={log.method === "GET" ? "info" : "warning"}
          className="font-mono"
        >
          {log.method}
        </Badge>
        <span className="truncate font-medium">
          {source?.name ?? log.sourceId}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {log.endpointId}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={log.status} />
          <span className="font-mono text-xs text-muted-foreground">
            {log.durationMs != null ? `${log.durationMs}ms` : "—"}
          </span>
        </div>
      </div>
      {log.responsePayload !== undefined && (
        <pre className="overflow-auto rounded bg-background/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {safeStringify(log.responsePayload)}
        </pre>
      )}
      {log.errorMessage && (
        <p className="text-xs text-destructive">{log.errorMessage}</p>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: ApiCallLog["status"] }) {
  if (status === "success") return <Badge variant="success">200</Badge>;
  if (status === "error") return <Badge variant="destructive">err</Badge>;
  if (status === "pending") return <Badge variant="info">pending</Badge>;
  return <Badge variant="muted">stub</Badge>;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
