const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadModule() {
  return import(pathToFileURL(path.resolve(__dirname, '../scripts/restoreR2.mjs')).href);
}

test('deriveDestinationKey returns the live receipt key from a dated backup key', async () => {
  const { deriveDestinationKey } = await loadModule();

  assert.equal(
    deriveDestinationKey('backups/r2/2026-04-20/receipts/invoice-1.jpg'),
    'receipts/invoice-1.jpg',
  );
});

test('runRestoreR2 can dry-run a receipt rollback', async () => {
  const { runRestoreR2 } = await loadModule();

  const result = await runRestoreR2({
    dryRun: true,
    bucket: 'bucket-123',
    sourceKey: 'backups/r2/2026-04-20/receipts/invoice-1.jpg',
  });

  assert.equal(result.destinationKey, 'receipts/invoice-1.jpg');
  assert.equal(result.dryRun, true);
});

test('runRestoreR2 copies a backup object back to the live key', async () => {
  const { runRestoreR2 } = await loadModule();

  const commands = [];
  const fakeClient = {
    send: async (command) => {
      commands.push({
        name: command.constructor.name,
        input: command.input,
      });
      return {};
    },
  };

  const result = await runRestoreR2(
    {
      bucket: 'bucket-123',
      sourceKey: 'backups/r2/2026-04-20/receipts/invoice-1.jpg',
    },
    {
      getR2Client: async () => fakeClient,
    },
  );

  assert.equal(result.destinationKey, 'receipts/invoice-1.jpg');
  assert.equal(commands[0].name, 'CopyObjectCommand');
  assert.equal(commands[0].input.Key, 'receipts/invoice-1.jpg');
});
