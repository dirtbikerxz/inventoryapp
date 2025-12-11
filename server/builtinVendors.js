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
