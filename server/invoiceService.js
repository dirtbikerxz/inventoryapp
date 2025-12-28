const { google } = require('googleapis');
const { Readable } = require('stream');


function normalizePrivateKey(key) {
  if (!key) return null;
  return key.replace(/\\n/g, '\n');
}

function buildGoogleAuth(logger, override) {
  const keyFile = override?.keyFile
    || process.env.GOOGLE_APPLICATION_CREDENTIALS
    || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const clientEmail =
    override?.clientEmail ||
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(
    override?.privateKey ||
    process.env.GOOGLE_DRIVE_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
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

class InvoiceService {
  constructor({ logger }) {
    this.logger = logger;
    this.envConfig = {
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || null,
      clientEmail:
        process.env.GOOGLE_DRIVE_CLIENT_EMAIL ||
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
        process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL,
      privateKey: normalizePrivateKey(
        process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
      )
    };
    this.currentConfig = { ...this.envConfig };
    this.applyCredentials(this.currentConfig);
  }

  applyCredentials(config = {}) {
    this.folderId = config.folderId || null;
    this.auth = buildGoogleAuth(this.logger, config);
    this.drive = this.auth ? google.drive({ version: 'v3', auth: this.auth }) : null;
  }

  updateCredentials(config = {}) {
    const merged = { ...this.envConfig, ...config };
    this.currentConfig = merged;
    this.applyCredentials(merged);
    this.logger?.info('Google credentials updated for Drive uploads');
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

  async processFile(file, { upload = true } = {}) {
    const uploadMeta = upload ? await this.uploadToDrive(file) : {};
    return {
      name: file.originalname || 'invoice',
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      ...uploadMeta
    };
  }
}

module.exports = { InvoiceService };
