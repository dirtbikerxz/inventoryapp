const crypto = require('crypto');

function buildTrackingUrl(carrier, num) {
  if (!num) return undefined;
  const c = (carrier || '').toLowerCase();
  if (c === 'ups') return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
  if (c === 'usps') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
  if (c === 'fedex') return `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(num)}`;
  return undefined;
}

function dedupeRefs(refs) {
  const map = new Map();
  refs.forEach(r => {
    if (!r.trackingNumber) return;
    const key = `${(r.carrier || 'unknown').toLowerCase()}:${r.trackingNumber}`;
    if (!map.has(key)) {
      map.set(key, { carrier: (r.carrier || 'unknown').toLowerCase(), trackingNumber: r.trackingNumber, trackingUrl: r.trackingUrl || buildTrackingUrl(r.carrier, r.trackingNumber) });
    }
  });
  return Array.from(map.values());
}

const supportedCarriers = new Set(['ups', 'usps', 'fedex']);

class TrackingService {
  constructor({ client, logger }) {
    this.client = client;
    this.logger = logger;
    this.refreshMinutes = 30;
    this.timer = null;
    this.running = false;
    this.settings = {};
    this.upsToken = null;
    this.upsTokenExpires = 0;
    this.fedexToken = null;
    this.fedexTokenExpires = 0;
    this.lastError = null;
  }

  intervalMs() {
    return Math.max(1, this.refreshMinutes || 30) * 60 * 1000;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      this.runCycle().catch(err => this.logger.error(err, 'Tracking refresh failed'));
    }, this.intervalMs());
    this.logger.info(`Tracking refresh scheduled every ${this.refreshMinutes} minutes`);
  }

  async init() {
    await this.loadSettings();
    await this.runCycle(true);
    this.start();
  }

  async loadSettings() {
    try {
      const settings = await this.client.query('tracking:getSettings', {});
      if (settings) {
        this.settings = settings;
        this.refreshMinutes = settings.refreshMinutes || this.refreshMinutes;
      }
      return this.settings;
    } catch (e) {
      this.logger.error(e, 'Failed to load tracking settings');
      return this.settings;
    }
  }

  async updateSettings(payload) {
    const refreshMinutes = payload.refreshMinutes || this.refreshMinutes;
    await this.client.mutation('tracking:saveSettings', {
      upsClientId: payload.upsClientId ?? this.settings.upsClientId,
      upsClientSecret: payload.upsClientSecret ?? this.settings.upsClientSecret,
      uspsUserId: payload.uspsUserId ?? this.settings.uspsUserId,
      fedexClientId: payload.fedexClientId ?? this.settings.fedexClientId,
      fedexClientSecret: payload.fedexClientSecret ?? this.settings.fedexClientSecret,
      refreshMinutes
    });
    await this.loadSettings();
    this.start();
  }

  async collectTrackedNumbers() {
    const refs = [];
    try {
      const data = await this.client.query('orders:list', {});
      const add = (list) => {
        (list || []).forEach(t => {
          if (t?.trackingNumber) {
            const carrier = (t.carrier || 'unknown').toLowerCase();
            refs.push({ carrier, trackingNumber: t.trackingNumber, trackingUrl: t.trackingUrl });
          }
        });
      };
      (data?.orders || []).forEach(o => add(o.tracking));
      (data?.groups || []).forEach(g => add(g.tracking));
    } catch (e) {
      this.logger.error(e, 'Failed to collect tracked numbers');
    }
    return dedupeRefs(refs);
  }

  async ensureCacheEntries(refs, force = false) {
    if (!refs.length) return;
    const now = Date.now();
    const slimRefs = refs.map(r => ({ carrier: (r.carrier || 'unknown').toLowerCase(), trackingNumber: r.trackingNumber }));
    const cacheMap = await this.client.query('tracking:getCacheFor', { refs: slimRefs });
    await Promise.all(refs.map(async ref => {
      const key = `${ref.carrier}:${ref.trackingNumber}`;
      const existing = cacheMap[key];
      if (!existing) {
        await this.client.mutation('tracking:upsertCache', {
          carrier: ref.carrier,
          trackingNumber: ref.trackingNumber,
          trackingUrl: ref.trackingUrl,
          nextCheckAfter: now
        });
      } else if (existing.delivered && existing.nextCheckAfter !== undefined) {
        await this.client.mutation('tracking:upsertCache', {
          carrier: ref.carrier,
          trackingNumber: ref.trackingNumber,
          nextCheckAfter: undefined
        });
      } else if (!existing.trackingUrl && ref.trackingUrl) {
        await this.client.mutation('tracking:upsertCache', {
          carrier: ref.carrier,
          trackingNumber: ref.trackingNumber,
          trackingUrl: ref.trackingUrl
        });
      } else if (force) {
        await this.client.mutation('tracking:upsertCache', {
          carrier: ref.carrier,
          trackingNumber: ref.trackingNumber,
          nextCheckAfter: now
        });
      } else if (existing.delivered && existing.nextCheckAfter !== undefined) {
        await this.client.mutation('tracking:upsertCache', {
          carrier: ref.carrier,
          trackingNumber: ref.trackingNumber,
          nextCheckAfter: undefined
        });
      }
    }));
  }

  async runCycle(force = false) {
    if (this.running) return;
    this.running = true;
    try {
      await this.loadSettings();
      const refs = await this.collectTrackedNumbers();
      await this.ensureCacheEntries(refs, force);
      const refKeys = new Set(refs.map(r => `${r.carrier}:${r.trackingNumber}`));
      let targets;
      if (force) {
        const slimRefs = refs.map(r => ({ carrier: (r.carrier || 'unknown').toLowerCase(), trackingNumber: r.trackingNumber }));
        const cacheMap = await this.client.query('tracking:getCacheFor', { refs: slimRefs });
        targets = refs.map(ref => cacheMap[`${ref.carrier}:${ref.trackingNumber}`] || ref);
      } else {
        targets = await this.client.query('tracking:dueForRefresh', { limit: 50 });
        targets = (targets || []).filter(t => refKeys.has(`${t.carrier}:${t.trackingNumber}`));
      }
      if (!targets || !targets.length) return;
      const intervalMs = this.intervalMs();
      for (const cache of targets) {
        const carrier = cache.carrier || cache?.tracking?.carrier || 'unknown';
        const number = cache.trackingNumber || cache?.tracking?.number;
        if (!number) continue;
        const normalizedCarrier = (carrier || 'unknown').toLowerCase();
        if (cache.delivered) {
          await this.client.mutation('tracking:upsertCache', {
            carrier: normalizedCarrier,
            trackingNumber: number,
            nextCheckAfter: undefined
          });
          continue;
        }
        if (!supportedCarriers.has(normalizedCarrier)) {
          await this.client.mutation('tracking:upsertCache', {
            carrier: normalizedCarrier,
            trackingNumber: number,
            summary: 'Carrier not auto-tracked. Open carrier site manually.',
            trackingUrl: cache.trackingUrl || buildTrackingUrl(normalizedCarrier, number),
            nextCheckAfter: undefined
          });
          continue;
        }
        try {
          const result = await this.fetchTracking(normalizedCarrier, number);
          const delivered = Boolean(result.delivered);
          this.logger.info({
            carrier: normalizedCarrier,
            trackingNumber: number,
            status: result.status,
            summary: result.summary,
            delivered,
            eta: result.eta,
            lastEventTime: result.lastEventTime
          }, 'Tracking fetched');
          await this.client.mutation('tracking:upsertCache', {
            carrier: normalizedCarrier,
            trackingNumber: number,
            status: result.status,
            summary: result.summary || result.status,
            delivered,
            lastEventTime: result.lastEventTime,
            eta: result.eta,
            trackingUrl: result.trackingUrl || cache.trackingUrl || buildTrackingUrl(normalizedCarrier, number),
            raw: result.raw ? (typeof result.raw === 'string' ? result.raw : JSON.stringify(result.raw).slice(0, 8000)) : cache.raw,
            lastCheckedAt: Date.now(),
            nextCheckAfter: delivered ? undefined : Date.now() + intervalMs
          });
        } catch (err) {
          const delay = err && typeof err.message === 'string' && err.message.toLowerCase().includes('missing')
            ? 6 * 60 * 60 * 1000
            : Math.max(intervalMs, 15 * 60 * 1000);
          this.logger.error({
            err,
            carrier: normalizedCarrier,
            trackingNumber: number
          }, `Tracking fetch failed for ${normalizedCarrier}:${number}`);
          this.lastError = err?.message || 'Tracking fetch failed';
          await this.client.mutation('tracking:upsertCache', {
            carrier: normalizedCarrier,
            trackingNumber: number,
            summary: err.message || 'Tracking fetch failed',
            lastCheckedAt: Date.now(),
            nextCheckAfter: Date.now() + delay
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  async refreshAllNow() {
    this.lastError = null;
    await this.runCycle(true);
    return { lastError: this.lastError };
  }

  async ensureUpsToken() {
    const { upsClientId, upsClientSecret } = this.settings || {};
    if (!upsClientId || !upsClientSecret) {
      throw new Error('UPS API credentials missing');
    }
    if (this.upsToken && this.upsTokenExpires > Date.now()) return this.upsToken;
    const auth = Buffer.from(`${upsClientId}:${upsClientSecret}`).toString('base64');
    const resp = await fetch('https://onlinetools.ups.com/security/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`
      },
      body: 'grant_type=client_credentials'
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`UPS auth failed ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    this.upsToken = data.access_token;
    this.upsTokenExpires = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;
    return this.upsToken;
  }

  async fetchUps(number) {
    const token = await this.ensureUpsToken();
    const url = `https://onlinetools.ups.com/api/track/v1/details/${encodeURIComponent(number)}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        transId: crypto.randomUUID(),
        transactionSrc: 'inventoryapp'
      }
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`UPS tracking failed ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const pkg = data?.trackResponse?.shipment?.[0]?.package?.[0];
    const activity = pkg?.activity?.[0] || pkg?.currentStatus;
    const status = activity?.description || activity?.status?.description || activity?.statusDescription;
    const delivered = /delivered/i.test(status || '');
    const timeStr = activity?.date || activity?.dateTime || activity?.time;
    const lastEventTime = timeStr ? Date.parse(timeStr) || undefined : undefined;
    return {
      status,
      summary: status || `UPS ${number}`,
      delivered,
      lastEventTime,
      trackingUrl: buildTrackingUrl('ups', number),
      raw: data
    };
  }

  async ensureFedexToken() {
    const { fedexClientId, fedexClientSecret } = this.settings || {};
    if (!fedexClientId || !fedexClientSecret) {
      throw new Error('FedEx API credentials missing');
    }
    if (this.fedexToken && this.fedexTokenExpires > Date.now()) return this.fedexToken;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: fedexClientId,
      client_secret: fedexClientSecret
    });
    const resp = await fetch('https://apis.fedex.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`FedEx auth failed ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    this.fedexToken = data.access_token;
    this.fedexTokenExpires = Date.now() + ((data.expires_in || 3600) * 1000) - 60000;
    return this.fedexToken;
  }

  async fetchFedex(number) {
    const token = await this.ensureFedexToken();
    const parseDate = (val) => {
      if (!val) return undefined;
      const t = Date.parse(val);
      return Number.isNaN(t) ? undefined : t;
    };
    const pickFirstDate = (list, types) => {
      for (const t of types) {
        const found = (list || []).find(d => (d?.type || '').toUpperCase() === t.toUpperCase());
        const candidate = found?.value || found?.dateTime;
        const parsed = parseDate(candidate);
        if (parsed) return parsed;
      }
      return undefined;
    };
    const resp = await fetch('https://apis.fedex.com/track/v1/trackingnumbers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber: number
            }
          }
        ],
        includeDetailedScans: true
      })
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`FedEx tracking failed ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = await resp.json();
    const result = data?.output?.completeTrackResults?.[0]?.trackResults?.[0];
    const latest = result?.latestStatusDetail || result?.scanEvents?.[0];
    const status = latest?.description || latest?.statusByLocale || latest?.eventDescription;
    const delivered = /delivered/i.test(status || latest?.code || '');
    const dateAndTimes = result?.dateAndTimes || [];
    const timeStr = latest?.dateAndTimes?.[0]?.value || latest?.date || latest?.eventDateTime || latest?.occurredAt || latest?.arrivalDateTime;
    const lastEventTime = parseDate(timeStr);
    const etaFromTypes =
      pickFirstDate(dateAndTimes, [
        'ESTIMATED_DELIVERY',
        'APPOINTMENT_DELIVERY',
        'SHIPMENT_ESTIMATED_DELIVERY_TIMESTAMP',
        'ESTIMATED_DELIVERY_DATE',
        'ESTIMATED_DELIVERY_TIMESTAMP'
      ]);
    const etaFromFields =
      parseDate(result?.estimatedDeliveryTimestamp || result?.estimatedDeliveryTime || result?.estimatedDeliveryDateAndTime || result?.estimatedDeliveryDate) ||
      parseDate(result?.deliveryDetails?.estimatedDeliveryTimestamp || result?.deliveryDetails?.estimatedDeliveryTime || result?.deliveryDetails?.estimatedDeliveryDateAndTime || result?.deliveryDetails?.estimatedDeliveryDate);
    const etaFromWindows =
      parseDate(result?.estimatedDeliveryTimeWindow?.window?.ends || result?.estimatedDeliveryTimeWindow?.window?.begins) ||
      parseDate(result?.standardTransitTimeWindow?.window?.ends || result?.standardTransitTimeWindow?.window?.begins);
    const eta = etaFromTypes || etaFromFields || etaFromWindows || undefined;
    const deliveredTime =
      pickFirstDate(dateAndTimes, ['ACTUAL_DELIVERY', 'DELIVERY', 'ACTUAL_DELIVERY_TIMESTAMP']) ||
      parseDate(result?.deliveryDetails?.actualDeliveryTimestamp || result?.deliveryDetails?.actualDeliveryDateAndTime || result?.deliveryDetails?.actualDeliveryTime || result?.deliveryDetails?.actualDeliveryDate) ||
      (delivered ? lastEventTime : undefined);
    const rawEtaLog = dateAndTimes.map(d => ({ type: d?.type, value: d?.value || d?.dateTime }));
    this.logger.info({
      carrier: 'fedex',
      trackingNumber: number,
      eta,
      lastEventTime,
      delivered,
      deliveredTime,
      etaFromTypes,
      etaFromFields,
      etaFromWindows,
      rawEtaLog,
      deliveryDetails: result?.deliveryDetails || null,
      estimatedDeliveryTimeWindow: result?.estimatedDeliveryTimeWindow || null,
      standardTransitTimeWindow: result?.standardTransitTimeWindow || null
    }, 'FedEx parsed ETA');
    return {
      status,
      summary: status || `FedEx ${number}`,
      delivered,
      lastEventTime: deliveredTime || lastEventTime,
      eta,
      trackingUrl: buildTrackingUrl('fedex', number),
      raw: data,
      deliveredTime
    };
  }

  async fetchUsps(number) {
    const { uspsUserId } = this.settings || {};
    if (!uspsUserId) {
      throw new Error('USPS User ID missing');
    }
    const xml = `<TrackFieldRequest USERID="${uspsUserId}"><Revision>1</Revision><TrackID ID="${number}"></TrackID></TrackFieldRequest>`;
    const url = `https://secure.shippingapis.com/ShippingAPI.dll?API=TrackV2&XML=${encodeURIComponent(xml)}`;
    const resp = await fetch(url);
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`USPS tracking failed ${resp.status}: ${text.slice(0, 200)}`);
    }
    const summaryMatch = text.match(/<TrackSummary>([^<]+)<\/TrackSummary>/i);
    const detailMatch = text.match(/<TrackDetail>([^<]+)<\/TrackDetail>/i);
    const summary = summaryMatch ? summaryMatch[1] : detailMatch ? detailMatch[1] : '';
    const delivered = /delivered/i.test(summary || '');
    return {
      status: summary,
      summary: summary || `USPS ${number}`,
      delivered,
      trackingUrl: buildTrackingUrl('usps', number),
      raw: text
    };
  }

  async fetchDhl(number) {
    throw new Error('DHL unsupported');
  }

  async fetchTracking(carrier, number) {
    const c = (carrier || '').toLowerCase();
    if (c === 'ups') return this.fetchUps(number);
    if (c === 'fedex') return this.fetchFedex(number);
    if (c === 'usps') return this.fetchUsps(number);
    throw new Error(`Unsupported carrier: ${carrier}`);
  }
}

module.exports = { TrackingService, buildTrackingUrl };
