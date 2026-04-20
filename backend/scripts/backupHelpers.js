const { S3Client } = require('@aws-sdk/client-s3');

function getTrimmedEnv(name) {
  return String(process.env[name] ?? '').trim();
}

function createR2Client() {
  const accountId = getTrimmedEnv('R2_ACCOUNT_ID');
  const accessKeyId = getTrimmedEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getTrimmedEnv('R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials are not configured.');
  }

  return new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function dateStamp(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function sanitizeKeySegment(value) {
  return String(value ?? 'sheet')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'sheet';
}

function toColumnLetter(columnNumber) {
  let current = Math.max(1, Number(columnNumber) || 1);
  let column = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function escapeCsvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function rowsToCsv(values = []) {
  return values
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function buildBackupPrefix(domain, date = new Date()) {
  return `backups/${domain}/${dateStamp(date)}`;
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
}

async function bodyToBuffer(body) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string') {
    return Buffer.from(body);
  }

  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  if (typeof body.arrayBuffer === 'function') {
    return Buffer.from(await body.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    body.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    body.on('end', () => resolve(Buffer.concat(chunks)));
    body.on('error', reject);
  });
}

async function bodyToText(body) {
  const buffer = await bodyToBuffer(body);
  return buffer.toString('utf8');
}

module.exports = {
  bodyToBuffer,
  bodyToText,
  buildBackupPrefix,
  createR2Client,
  dateStamp,
  encodeCopySource,
  escapeCsvCell,
  getTrimmedEnv,
  rowsToCsv,
  sanitizeKeySegment,
  toColumnLetter,
};
