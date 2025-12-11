class DigiKeyService {
  constructor({ logger }) {
    this.logger = logger;
    this.tokenCache = new Map();
  }

  normalizeUrl(rawUrl) {
    if (!rawUrl) return null;
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    return `https://${rawUrl}`;
  }

  extractFromDetailUrl(urlString) {
    if (!urlString) return { partNumber: null, productUrl: null };
    try {
      const url = new URL(urlString);
      const segments = url.pathname.split('/').filter(Boolean);
      const detailIdx = segments.findIndex(s => s.toLowerCase() === 'detail');
      if (detailIdx !== -1 && segments.length > detailIdx + 2) {
        const partSegment = decodeURIComponent(segments[detailIdx + 2]);
        return {
          partNumber: partSegment || null,
          productUrl: url.toString()
        };
      }
      return { partNumber: null, productUrl: url.toString() };
    } catch (err) {
      this.logger.warn(err, 'Failed to parse Digi-Key detail URL');
      return { partNumber: null, productUrl: null };
    }
  }

  async resolveProductUrl(rawUrl) {
    if (!rawUrl) throw new Error('url is required');
    const normalized = this.normalizeUrl(rawUrl);
    let parsed = this.extractFromDetailUrl(normalized);
    if (parsed.partNumber) {
      return parsed;
    }
    try {
      const resp = await fetch(normalized, { method: 'GET', redirect: 'follow' });
      const finalUrl = resp.url || normalized;
      parsed = this.extractFromDetailUrl(finalUrl);
      return {
        partNumber: parsed.partNumber,
        productUrl: parsed.productUrl || finalUrl
      };
    } catch (error) {
      this.logger.warn(error, 'Failed to resolve Digi-Key URL');
      return { partNumber: null, productUrl: normalized };
    }
  }

  cacheKey(clientId, clientSecret) {
    return `${clientId}:${clientSecret}`;
  }

  async getAccessToken(clientId, clientSecret) {
    if (!clientId || !clientSecret) {
      throw new Error('Digi-Key Client ID and Client Secret are required.');
    }
    const key = this.cacheKey(clientId, clientSecret);
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const resp = await fetch('https://api.digikey.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if (!resp.ok) {
      this.logger.error({ status: resp.status }, 'Digi-Key token request failed');
      throw new Error('Unable to authenticate with Digi-Key');
    }
    const data = await resp.json();
    if (!data.access_token) {
      throw new Error('Digi-Key token missing in response');
    }
    const expiresIn = Number(data.expires_in || 1200);
    this.tokenCache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(30_000, (expiresIn - 30) * 1000)
    });
    return data.access_token;
  }

  invalidateToken(clientId, clientSecret) {
    const key = this.cacheKey(clientId, clientSecret);
    this.tokenCache.delete(key);
  }

  normalizePrice(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return undefined;
    return num;
  }

  buildHeaders(clientId, clientSecret, settings) {
    const localeSite = (settings?.site || 'US').toUpperCase();
    const currency = (settings?.currency || 'USD').toUpperCase();
    const language = (settings?.language || 'en').toLowerCase();
    return {
      'X-DIGIKEY-Client-Id': clientId,
      'X-DIGIKEY-Locale-Language': language,
      'X-DIGIKEY-Locale-Site': localeSite,
      'X-DIGIKEY-Locale-Currency': currency
    };
  }

  pickProduct(data) {
    if (!data) return null;
    if (Array.isArray(data.ExactMatches) && data.ExactMatches.length) {
      return data.ExactMatches[0];
    }
    if (Array.isArray(data.Products) && data.Products.length) {
      return data.Products[0];
    }
    return null;
  }

  pickVariation(product) {
    if (!product) return null;
    if (Array.isArray(product.ProductVariations) && product.ProductVariations.length) {
      return product.ProductVariations[0];
    }
    return null;
  }

  derivePrice(product, variation) {
    if (product?.UnitPrice !== undefined && product.UnitPrice !== null) {
      return this.normalizePrice(product.UnitPrice);
    }
    const standard = variation?.StandardPricing?.[0];
    if (standard?.UnitPrice !== undefined) {
      return this.normalizePrice(standard.UnitPrice);
    }
    if (standard?.Price !== undefined) {
      return this.normalizePrice(standard.Price);
    }
    return undefined;
  }

  formatPrice(value) {
    if (value === undefined) return undefined;
    return value.toFixed(2);
  }

  mapProduct(product, variation) {
    if (!product) return null;
    const description = product?.Description?.ProductDescription || product?.Description?.DetailedDescription || product?.ManufacturerProductNumber;
    const priceNumber = this.derivePrice(product, variation);
    return {
      picks: {
        name: description || product?.ManufacturerProductNumber || '',
        price: priceNumber !== undefined ? this.formatPrice(priceNumber) : undefined
      },
      productUrl: product?.ProductUrl || variation?.ProductUrl,
      data: {
        product,
        variation
      },
      meta: {
        quantityAvailable: product?.QuantityAvailable ?? variation?.QuantityAvailableforPackageType,
        manufacturer: product?.Manufacturer?.Name,
        manufacturerPartNumber: product?.ManufacturerProductNumber,
        digiKeyProductNumber: variation?.DigiKeyProductNumber,
        productStatus: product?.ProductStatus?.Status
      }
    };
  }

  async lookupPart(partNumber, settings = {}) {
    if (!partNumber) {
      throw new Error('partNumber is required for Digi-Key lookup');
    }
    const clientId = settings.clientId;
    const clientSecret = settings.clientSecret;
    if (!clientId || !clientSecret) {
      throw new Error('Digi-Key credentials are not configured.');
    }
    const token = await this.getAccessToken(clientId, clientSecret);
    const headers = {
      ...this.buildHeaders(clientId, clientSecret, settings),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const body = {
      Keywords: partNumber,
      Limit: 5,
      Offset: 0
    };
    const resp = await fetch('https://api.digikey.com/products/v4/search/keyword', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (resp.status === 401) {
      this.invalidateToken(clientId, clientSecret);
    }
    if (!resp.ok) {
      const text = await resp.text();
      this.logger.error({ status: resp.status, body: text }, 'Digi-Key keyword search failed');
      throw new Error('Digi-Key search failed');
    }
    const data = await resp.json();
    const product = this.pickProduct(data);
    if (!product) {
      return {
        picks: {},
        message: 'No Digi-Key results found for that part number.'
      };
    }
    const variation = this.pickVariation(product);
    const mapped = this.mapProduct(product, variation);
    return { ...mapped, raw: data };
  }
}

module.exports = {
  DigiKeyService
};
