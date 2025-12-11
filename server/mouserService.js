class MouserService {
  constructor({ logger }) {
    this.logger = logger;
  }

  normalizeUrl(rawUrl) {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    return `https://${rawUrl}`;
  }

  extractFromProductUrl(urlString) {
    if (!urlString) return { partNumber: null, productUrl: null };
    try {
      const url = new URL(urlString);
      const segments = url.pathname.split('/').filter(Boolean);
      const idx = segments.findIndex(seg => seg.toLowerCase() === 'productdetail');
      let partSegment = null;
      if (idx !== -1) {
        if (segments.length > idx + 2) {
          partSegment = segments[idx + 2];
        } else if (segments.length > idx + 1) {
          partSegment = segments[idx + 1];
        }
      }
      if (!partSegment) {
        const partParam = url.searchParams.get('partnumber') || url.searchParams.get('partnumberlist');
        if (partParam) partSegment = partParam;
      }
      return {
        partNumber: partSegment ? decodeURIComponent(partSegment) : null,
        productUrl: url.toString()
      };
    } catch (error) {
      this.logger.warn(error, 'Failed to parse Mouser product URL');
      return { partNumber: null, productUrl: null };
    }
  }

  async resolveProductUrl(rawUrl) {
    if (!rawUrl) throw new Error('url is required');
    const normalized = this.normalizeUrl(rawUrl);
    let parsed = this.extractFromProductUrl(normalized);
    if (parsed.partNumber) {
      return parsed;
    }
    try {
      const resp = await fetch(normalized, { method: 'GET', redirect: 'follow' });
      const finalUrl = resp.url || normalized;
      parsed = this.extractFromProductUrl(finalUrl);
      return {
        partNumber: parsed.partNumber,
        productUrl: parsed.productUrl || finalUrl
      };
    } catch (error) {
      this.logger.warn(error, 'Failed to resolve Mouser URL');
      return { partNumber: null, productUrl: normalized };
    }
  }

  parsePrice(value) {
    if (value === undefined || value === null) return undefined;
    const num = Number(String(value).replace(/[^0-9.]/g, ''));
    return Number.isFinite(num) ? num : undefined;
  }

  formatPrice(value) {
    if (value === undefined) return undefined;
    return value.toFixed(2);
  }

  pickPrice(product) {
    if (!product) return undefined;
    const breaks = Array.isArray(product.PriceBreaks) ? product.PriceBreaks : [];
    const exactOne = breaks.find(b => Number(b?.Quantity) === 1);
    const candidate = exactOne || breaks[0];
    if (candidate?.Price) {
      return this.parsePrice(candidate.Price);
    }
    if (product.Price) {
      return this.parsePrice(product.Price);
    }
    return undefined;
  }

  mapProduct(product) {
    if (!product) return null;
    const description = product.Description || product.ManufacturerPartNumber || product.MouserPartNumber;
    const priceNumber = this.pickPrice(product);
    return {
      picks: {
        name: description || '',
        price: priceNumber !== undefined ? this.formatPrice(priceNumber) : undefined
      },
      productUrl: product.ProductDetailUrl || null,
      data: { product },
      meta: {
        manufacturer: product.Manufacturer,
        manufacturerPartNumber: product.ManufacturerPartNumber,
        mouserPartNumber: product.MouserPartNumber,
        availability: product.Availability,
        leadTimeWeeks: product.LeadTimeWeeks
      }
    };
  }

  async lookupPart(partNumber, settings = {}) {
    if (!partNumber) {
      throw new Error('partNumber is required for Mouser lookup');
    }
    const apiKey = settings.apiKey;
    if (!apiKey) {
      throw new Error('Mouser API key is not configured.');
    }
    const exact = await this.searchByPartNumber(partNumber, apiKey);
    if (exact) return exact;
    const keyword = await this.searchByKeyword(partNumber, apiKey);
    if (keyword) return keyword;
    return {
      picks: {},
      message: 'No Mouser results found for that part number.'
    };
  }

  async searchByPartNumber(partNumber, apiKey) {
    const endpoint = `https://api.mouser.com/api/v1/search/partnumber?apiKey=${encodeURIComponent(apiKey)}`;
    const body = {
      SearchByPartRequest: {
        mouserPartNumber: partNumber
      }
    };
    return this.performSearch(endpoint, body);
  }

  async searchByKeyword(keyword, apiKey) {
    const endpoint = `https://api.mouser.com/api/v1/search/keyword?apiKey=${encodeURIComponent(apiKey)}`;
    const body = {
      SearchByKeywordRequest: {
        keyword,
        records: 5,
        startingRecord: 0
      }
    };
    return this.performSearch(endpoint, body);
  }

  async performSearch(endpoint, payload) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        const message = data?.Errors?.[0]?.Message || `HTTP ${resp.status}`;
        throw new Error(message || 'Mouser search failed');
      }
      const product = data?.SearchResults?.Parts?.[0];
      if (!product) {
        return null;
      }
      const mapped = this.mapProduct(product);
      return mapped ? { ...mapped, raw: data } : null;
    } catch (error) {
      this.logger.error(error, 'Mouser API request failed');
      throw error;
    }
  }
}

module.exports = {
  MouserService
};
