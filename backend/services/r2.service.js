const { randomBytes } = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('../lib/logger');

let r2Client = null;

function getEnv(name) {
  return String(process.env[name] ?? '').trim();
}

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const accountId = getEnv('R2_ACCOUNT_ID');
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured.');
  }

  r2Client = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return r2Client;
}

function normalizeExtension(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) {
    return 'jpg';
  }

  const mimeToExt = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  };

  if (mimeToExt[text]) {
    return mimeToExt[text];
  }

  const filenameMatch = text.match(/\.([a-z0-9]+)$/i);
  if (filenameMatch) {
    return filenameMatch[1].toLowerCase();
  }

  return 'jpg';
}

function buildReceiptKey(fileName, mimeType) {
  const timestamp = Date.now();
  const random = randomBytes(8).toString('hex');
  const extension = normalizeExtension(mimeType || fileName);
  return `receipts/${timestamp}-${random}.${extension}`;
}

async function uploadReceipt(fileBuffer, fileName, mimeType) {
  let bucket = '';
  let publicUrl = '';
  let key = '';

  try {
    bucket = getEnv('R2_BUCKET');
    publicUrl = getEnv('R2_PUBLIC_URL');

    if (!bucket || !publicUrl) {
      throw new Error('R2 bucket or public URL is not configured.');
    }

    const client = getR2Client();
    key = buildReceiptKey(fileName, mimeType);

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType || 'application/octet-stream',
    }));

    const basePublicUrl = publicUrl.replace(/\/+$/, '');
    return {
      url: `${basePublicUrl}/${key}`,
      key,
    };
  } catch (error) {
    logger.error('Receipt upload to Cloudflare R2 failed', {
      context: {
        component: 'r2.service',
        bucket,
        key,
        fileName: String(fileName ?? '').trim() || null,
      },
      error,
    });
    throw error;
  }
}

module.exports = {
  uploadReceipt,
};
