import { MARKETPLACE_SOURCES } from "@/data/marketplaces";
import { Playground } from "@/components/playground";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccessStatusBadge } from "@/components/access-status-badge";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="container mx-auto flex max-w-7xl flex-col gap-8 py-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">MVP</Badge>
            <span>·</span>
            <span>Expired channel · Traffic &amp; Authority types</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            API Playground — Marketplace Access
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Pick a platform, pick an endpoint, add optional filters, and the
            response lands in the log. Each domain surfaces once in the
            tag-ready list with Authority / Traffic / Skip applied.
          </p>
          <AccessLegend />
        </div>
        <ThemeToggle />
      </header>

      <Playground sources={MARKETPLACE_SOURCES} />

      <footer className="mt-4 border-t pt-4 text-xs text-muted-foreground">
        Based on Data Layer Proposal v5 · Sections 3, 4.4, and 6. Endpoint
        wiring is intentionally deferred until marketplace access is
        verified in Step 1.
      </footer>
    </main>
  );
}

function AccessLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-muted-foreground">
      <LegendItem status="subscribed">API access on payment</LegendItem>
      <LegendItem status="confirmed-open">Open, documented</LegendItem>
      <LegendItem status="access-tbd">Partner-gated, verify Step 1</LegendItem>
      <LegendItem status="scraped">No official API</LegendItem>
    </div>
  );
}

function LegendItem({
  status,
  children,
}: {
  status: Parameters<typeof AccessStatusBadge>[0]["status"];
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <AccessStatusBadge status={status} />
      <span>{children}</span>
    </div>
  );
}
