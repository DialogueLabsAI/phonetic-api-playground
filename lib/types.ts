// Taxonomy drawn from Section 6 of the Data Layer Proposal v5.
// "Access Status" describes whether we can actually reach the source programmatically.
export type AccessStatus =
  | "subscribed" // Commercial subscription gives API access on payment.
  | "confirmed-open" // Standard documented APIs, no approval required.
  | "access-tbd" // Access model unclear or gated by partner status. Must be verified in Step 1.
  | "scraped"; // No official API, stable scrape path. Fragile.

export type MarketplaceCategory =
  | "aggregator"
  | "marketplace"
  | "auction"
  | "backorder"
  | "availability"
  | "meta-aggregator";

export type MvpStatus = "yes" | "contingent" | "post-mvp" | "skip";

export type AcquisitionChannel =
  | "expired"
  | "auction"
  | "buy-now"
  | "unregistered";

export type DomainType = "traffic" | "authority" | "keyword" | "branded";

// An endpoint placeholder — no implementation yet. The "Run" button will be
// disabled in the UI until API wiring is added.
export interface EndpointStub {
  id: string;
  name: string;
  method: "GET" | "POST";
  path: string;
  description: string;
  // Which domain types this endpoint serves. Empty = applies to all.
  relevantTo?: DomainType[];
}

export interface MarketplaceSource {
  id: string;
  name: string;
  category: MarketplaceCategory;
  accessStatus: AccessStatus;
  monthlyCost: string; // e.g. "$99", "Free", "Free browse"
  mvp: MvpStatus;
  channels: AcquisitionChannel[];
  // Short blurb (from Section 6) describing what the source provides.
  description: string;
  // What still needs to be verified in Step 1 (Access Verification).
  accessNotes?: string;
  // Docs / signup URL (for reference, not called).
  docsUrl?: string;
  endpoints: EndpointStub[];
}

// A log entry for the request/response monitor panel. No real calls yet —
// this type exists so the panel has a stable shape the API layer can write to later.
export interface ApiCallLog {
  id: string;
  timestamp: string; // ISO
  sourceId: string;
  endpointId: string;
  method: string;
  status: "pending" | "success" | "error" | "stub";
  durationMs?: number;
  requestPayload?: Record<string, unknown>;
  responsePayload?: unknown;
  errorMessage?: string;
}

// Tagging strategy — Section 4.4 of the proposal.
export interface TaggingThresholds {
  drMin: number; // Authority tag if DR >= drMin
  tfMin: number; // Authority tag if TF >= tfMin
  referringDomainsMin: number; // Authority tag if referring domains >= this
  monthlyTrafficMin: number; // Traffic tag if estimated traffic > this
  minWaybackSnapshots: number; // Stage 3: below this, downgrade confidence
}

// A row in the formatted tag-ready list. Sourced from either a real
// endpoint response or the sample-data button, then decorated with tags.
export interface DomainRow {
  id: string;
  domain: string;
  sourceId: string;
  endpointId?: string;
  channel?: AcquisitionChannel;
  isBrandableMarketplace?: boolean;
  dr?: number;
  tf?: number;
  referringDomains?: number;
  monthlyTraffic?: number;
  waybackSnapshots?: number;
  spamScore?: number;
  raw?: unknown; // original payload
}

export type TagName = "Authority" | "Traffic";
export type TagConfidence = "full" | "low" | "unknown";

export interface TagResult {
  tags: TagName[];
  skip: boolean;
  skipReason?: string;
  confidence: TagConfidence;
}
