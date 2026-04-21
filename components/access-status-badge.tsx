import { Badge } from "@/components/ui/badge";
import type { AccessStatus } from "@/lib/types";

const STATUS_META: Record<
  AccessStatus,
  { label: string; variant: "success" | "warning" | "info" | "muted"; title: string }
> = {
  subscribed: {
    label: "Subscribed",
    variant: "success",
    title: "Commercial subscription gives us API access on payment.",
  },
  "confirmed-open": {
    label: "Confirmed open",
    variant: "info",
    title: "Standard documented API, no approval required.",
  },
  "access-tbd": {
    label: "Access TBD",
    variant: "warning",
    title:
      "Access model unclear or gated by partner status — must be verified in Step 1.",
  },
  scraped: {
    label: "Scraped",
    variant: "muted",
    title: "No official API, stable scrape path. Fragile — maintenance burden.",
  },
};

export function AccessStatusBadge({ status }: { status: AccessStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant={meta.variant} title={meta.title}>
      {meta.label}
    </Badge>
  );
}
