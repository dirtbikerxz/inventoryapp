const builtinVendors = [
  {
    key: 'digikey',
    slug: 'digikey',
    vendor: 'Digi-Key',
    baseUrl: 'https://www.digikey.com',
    productUrlTemplate: 'https://www.digikey.com/en/products/result?keywords={partNumber}',
    partNumberPattern: '^[A-Za-z0-9][A-Za-z0-9\\-_.\\/]+$',
    description: 'Official Digi-Key integration using the Product Information v4 API.',
    capabilities: {
      productLookup: 'api',
      quickOrderExport: true,
      quickOrderImport: true,
      cartSyncPlanned: true
    },
    detectionHints: {
      vendorNames: ['digikey', 'digi-key', 'digi key'],
      domains: ['digikey.com']
    },
    integrationFields: [
      {
        key: 'clientId',
        label: 'Client ID',
        required: true,
        secret: false,
        type: 'text',
        placeholder: 'xxxxxxxxxxxxxxxxxxxx'
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        required: true,
        secret: true,
        type: 'password',
        placeholder: '********************'
      }
    ]
  },
  {
    key: 'mouser',
    slug: 'mouser',
    vendor: 'Mouser Electronics',
    baseUrl: 'https://www.mouser.com',
    productUrlTemplate: 'https://www.mouser.com/ProductDetail/{partNumber}',
    partNumberPattern: '^[A-Za-z0-9][A-Za-z0-9\\-_.\\/]+$',
    description: 'Official Mouser Electronics integration using the Mouser Search API.',
    capabilities: {
      productLookup: 'api',
      quickOrderExport: true,
      quickOrderImport: true,
      cartSyncPlanned: false
    },
    detectionHints: {
      vendorNames: ['mouser', 'mouser electronics'],
      domains: ['mouser.com', 'mou.sr']
    },
    integrationFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        required: true,
        secret: true,
        type: 'password',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
      }
    ]
  },
  {
    key: 'shareacart',
    slug: 'share-a-cart',
    vendor: 'Share-A-Cart',
    baseUrl: 'https://share-a-cart.com',
    productUrlTemplate: 'https://share-a-cart.com/get/{partNumber}',
    description: 'Import carts shared via Share-A-Cart (Amazon, Walmart, and more).',
    capabilities: {
      productLookup: null,
      quickOrderExport: false,
      quickOrderImport: true,
      cartSyncPlanned: false
    },
    detectionHints: {
      vendorNames: ['share-a-cart', 'share a cart', 'shareacart'],
      domains: ['share-a-cart.com']
    },
    integrationFields: []
  }
];

function getBuiltinVendor(key) {
  if (!key) return null;
  const lower = key.toLowerCase();
  return builtinVendors.find(v => v.key === lower || v.slug === lower) || null;
}

module.exports = {
  builtinVendors,
  getBuiltinVendor
};
