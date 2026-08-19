const { bootstrapEnvironment } = require('../config/bootstrapEnv');

bootstrapEnvironment();

const clientesService = require('../services/clientes.service');

async function main() {
  const commit = process.argv.includes('--commit');
  const result = await clientesService.repairImportedData('system_data_repair', { dryRun: !commit });
  console.log(JSON.stringify(result));

  if (!commit) {
    console.log('Dry-run complete. Run with --commit to apply the audited repair.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
