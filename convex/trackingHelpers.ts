import { v } from "convex/values";

type TrackingInput = {
  carrier?: string;
  trackingNumber?: string;
  number?: string;
  status?: string;
  lastEvent?: string;
  lastUpdated?: number;
  delivered?: boolean;
  lastCheckedAt?: number;
  trackingUrl?: string;
  eta?: string | number;
};

export const trackingArg = v.object({
  carrier: v.string(),
  trackingNumber: v.string(),
  status: v.optional(v.string()),
  lastEvent: v.optional(v.string()),
  lastUpdated: v.optional(v.number()),
  delivered: v.optional(v.boolean()),
  lastCheckedAt: v.optional(v.number()),
  trackingUrl: v.optional(v.string()),
  eta: v.optional(v.union(v.string(), v.number()))
});

export function buildTrackingUrl(carrier?: string, num?: string) {
  if (!num) return undefined;
  const c = (carrier || "").toLowerCase();
  if (c === "ups") return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
  if (c === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(num)}`;
  return undefined;
}

export function normalizeTracking(input?: TrackingInput[] | null, fallback?: string) {
  const arr = Array.isArray(input) ? input : [];
  const withFallback = arr.length === 0 && fallback
    ? [{ carrier: "unknown", trackingNumber: fallback }]
    : arr;
  return withFallback
    .map(t => {
      const number = t.trackingNumber || t.number;
      if (!number) return null;
      const carrier = ((t.carrier || "").trim() || "unknown").toLowerCase();
      return {
        carrier,
        trackingNumber: number,
        status: t.status,
        lastEvent: t.lastEvent,
        lastUpdated: t.lastUpdated,
        delivered: t.delivered,
        lastCheckedAt: t.lastCheckedAt,
        trackingUrl: t.trackingUrl || buildTrackingUrl(carrier, number),
        eta: t.eta
      };
    })
    .filter(Boolean) as TrackingInput[];
}

export function trackingKey(t: { carrier?: string; trackingNumber?: string }) {
  return `${(t.carrier || "unknown").toLowerCase()}:${t.trackingNumber || ""}`;
}

export type { TrackingInput };
