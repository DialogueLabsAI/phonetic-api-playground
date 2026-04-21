import type {
  DomainRow,
  TagResult,
  TaggingThresholds,
  TagName,
} from "@/lib/types";

export const DEFAULT_THRESHOLDS: TaggingThresholds = {
  drMin: 10,
  tfMin: 5,
  referringDomainsMin: 20,
  monthlyTrafficMin: 1,
  minWaybackSnapshots: 3,
};

// Pure function — given a row and thresholds, returns the MVP tagging result
// following Section 4.4 of the proposal.
export function applyTags(
  row: DomainRow,
  t: TaggingThresholds
): TagResult {
  // Stage 1 — rule out for free
  if (row.channel === "unregistered") {
    return {
      tags: [],
      skip: true,
      skipReason: "Unregistered channel: no traffic, no aged backlinks.",
      confidence: "full",
    };
  }
  if (row.isBrandableMarketplace) {
    return {
      tags: [],
      skip: true,
      skipReason: "Brandable marketplace: seller pre-classified as Branded.",
      confidence: "full",
    };
  }

  // Stage 2 — confirm using signals already in the feed
  const tags: TagName[] = [];
  const hasAuthoritySignal =
    (row.dr != null && row.dr >= t.drMin) ||
    (row.tf != null && row.tf >= t.tfMin) ||
    (row.referringDomains != null &&
      row.referringDomains >= t.referringDomainsMin);
  if (hasAuthoritySignal) tags.push("Authority");

  if (row.monthlyTraffic != null && row.monthlyTraffic > t.monthlyTrafficMin) {
    tags.push("Traffic");
  }

  if (tags.length === 0) {
    return {
      tags: [],
      skip: true,
      skipReason: "No authority or traffic signals in feed.",
      confidence: "full",
    };
  }

  // Stage 3 — Wayback confidence check
  let confidence: TagResult["confidence"] = "unknown";
  if (row.waybackSnapshots != null) {
    confidence =
      row.waybackSnapshots < t.minWaybackSnapshots ? "low" : "full";
  }

  return { tags, skip: false, confidence };
}
