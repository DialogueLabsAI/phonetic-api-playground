"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Loader2, Globe, RefreshCw, AlertTriangle } from "lucide-react";
import type { ScrapeResult } from "@/lib/scrapers/expired-domains";

type ScraperState =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "success"; data: ScrapeResult }
  | { status: "error"; message: string };

export function ExpiredDomainsLauncher() {
  const [state, setState] = useState<ScraperState>({ status: "idle" });

  const run = async () => {
    setState({ status: "running", startedAt: Date.now() });
    try {
      const res = await fetch("/api/expired-domains/scrape", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || `Scrape failed (${res.status})`);
      }
      setState({ status: "success", data: body as ScrapeResult });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message });
    }
  };

  const running = state.status === "running";
  const success = state.status === "success";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          GoDaddy Auctions scraper
          <Badge variant="outline" className="ml-1 font-normal">
            Visible Chrome · stealth
          </Badge>
        </CardTitle>
        <CardDescription>
          <strong>A Chrome window will pop up on your Mac</strong> when you
          click Start scrape — that's intentional. GoDaddy's Akamai Bot
          Manager flags headless Chrome on sight, so the scraper runs in
          a visible window using your installed Chrome (channel:{" "}
          <code className="font-mono text-xs">chrome</code>) plus{" "}
          <code className="font-mono text-xs">playwright-extra</code>{" "}
          stealth evasions. It navigates{" "}
          <code className="font-mono text-xs">auctions.godaddy.com/beta</code>,
          opens <em>Advanced Search</em>, ticks Type ={" "}
          <code className="font-mono text-xs">Expiring</code> +{" "}
          <code className="font-mono text-xs">Closeouts</code>, sets{" "}
          <em>Time to end → Hours</em> ={" "}
          <code className="font-mono text-xs">12</code>, scrapes the first
          page with human-like timing, and closes itself. You can
          watch it work. The persistent profile at{" "}
          <code className="font-mono text-xs">auth/browser-data/</code>{" "}
          (seeded by <code className="font-mono text-xs">npm run capture-login</code>)
          carries the Akamai <code className="font-mono text-xs">_abck</code>{" "}
          clearance between runs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scraping…
              </>
            ) : success ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Run again
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Start scrape
              </>
            )}
          </Button>

          {success && (
            <span className="text-xs text-muted-foreground">
              {state.data.domains.length} auctions on page 1 ·{" "}
              {(state.data.elapsedMs / 1000).toFixed(1)}s · types:{" "}
              <code className="font-mono text-[10px]">
                {state.data.pageInfo.appliedFilters.types.join(", ") || "—"}
              </code>
              {state.data.pageInfo.appliedFilters.timeToEnd.length > 0 && (
                <>
                  {" "}
                  · time:{" "}
                  <code className="font-mono text-[10px]">
                    {state.data.pageInfo.appliedFilters.timeToEnd.join(", ")}
                  </code>
                </>
              )}
              {state.data.pageInfo.usedSavedSession && " · logged in"}
            </span>
          )}
          {success && state.data.pageInfo.pagination.lastPage !== null && (
            <span className="text-xs font-medium">
              ≈{" "}
              <span className="text-foreground">
                {state.data.pageInfo.pagination.estimateTotal?.toLocaleString() ??
                  "?"}
              </span>{" "}
              <span className="text-muted-foreground">
                records ({state.data.pageInfo.pagination.lastPage.toLocaleString()}{" "}
                pages × {state.data.pageInfo.pagination.pageSize}/pg · walker:{" "}
                <code className="font-mono text-[10px]">
                  {state.data.pageInfo.pagination.method}
                </code>
                , {state.data.pageInfo.pagination.steps} step
                {state.data.pageInfo.pagination.steps === 1 ? "" : "s"})
              </span>
            </span>
          )}
          {success && state.data.pageInfo.pagination.lastPage === null && (
            <span className="text-xs text-muted-foreground">
              pagination: <code className="font-mono text-[10px]">
                {state.data.pageInfo.pagination.method}
              </code>{" "}
              (no estimate)
            </span>
          )}
          {running && (
            <span className="text-xs text-muted-foreground">
              Chrome window open on your Mac — the script adds real-user
              delays on purpose. 15–40s.
            </span>
          )}
        </div>

        {state.status === "error" && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">Scrape failed</span>
              <code className="whitespace-pre-wrap font-mono text-[11px]">
                {state.message}
              </code>
              <span className="text-muted-foreground">
                First-time setup:{" "}
                <code className="font-mono">npx playwright install chromium</code>.
                If the page needs to be solved/loaded visually, run{" "}
                <code className="font-mono">
                  EXPIRED_DOMAINS_HEADLESS=false npm run dev
                </code>
                . Any screenshot + HTML paths in the error above are in{" "}
                <code className="font-mono">/tmp</code> — open the HTML and
                I can update the selectors from what you see.
              </span>
            </div>
          </div>
        )}

        {state.status === "success" && <ResultsTable data={state.data} />}
      </CardContent>
    </Card>
  );
}

function ResultsTable({ data }: { data: ScrapeResult }) {
  const rows = data.domains;

  // Render whatever columns the scraper actually found. If it fell back
  // to the text-scan strategy, columns is empty — in that case just show
  // the domain.
  const columns = useMemo(() => {
    if (data.pageInfo.columns.length > 0) return data.pageInfo.columns;
    // Derive from the union of keys across rows.
    const keys = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r.fields)) keys.add(k);
    }
    return Array.from(keys);
  }, [data.pageInfo.columns, rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        No .com rows returned. The page loaded but no matching rows were
        found — check the source URL or widen the scrape strategy in{" "}
        <code className="font-mono">lib/scrapers/expired-domains.ts</code>.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Results · {rows.length} rows · {columns.length || 1} columns
        </span>
        <a
          href={data.pageInfo.finalUrl || data.pageInfo.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          source
        </a>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/70 backdrop-blur">
            <tr className="[&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>Domain</th>
              {columns
                .filter((c) => c.toLowerCase() !== "domain")
                .map((c) => (
                  <th key={c}>{c}</th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.domain}-${i}`}
                className="border-t [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-1.5 [&>td]:align-top"
              >
                <td className="font-mono">{r.domain}</td>
                {columns
                  .filter((c) => c.toLowerCase() !== "domain")
                  .map((c) => (
                    <td
                      key={c}
                      className="max-w-[280px] truncate"
                      title={r.fields[c] || ""}
                    >
                      {r.fields[c] || "—"}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Raw JSON ({rows.length} rows)
        </summary>
        <pre className="mt-2 max-h-[300px] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-[11px]">
{JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}
