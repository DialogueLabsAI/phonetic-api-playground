import type { MarketplaceSource } from "@/lib/types";

// Marketplace sources for the Expired Domains channel — MVP scope.
// Copy is drawn directly from Section 6 of the Data Layer Proposal v5.
// These are placeholders for API wiring that will be added later.
export const MARKETPLACE_SOURCES: MarketplaceSource[] = [
  // ──────────────── Subscribed (MVP-mandatory) ────────────────
  {
    id: "domcop",
    name: "DomCop (Power)",
    category: "aggregator",
    accessStatus: "subscribed",
    monthlyCost: "$99/mo",
    mvp: "yes",
    channels: ["expired", "auction", "buy-now"],
    description:
      "Aggregated inventory feeds + Moz / Majestic / SEMrush / SimilarWeb / Estibot data through one API. Possibly the primary path to marketplace inventory at MVP.",
    accessNotes:
      "Verify exactly which marketplaces are in the feed, freshness of live auction bid state, and completeness vs. direct sources.",
    docsUrl: "https://www.domcop.com/",
    endpoints: [
      {
        id: "domcop-inventory",
        name: "List Expired Inventory",
        method: "GET",
        path: "/api/domcop/inventory",
        description:
          "Pull the current expired-domain inventory feed with aggregated value signals (DR, TF, traffic).",
      },
      {
        id: "domcop-metrics",
        name: "Get Domain Metrics",
        method: "GET",
        path: "/api/domcop/metrics/:domain",
        description:
          "DR, DA, TF, CF, referring domains, SEMrush traffic estimate for a single domain.",
        relevantTo: ["authority", "traffic"],
      },
      {
        id: "domcop-auctions",
        name: "List Live Auctions",
        method: "GET",
        path: "/api/domcop/auctions",
        description:
          "Current live auction listings aggregated across marketplaces (coverage TBD).",
      },
    ],
  },
  {
    id: "spamzilla",
    name: "SpamZilla",
    category: "aggregator",
    accessStatus: "subscribed",
    monthlyCost: "$37/mo",
    mvp: "yes",
    channels: ["expired"],
    description:
      "Expired-focused inventory with built-in spam filtering. API access included in subscription.",
    accessNotes:
      "Verify coverage of live expired auctions vs. just dropped domains; confirm feed freshness.",
    docsUrl: "https://www.spamzilla.io/",
    endpoints: [
      {
        id: "spamzilla-inventory",
        name: "List Expired Inventory",
        method: "GET",
        path: "/api/spamzilla/inventory",
        description:
          "Expired-domain inventory filtered by SpamZilla's quality heuristics.",
      },
      {
        id: "spamzilla-spam-score",
        name: "Get Spam Score",
        method: "GET",
        path: "/api/spamzilla/spam-score/:domain",
        description:
          "Spam score, anchor-text distribution, IP/subnet ratios, dropped-count.",
        relevantTo: ["authority"],
      },
      {
        id: "spamzilla-backlinks",
        name: "Backlinks Miner (Post-MVP)",
        method: "GET",
        path: "/api/spamzilla/backlinks/:domain",
        description:
          "Per-link backlink detail. Deferred to Phase 2.",
        relevantTo: ["authority"],
      },
    ],
  },

  // ──────────────── Scraped aggregators (MVP) ────────────────
  {
    id: "expireddomains-net",
    name: "ExpiredDomains.net",
    category: "aggregator",
    accessStatus: "scraped",
    monthlyCost: "Free",
    mvp: "yes",
    channels: ["expired"],
    description:
      "Public list of expiring, expired, and dropping domains. No official API — requires scraping.",
    accessNotes:
      "Fragile path. Layout changes and anti-bot measures can break ingestion. Skill abstraction isolates this risk.",
    docsUrl: "https://www.expireddomains.net/",
    endpoints: [
      {
        id: "expireddomains-expiring",
        name: "List Expiring Domains",
        method: "GET",
        path: "/api/expireddomains/expiring",
        description:
          "Scraped list of expiring domains with basic metadata.",
      },
      {
        id: "expireddomains-deleted",
        name: "List Recently Deleted",
        method: "GET",
        path: "/api/expireddomains/deleted",
        description:
          "Scraped list of recently deleted / dropped domains.",
      },
    ],
  },
  {
    id: "dnschkr",
    name: "DNSChkr",
    category: "meta-aggregator",
    accessStatus: "scraped",
    monthlyCost: "Free",
    mvp: "yes",
    channels: ["expired", "auction", "buy-now"],
    description:
      "Meta-search across 16 aftermarket platforms. Useful cross-check when direct marketplace access is blocked.",
    accessNotes: "Scraped — expect maintenance burden.",
    docsUrl: "https://dnschkr.com/",
    endpoints: [
      {
        id: "dnschkr-search",
        name: "Meta-Search Domain",
        method: "GET",
        path: "/api/dnschkr/search/:domain",
        description:
          "Look up a domain across 16 aftermarket platforms in one call.",
      },
    ],
  },

  // ──────────────── Access TBD (Step 1 verification) ────────────────
  {
    id: "godaddy-auctions",
    name: "GoDaddy Auctions",
    category: "marketplace",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["expired", "auction"],
    description:
      "Largest auction platform — covers expired, closeout, and aftermarket auctions.",
    accessNotes:
      "Likely partner-gated; possible regional restrictions. Verify partner requirements, minimum volume, geographic eligibility, bidding API availability.",
    docsUrl: "https://auctions.godaddy.com/",
    endpoints: [
      {
        id: "godaddy-listings",
        name: "List Auction Listings",
        method: "GET",
        path: "/api/godaddy/auctions",
        description:
          "Read-only listing feed. Availability contingent on partner approval.",
      },
      {
        id: "godaddy-bid-state",
        name: "Get Bid State",
        method: "GET",
        path: "/api/godaddy/auctions/:id/bid",
        description:
          "Real-time bid state for an auction (access model TBD).",
      },
      {
        id: "godaddy-place-bid",
        name: "Place Bid (Transactional)",
        method: "POST",
        path: "/api/godaddy/auctions/:id/bid",
        description:
          "Transactional bid placement. MVP is human-executed — this endpoint is placeholder only.",
      },
    ],
  },
  {
    id: "afternic",
    name: "Afternic",
    category: "marketplace",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["buy-now"],
    description:
      "Premium domain resale network. Fast Transfer / NameFind — generally reseller-partner only.",
    accessNotes:
      "Verify whether non-reseller developer access exists; check for read-only listings feed availability.",
    docsUrl: "https://www.afternic.com/",
    endpoints: [
      {
        id: "afternic-listings",
        name: "List Buy-Now Inventory",
        method: "GET",
        path: "/api/afternic/listings",
        description:
          "Fixed-price inventory feed (access contingent on reseller status).",
      },
    ],
  },
  {
    id: "sedo",
    name: "Sedo",
    category: "marketplace",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["buy-now", "auction"],
    description:
      "Second-largest global marketplace. SedoMLS / MasterList partner integration model.",
    accessNotes:
      "Verify partner requirements, what's in the MasterList feed, and pricing.",
    docsUrl: "https://sedo.com/",
    endpoints: [
      {
        id: "sedo-masterlist",
        name: "Get MasterList Feed",
        method: "GET",
        path: "/api/sedo/masterlist",
        description: "SedoMLS feed — requires partner approval.",
      },
    ],
  },
  {
    id: "namejet",
    name: "NameJet",
    category: "auction",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["expired", "auction"],
    description:
      "Network Solutions / Web.com pre-release auctions. Historically limited programmatic access.",
    accessNotes:
      "Verify whether any documented API exists and whether account holders get bulk feed access.",
    docsUrl: "https://www.namejet.com/",
    endpoints: [
      {
        id: "namejet-listings",
        name: "List Pre-Release Auctions",
        method: "GET",
        path: "/api/namejet/auctions",
        description:
          "Pre-release auction inventory (access model TBD).",
      },
    ],
  },
  {
    id: "snapnames",
    name: "SnapNames",
    category: "auction",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["expired", "auction"],
    description: "Pre-release auctions and backordering.",
    accessNotes:
      "Historically limited programmatic access outside account holders. Verify any documented API.",
    docsUrl: "https://www.snapnames.com/",
    endpoints: [
      {
        id: "snapnames-listings",
        name: "List Pre-Release Auctions",
        method: "GET",
        path: "/api/snapnames/auctions",
        description: "Pre-release auction inventory (access TBD).",
      },
      {
        id: "snapnames-backorder",
        name: "Place Backorder",
        method: "POST",
        path: "/api/snapnames/backorder",
        description:
          "Transactional backorder placement. Placeholder — MVP is human-executed.",
      },
    ],
  },
  {
    id: "dropcatch",
    name: "DropCatch",
    category: "backorder",
    accessStatus: "access-tbd",
    monthlyCost: "Free browse",
    mvp: "contingent",
    channels: ["expired"],
    description:
      "Backorder service for the drop stage. API for backorder placement likely available to account holders.",
    accessNotes:
      "Verify whether a bulk listings feed exists beyond backorder placement.",
    docsUrl: "https://www.dropcatch.com/",
    endpoints: [
      {
        id: "dropcatch-listings",
        name: "List Drop Candidates",
        method: "GET",
        path: "/api/dropcatch/listings",
        description: "Bulk drop listings (coverage TBD).",
      },
      {
        id: "dropcatch-backorder",
        name: "Place Backorder",
        method: "POST",
        path: "/api/dropcatch/backorder",
        description:
          "Transactional backorder placement. Placeholder — MVP is human-executed.",
      },
    ],
  },
];
