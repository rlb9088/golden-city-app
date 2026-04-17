const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const { todayLima, nowLima } = require('../config/timezone');
const repo = require('../repositories/sheetsRepository');
const pagosService = require('../services/pagos.service');
const ingresosService = require('../services/ingresos.service');
const gastosService = require('../services/gastos.service');
const bancosService = require('../services/bancos.service');
const balanceService = require('../services/balance.service');
const configService = require('../services/config.service');
const ocrService = require('../services/ocr.service');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatMoney(value) {
  return Number(value).toFixed(2);
}

async function readSheetCounts() {
  const [pagos, ingresos, gastos, bancos, audit, configAgentes, configUsuarios] = await Promise.all([
    repo.getAll('pagos'),
    repo.getAll('ingresos'),
    repo.getAll('gastos'),
    repo.getAll('bancos'),
    repo.getAll('audit'),
    repo.getAll('config_agentes'),
    repo.getAll('config_usuarios'),
  ]);

  return {
    pagos: pagos.length,
    ingresos: ingresos.length,
    gastos: gastos.length,
    bancos: bancos.length,
    audit: audit.length,
    configAgentes: configAgentes.length,
    configUsuarios: configUsuarios.length,
  };
}

function buildReport(results) {
  const lines = [
    '# TICKET-021 E2E Sheets Verification',
    '',
    `- Run at: ${results.runAt}`,
    `- Mode: ${results.mode}`,
    `- OCR: ${results.ocr.status}`,
    '',
    '## Checks',
  ];

  for (const check of results.checks) {
    lines.push(`- [${check.ok ? 'x' : ' '}] ${check.name}${check.details ? ` - ${check.details}` : ''}`);
  }

  lines.push('', '## Created Records');
  lines.push(`- Pago: ${results.created.pago.id}`);
  lines.push(`- Ingreso: ${results.created.ingreso.id}`);
  lines.push(`- Gasto: ${results.created.gasto.id}`);
  lines.push(`- Banco: ${results.created.banco.id}`);
  lines.push(`- Config agente: ${results.created.agente.id}`);
  lines.push(`- Config usuarios: ${results.created.usuarios.map((u) => u.id).join(', ')}`);
  lines.push('', '## Deltas');
  lines.push(`- Audit rows delta: ${results.deltas.audit}`);
  lines.push(`- Global balance delta: ${formatMoney(results.deltas.globalBalance)}`);
  lines.push(`- Expected global balance delta: ${formatMoney(results.expected.globalBalance)}`);
  lines.push('', '## Notes');
  lines.push('- Sheets writes now use RAW values and reads use unformatted values.');
  lines.push('- Config writes are audited with the authenticated user.');
  if (results.ocr.status === 'skipped') {
    lines.push(`- OCR skipped: ${results.ocr.reason}`);
  } else {
    lines.push(`- OCR parsed amount: ${results.ocr.amount}`);
    lines.push(`- OCR parsed date: ${results.ocr.date}`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const mode = process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.GOOGLE_SHEET_ID
    ? 'Google Sheets'
    : 'In-Memory';

  const beforeCounts = await readSheetCounts();
  const beforeBalance = await balanceService.getGlobalBalance();
  const beforeAudit = beforeCounts.audit;

  const suffix = Date.now();
  const controllerUser = `e2e.admin.${suffix}`;
  const agentUser = `e2e.agent.${suffix}`;
  const bankName = `E2E BANK ${suffix}`;
  const sharedDate = todayLima();
  const paymentAmount = 123.45;
  const incomeAmount = 300.25;
  const expenseAmount = 45.10;
  const bankBalance = 1250.75;

  const created = {
    usuarios: [],
  };

  created.pago = await pagosService.create({
    usuario: `E2E Pago ${suffix}`,
    caja: `Caja E2E ${suffix}`,
    banco: bankName,
    monto: paymentAmount,
    tipo: 'Transferencia',
    comprobante_url: `https://example.com/e2e/${suffix}`,
    fecha_comprobante: sharedDate,
  }, agentUser);

  created.ingreso = await ingresosService.create({
    agente: `Agente E2E ${suffix}`,
    banco: bankName,
    monto: incomeAmount,
    fecha_movimiento: sharedDate,
  }, controllerUser);

  created.gasto = await gastosService.create({
    concepto: `Gasto E2E ${suffix}`,
    categoria: 'Operativo',
    subcategoria: 'Control',
    banco: bankName,
    monto: expenseAmount,
    fecha_gasto: sharedDate,
  }, controllerUser);

  created.banco = await bancosService.upsert({
    fecha: sharedDate,
    banco: bankName,
    saldo: bankBalance,
  }, controllerUser);

  const updatedBanco = await bancosService.upsert({
    fecha: sharedDate,
    banco: bankName,
    saldo: bankBalance + 100,
  }, controllerUser);

  created.agente = await configService.addToTable('agentes', {
    nombre: `Agente Verificacion ${suffix}`,
  }, controllerUser);

  created.usuarios = await configService.importBatch('usuarios', [
    { nombre: `Usuario Verificacion A ${suffix}` },
    { nombre: `Usuario Verificacion B ${suffix}` },
  ], controllerUser);

  const afterBalance = await balanceService.getGlobalBalance();
  const afterCounts = await readSheetCounts();

  const expectedGlobalDelta = incomeAmount - paymentAmount - expenseAmount + (bankBalance + 100);
  const actualGlobalDelta = afterBalance.global - beforeBalance.global;

  let ocrResult = { status: 'skipped', reason: 'No OCR_SAMPLE_IMAGE_PATH provided' };
  const ocrSamplePath = process.env.OCR_SAMPLE_IMAGE_PATH;
  if (ocrSamplePath) {
    const absoluteOcrPath = path.resolve(process.cwd(), ocrSamplePath);
    assert(fs.existsSync(absoluteOcrPath), `OCR sample not found: ${absoluteOcrPath}`);
    const base64Image = `data:image/png;base64,${fs.readFileSync(absoluteOcrPath).toString('base64')}`;
    const analyzed = await ocrService.analyzeReceipt(base64Image);
    assert(analyzed && analyzed.monto !== null && analyzed.fecha, 'OCR sample did not produce amount/date');
    ocrResult = {
      status: 'ok',
      amount: analyzed.monto,
      date: analyzed.fecha,
      rawText: analyzed.rawText || null,
      samplePath: absoluteOcrPath,
    };
  }

  assert(created.pago && created.pago.id, 'Pago not created');
  assert(created.ingreso && created.ingreso.id, 'Ingreso not created');
  assert(created.gasto && created.gasto.id, 'Gasto not created');
  assert(created.banco && created.banco.id, 'Banco not created');
  assert(updatedBanco && updatedBanco.overwritten === true, 'Banco upsert overwrite not detected');
  assert(created.agente && created.agente.id, 'Config agente not created');
  assert(created.usuarios.length === 2, 'Config users import failed');

  const pagosAfter = await repo.getAll('pagos');
  const ingresosAfter = await repo.getAll('ingresos');
  const gastosAfter = await repo.getAll('gastos');
  const bancosAfter = await repo.getAll('bancos');
  const agentesAfter = await repo.getAll('config_agentes');
  const usuariosAfter = await repo.getAll('config_usuarios');

  const pagoRow = pagosAfter.find((row) => row.id === created.pago.id);
  const ingresoRow = ingresosAfter.find((row) => row.id === created.ingreso.id);
  const gastoRow = gastosAfter.find((row) => row.id === created.gasto.id);
  const bancoRow = bancosAfter.find((row) => row.id === created.banco.id);
  const agenteRow = agentesAfter.find((row) => row.id === created.agente.id);

  assert(pagoRow && typeof pagoRow.monto === 'number', 'Pago amount was not stored as a number');
  assert(ingresoRow && typeof ingresoRow.monto === 'number', 'Ingreso amount was not stored as a number');
  assert(gastoRow && typeof gastoRow.monto === 'number', 'Gasto amount was not stored as a number');
  assert(bancoRow && typeof bancoRow.saldo === 'number', 'Bank balance was not stored as a number');
  assert(agenteRow && agenteRow.nombre, 'Config agente not readable from Sheets');

  const bankRows = bancosAfter.filter((row) => row.banco === bankName && row.fecha === sharedDate);
  assert(bankRows.length === 1, 'Bank upsert should leave a single row for the same bank/date');
  assert(Number(bankRows[0].saldo) === bankBalance + 100, 'Bank overwrite did not persist the latest saldo');

  const expectedAuditDelta = 8;
  const auditDelta = afterCounts.audit - beforeAudit;
  assert(auditDelta >= expectedAuditDelta, 'Audit sheet did not capture all expected mutations');

  const results = {
    runAt: nowLima(),
    mode,
    created: {
      pago: created.pago,
      ingreso: created.ingreso,
      gasto: created.gasto,
      banco: created.banco,
      agente: created.agente,
      usuarios: created.usuarios,
    },
    expected: {
      globalBalance: expectedGlobalDelta,
    },
    deltas: {
      audit: auditDelta,
      globalBalance: actualGlobalDelta,
    },
    counts: {
      before: beforeCounts,
      after: afterCounts,
    },
    ocr: ocrResult,
    checks: [
      { name: 'Payment stored in pagos', ok: !!pagoRow },
      { name: 'Income stored in ingresos', ok: !!ingresoRow },
      { name: 'Expense stored in gastos', ok: !!gastoRow },
      { name: 'Bank upsert stored and overwritten', ok: bankRows.length === 1 },
      { name: 'Audit sheet captured mutations', ok: auditDelta >= expectedAuditDelta },
      { name: 'Global balance delta matches expected', ok: Math.abs(actualGlobalDelta - expectedGlobalDelta) < 0.0001 },
      { name: 'Config agente stored in config_agentes', ok: !!agenteRow },
      { name: 'Bulk users stored in config_usuarios', ok: usuariosAfter.length >= beforeCounts.configUsuarios + 2 },
    ],
  };

  const reportPath = process.env.REPORT_PATH;
  if (reportPath) {
    const absolutePath = path.resolve(process.cwd(), reportPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, buildReport(results), 'utf8');
    console.log(`[SheetsE2E] Report written to ${absolutePath}`);
  }

  console.log('[SheetsE2E] OK');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error('[SheetsE2E] Error:', error.message);
  process.exitCode = 1;
});
