import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';
import { CopyObjectCommand } from '@aws-sdk/client-s3';

const require = createRequire(import.meta.url);
const {
  createR2Client,
  encodeCopySource,
} = require('./backupHelpers');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getTrimmedEnv(name) {
  return String(process.env[name] ?? '').trim();
}

function deriveDestinationKey(sourceKey, backupPrefix = 'backups/r2') {
  const normalizedSource = String(sourceKey ?? '').trim();
  const match = normalizedSource.match(new RegExp(`^${backupPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d{4}-\\d{2}-\\d{2}/(.+)$`));

  if (match) {
    return match[1];
  }

  return normalizedSource;
}

async function runRestoreR2(options = {}, deps = {}) {
  const bucket = String(options.bucket || getTrimmedEnv('R2_BUCKET')).trim();
  const sourceKey = String(options.sourceKey || '').trim();
  const destinationKey = String(options.destinationKey || deriveDestinationKey(sourceKey)).trim();
  const dryRun = Boolean(options.dryRun);
  const getR2Client = deps.getR2Client || createR2Client;
  const logger = deps.logger || console;

  if (!bucket) {
    throw new Error('R2_BUCKET is required to restore R2 objects.');
  }

  if (!sourceKey) {
    throw new Error('Provide --source-key to restore an R2 object.');
  }

  if (!destinationKey) {
    throw new Error('Could not derive a destination key for the restore.');
  }

  if (dryRun) {
    return {
      dryRun: true,
      bucket,
      sourceKey,
      destinationKey,
    };
  }

  const client = await getR2Client();
  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: encodeCopySource(bucket, sourceKey),
    Key: destinationKey,
    MetadataDirective: 'COPY',
  }));

  logger.log(`R2 object restored from ${sourceKey} to ${destinationKey}`);

  return {
    dryRun: false,
    bucket,
    sourceKey,
    destinationKey,
  };
}

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    bucket: argv.includes('--bucket')
      ? argv[argv.indexOf('--bucket') + 1]
      : undefined,
    sourceKey: argv.includes('--source-key')
      ? argv[argv.indexOf('--source-key') + 1]
      : undefined,
    destinationKey: argv.includes('--destination-key')
      ? argv[argv.indexOf('--destination-key') + 1]
      : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runRestoreR2(args);
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`R2 restore failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export {
  deriveDestinationKey,
  parseArgs,
  runRestoreR2,
};
