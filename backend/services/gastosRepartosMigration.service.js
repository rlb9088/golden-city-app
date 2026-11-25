/**
 * Migracion gastos (proveedor/nota/dominio) + modulo repartos e inversiones.
 *
 * Se ejecuta al arrancar el servidor (despues de alinear el esquema) y tambien desde
 * scripts/migrateGastosRepartos.js. Es idempotente y NO toca los datos de `gastos`
 * salvo rellenar `dominio` cuando esta vacio.
 *
 * Reglas para no pisar cambios posteriores del administrador:
 *  - Listas de nombres (conceptos/proveedores): se cargan solo si la hoja esta vacia.
 *  - Categorias de gastos: solo se migran si aun no existe la categoria marcador del
 *    catalogo ("Gastos Administrativos"); en esa unica pasada se agregan las del
 *    catalogo y (si prune) se retiran las que no pertenecen, dejando copia en auditoria.
 *  - Categorias de reparto: se cargan solo si la hoja esta vacia.
 */
const catalogos = require('../data/catalogos-gastos-repartos.json');
const repo = require('../repositories/sheetsRepository');
const audit = require('./audit.service');
const logger = require('../lib/logger');
const { createPrefixedId } = require('../utils/id');

const DOMINIO_GASTO = 'Gasto (OPEX)';
const MARKER_CATEGORIA = 'gastos administrativos';

const key = (value) => String(value ?? '').trim().toLowerCase();

const NAME_CATALOGS = [
  { sheet: 'config_conceptos_gasto', prefix: 'CON', values: catalogos.conceptos_gasto },
  { sheet: 'config_proveedores_gasto', prefix: 'PRO', values: catalogos.proveedores_gasto },
  { sheet: 'config_conceptos_reparto', prefix: 'CON', values: catalogos.conceptos_reparto },
  { sheet: 'config_proveedores_reparto', prefix: 'PRO', values: catalogos.proveedores_reparto },
];

function planNameCatalog(existingRows, wanted) {
  const have = new Set(existingRows.map((row) => key(row.nombre)));
  return wanted.filter((name) => !have.has(key(name)));
}

function planCategorias(existingRows, wanted, { withDominio = false } = {}) {
  const rowKey = (row) => [withDominio ? key(row.dominio) : '', key(row.categoria), key(row.subcategoria)].join('|');
  const wantedKeys = new Set(wanted.map(rowKey));
  const haveKeys = new Set(existingRows.map(rowKey));

  return {
    toAdd: wanted.filter((row) => !haveKeys.has(rowKey(row))),
    obsolete: existingRows.filter((row) => !wantedKeys.has(rowKey(row))),
  };
}

/**
 * @param {object} options
 * @param {boolean} options.apply   false = solo informa (dry-run)
 * @param {boolean} options.prune   retirar categorias de gastos fuera del catalogo (solo primera pasada)
 * @param {object}  options.sheets  cliente de Google Sheets
 * @param {string}  options.spreadsheetId
 * @param {Function} options.log
 */
async function runMigration({ apply = false, prune = false, sheets, spreadsheetId, log = () => {} }) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const existingSheets = new Set(meta.data.sheets.map((s) => s.properties.title));
  const read = async (sheet) => (existingSheets.has(sheet) ? repo.getAll(sheet) : []);
  const summary = { apply, names: {}, categoriasGasto: {}, categoriasReparto: {}, dominio: {} };

  // El esquema (hojas nuevas + columnas de gastos) lo alinea sheetsBootstrap antes de llamar aqui;
  // el script CLI lo invoca explicitamente.
  const missing = ['gastos', 'repartos', ...NAME_CATALOGS.map((c) => c.sheet), 'config_categorias_reparto']
    .filter((name) => !existingSheets.has(name));
  if (missing.length > 0) {
    log(`Hojas aun inexistentes (se omiten en esta pasada): ${missing.join(', ')}`);
  }

  for (const catalog of NAME_CATALOGS) {
    if (!existingSheets.has(catalog.sheet)) continue;
    const existing = await read(catalog.sheet);
    const toAdd = existing.length === 0 ? planNameCatalog(existing, catalog.values) : [];
    summary.names[catalog.sheet] = toAdd.length;
    log(`${catalog.sheet}: existentes=${existing.length}, a cargar=${toAdd.length}`);
    if (apply && toAdd.length > 0) {
      await repo.appendBatch(catalog.sheet, toAdd.map((name) => [createPrefixedId(catalog.prefix), name]));
    }
  }

  if (existingSheets.has('config_categorias')) {
    const rows = await read('config_categorias');
    const alreadyMigrated = rows.some((row) => key(row.categoria) === MARKER_CATEGORIA);
    const plan = alreadyMigrated
      ? { toAdd: [], obsolete: [] }
      : planCategorias(rows, catalogos.categorias_gasto);
    summary.categoriasGasto = { toAdd: plan.toAdd.length, obsolete: plan.obsolete.length, alreadyMigrated };
    log(`config_categorias: migrada=${alreadyMigrated}, a agregar=${plan.toAdd.length}, fuera de catalogo=${plan.obsolete.length}`);

    if (apply && plan.toAdd.length > 0) {
      await repo.appendBatch('config_categorias', plan.toAdd.map((row) => [createPrefixedId('CAT'), row.categoria, row.subcategoria]));
    }
    if (apply && prune && plan.obsolete.length > 0) {
      // Copia en auditoria antes de retirar (recuperable). Los gastos historicos conservan su texto.
      await audit.log('migration', 'config_categorias_prune', 'system', {
        removed: plan.obsolete.map(({ _rowIndex, ...rest }) => rest),
      });
      const rowsDesc = [...plan.obsolete].sort((a, b) => b._rowIndex - a._rowIndex);
      for (const row of rowsDesc) {
        await repo.deleteRow('config_categorias', row._rowIndex);
      }
      log(`Retiradas ${rowsDesc.length} categorias fuera de catalogo (copia en auditoria).`);
    }
  }

  if (existingSheets.has('config_categorias_reparto')) {
    const rows = await read('config_categorias_reparto');
    const toAdd = rows.length === 0 ? catalogos.categorias_reparto : [];
    summary.categoriasReparto = { toAdd: toAdd.length };
    log(`config_categorias_reparto: existentes=${rows.length}, a cargar=${toAdd.length}`);
    if (apply && toAdd.length > 0) {
      await repo.appendBatch('config_categorias_reparto', toAdd.map((row) => [createPrefixedId('CAT'), row.dominio, row.categoria, row.subcategoria]));
    }
  }

  if (existingSheets.has('gastos')) {
    const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'gastos!1:1' });
    const headers = headerResponse.data.values?.[0] || [];
    const dominioIndex = headers.indexOf('dominio');
    const gastos = await read('gastos');
    const blanks = gastos.filter((row) => !String(row.dominio ?? '').trim());
    summary.dominio = { total: gastos.length, blanks: blanks.length, columnReady: dominioIndex !== -1 };
    log(`gastos: ${gastos.length} filas, ${blanks.length} sin dominio`);

    if (apply && dominioIndex !== -1 && blanks.length > 0) {
      const column = String.fromCharCode(65 + dominioIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `gastos!${column}2:${column}${gastos.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: gastos.map((row) => [String(row.dominio ?? '').trim() || DOMINIO_GASTO]) },
      });
    }
  }

  logger.info('gastos/repartos migration finished', { context: { component: 'gastosRepartosMigration', summary } });
  return summary;
}

module.exports = { runMigration, planNameCatalog, planCategorias };
