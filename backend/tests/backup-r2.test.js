const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  return import(pathToFileURL(path.resolve(__dirname, '../scripts/backupR2.mjs')).href);
}

test('runBackupR2 builds an immutable dated snapshot prefix', async () => {
  const { runBackupR2 } = await loadModule();

  const commands = [];
  const fakeClient = {
    send: async (command) => {
      commands.push({
        name: command.constructor.name,
        input: command.input,
      });

      if (command.constructor.name === 'ListObjectsV2Command') {
        return {
          Contents: [
            { Key: 'receipts/a.jpg', Size: 12, ETag: '"etag-a"', LastModified: new Date('2026-04-19T10:00:00Z') },
            { Key: 'receipts/b.jpg', Size: 14, ETag: '"etag-b"', LastModified: new Date('2026-04-19T11:00:00Z') },
          ],
          IsTruncated: false,
        };
      }

      return {};
    },
  };

  const result = await runBackupR2(
    {
      dryRun: true,
      bucket: 'bucket-123',
      date: new Date('2026-04-20T00:00:00Z'),
    },
    {
      getR2Client: async () => fakeClient,
    },
  );

  assert.equal(result.backupPrefix, 'backups/r2/2026-04-20');
  assert.equal(result.objectCount, 2);
  assert.equal(commands[0].name, 'ListObjectsV2Command');
  assert.deepEqual(result.backups.map((item) => item.backupKey), [
    'backups/r2/2026-04-20/receipts/a.jpg',
    'backups/r2/2026-04-20/receipts/b.jpg',
  ]);
});

test('runBackupR2 copies live objects into the backup prefix', async () => {
  const { runBackupR2 } = await loadModule();

  const commands = [];
  const fakeClient = {
    send: async (command) => {
      commands.push({
        name: command.constructor.name,
        input: command.input,
      });

      if (command.constructor.name === 'ListObjectsV2Command') {
        return {
          Contents: [
            { Key: 'receipts/a.jpg', Size: 12, ETag: '"etag-a"', LastModified: new Date('2026-04-19T10:00:00Z') },
          ],
          IsTruncated: false,
        };
      }

      return {};
    },
  };

  const result = await runBackupR2(
    {
      bucket: 'bucket-123',
      date: new Date('2026-04-20T00:00:00Z'),
    },
    {
      getR2Client: async () => fakeClient,
    },
  );

  assert.equal(result.manifest.objectCount, 1);
  assert.equal(commands.some((item) => item.name === 'CopyObjectCommand'), true);
  assert.equal(commands.some((item) => item.name === 'PutObjectCommand'), true);
});
