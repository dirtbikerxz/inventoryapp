const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const { Readable } = require('stream');
const { ImageAnnotatorClient } = require('@google-cloud/vision');

const AMOUNT_REGEX = /\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))/g;

function normalizePrivateKey(key) {
  if (!key) return null;
  return key.replace(/\\n/g, '\n');
}

function buildGoogleAuth(logger) {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const clientEmail =
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  if (keyFile) {
    return new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
  }

  if (clientEmail && privateKey) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey
      },
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
  }

  logger?.warn('Google Drive credentials missing; invoice uploads will be stored in-app only.');
  return null;
}

function pickLikelyMerchant(lines = []) {
  const candidates = lines.filter((line) => line && line.length <= 120);
  if (!candidates.length) return null;
  return candidates[0];
}

function extractDate(text) {
  if (!text) return null;
  const dateMatch = text.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
  if (!dateMatch) return null;
  const parsed = Date.parse(dateMatch[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseTotal(text) {
  if (!text) return null;
  let best = null;
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  lines.forEach((line) => {
    const lower = line.toLowerCase();
    const matches = [...line.matchAll(AMOUNT_REGEX)];
    matches.forEach((m) => {
      const raw = m[1] || m[0];
      const normalized = raw.replace(/,/g, '').replace(/^\$/, '');
      const value = Number(normalized);
      if (!Number.isFinite(value)) return;
      const isLikelyTotal =
        /total|amount due|balance|grand total|subtotal/.test(lower);
      const score = isLikelyTotal ? value + 0.01 : value;
      if (!best || score > best.score) {
        best = { value, score };
      }
    });
  });
  return best ? Number(best.value.toFixed(2)) : null;
}

class InvoiceService {
  constructor({ logger }) {
    this.logger = logger;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    this.auth = buildGoogleAuth(logger);
    this.drive = this.auth ? google.drive({ version: 'v3', auth: this.auth }) : null;
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const clientEmail =
      process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = normalizePrivateKey(
      process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    );
    const visionOptions = keyFile
      ? { keyFilename: keyFile }
      : clientEmail && privateKey
        ? { credentials: { client_email: clientEmail, private_key: privateKey } }
        : undefined;
    try {
      this.vision = new ImageAnnotatorClient(visionOptions || undefined);
    } catch (err) {
      this.logger?.warn(err, 'Vision client unavailable; invoice OCR for images disabled.');
      this.vision = null;
    }
  }

  async uploadToDrive(file) {
    if (!this.drive) return {};
    try {
      const media = {
        mimeType: file.mimetype || 'application/octet-stream',
        body: Readable.from(file.buffer)
      };
      const requestBody = {
        name: file.originalname || 'invoice-upload',
        parents: this.folderId ? [this.folderId] : undefined
      };
      const resp = await this.drive.files.create({
        requestBody,
        media,
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true
      });
      const fileId = resp.data?.id;
      if (fileId && this.folderId) {
        try {
          // Ensure the file inherits folder permissions; folder sharing must be configured manually.
          await this.drive.files.update({
            fileId,
            addParents: this.folderId,
            supportsAllDrives: true
          });
        } catch (err) {
          this.logger?.warn(err, 'Failed to attach file to Drive folder (already attached?)');
        }
      }
      return {
        driveFileId: fileId,
        driveWebViewLink: resp.data?.webViewLink,
        driveDownloadLink: resp.data?.webContentLink
      };
    } catch (err) {
      this.logger?.error(err, 'Drive upload failed');
      return {};
    }
  }

  async extractText(file) {
    if (!file?.buffer) return '';
    const mime = (file.mimetype || '').toLowerCase();
    try {
      if (mime.includes('pdf')) {
        const result = await pdfParse(file.buffer);
        return result.text || '';
      }
      if (mime.startsWith('image/') && this.vision) {
        const [result] = await this.vision.textDetection(file.buffer);
        const detections = result?.textAnnotations || [];
        if (detections.length) return detections[0].description || '';
      }
    } catch (err) {
      this.logger?.warn(err, 'Failed to extract text from invoice file');
    }
    return '';
  }

  async processFile(file) {
    const text = await this.extractText(file);
    const detectedTotal = parseTotal(text);
    const detectedDate = extractDate(text);
    const lines = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const merchant = pickLikelyMerchant(lines);
    const uploadMeta = await this.uploadToDrive(file);
    return {
      name: file.originalname || 'invoice',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      detectedTotal,
      detectedDate,
      detectedCurrency: /\$/.test(text) ? 'USD' : undefined,
      detectedMerchant: merchant || undefined,
      textSnippet: text ? text.slice(0, 2000) : undefined,
      ...uploadMeta
    };
  }
}

module.exports = { InvoiceService, parseTotal, extractDate };
