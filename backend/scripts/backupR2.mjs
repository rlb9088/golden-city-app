import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { CopyObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const require = createRequire(import.meta.url);
const {
  buildBackupPrefix,
  createR2Client,
  encodeCopySource,
} = require('./backupHelpers');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getTrimmedEnv(name) {
  return String(process.env[name] ?? '').trim();
}

async function listObjects(client, bucket, prefix = 'receipts/') {
  const objects = [];
  let continuationToken;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    for (const item of response.Contents || []) {
      if (item.Key) {
        objects.push({
          key: item.Key,
          size: item.Size ?? null,
          etag: item.ETag ?? null,
          lastModified: item.LastModified ? new Date(item.LastModified).toISOString() : null,
        });
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

function buildBackupObjectKey(prefix, originalKey) {
  return `${prefix}/${originalKey}`;
}

async function runBackupR2(options = {}, deps = {}) {
  const bucket = String(options.bucket || getTrimmedEnv('R2_BUCKET')).trim();
  const sourcePrefix = String(options.sourcePrefix || 'receipts/').trim() || 'receipts/';
  const dryRun = Boolean(options.dryRun);
  const date = options.date || new Date();
  const getR2Client = deps.getR2Client || createR2Client;
  const logger = deps.logger || console;

  if (!bucket) {
    throw new Error('R2_BUCKET is required to back up R2 objects.');
  }

  const client = await getR2Client();
  const objects = await listObjects(client, bucket, sourcePrefix);
  const backupPrefix = buildBackupPrefix('r2', date);
  const backups = objects.map((object) => ({
    ...object,
    backupKey: buildBackupObjectKey(backupPrefix, object.key),
  }));

  if (dryRun) {
    return {
      dryRun: true,
      bucket,
      sourcePrefix,
      backupPrefix,
      objectCount: backups.length,
      backups,
    };
  }

  for (const object of backups) {
    await client.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: encodeCopySource(bucket, object.key),
      Key: object.backupKey,
      MetadataDirective: 'COPY',
    }));
  }

  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    bucket,
    sourcePrefix,
    backupPrefix,
    objectCount: backups.length,
    backups,
  };

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: `${backupPrefix}/manifest.json`,
    Body: `${JSON.stringify(manifest, null, 2)}\n`,
    ContentType: 'application/json; charset=utf-8',
  }));

  logger.log(`R2 backup stored in ${bucket}/${backupPrefix}`);

  return {
    dryRun: false,
    bucket,
    sourcePrefix,
    backupPrefix,
    objectCount: backups.length,
    manifest,
  };
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    bucket: argv.includes('--bucket')
      ? argv[argv.indexOf('--bucket') + 1]
      : undefined,
    sourcePrefix: argv.includes('--source-prefix')
      ? argv[argv.indexOf('--source-prefix') + 1]
      : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runBackupR2(args);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`R2 backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  buildBackupObjectKey,
  listObjects,
  parseArgs,
  runBackupR2,
};
