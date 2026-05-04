const test = require('node:test');
const assert = require('node:assert/strict');

function loadBonosTotalesService({ getAll, getTable }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve('../services/bonos-totales.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];
  delete require.cache[configPath];

  const appendCalls = [];
  const updateCalls = [];
  const auditCalls = [];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      append: async (sheetName, data, headers) => {
        appendCalls.push({ sheetName, data, headers });
        return { status: 'success', mode: 'memory' };
      },
      update: async (sheetName, rowIndex, data, headers) => {
        updateCalls.push({ sheetName, rowIndex, data, headers });
        return { status: 'success', mode: 'memory' };
      },
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: async (...args) => {
        auditCalls.push(args);
        return { id: 'AUD-1' };
      },
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      getTable: getTable || (async (tableName) => {
        if (tableName === 'cajas') {
          return [
            { id: 'CJ-1', nombre: 'Caja 1' },
            { id: 'CJ-2', nombre: 'Caja 2' },
          ];
        }
        return [];
      }),
    },
  };

  return {
    service: require('../services/bonos-totales.service'),
    appendCalls,
    updateCalls,
    auditCalls,
  };
}

test('upsert crea un bono total nuevo', async () => {
  const { service, appendCalls, updateCalls, auditCalls } = loadBonosTotalesService({
    getAll: async () => ([]),
  });

  const result = await service.upsert({
    fecha: '2026-05-04',
    caja_id: 'CJ-1',
    monto: 120.5,
  }, {
    userId: 'AD-1',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

  assert.equal(result.overwritten, false);
  assert.equal(result.caja_id, 'CJ-1');
  assert.equal(result.caja, 'Caja 1');
  assert.equal(appendCalls.length, 1);
  assert.equal(updateCalls.length, 0);
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][1], 'bono_total');
});

test('upsert sobre la misma fecha y caja reemplaza el monto y marca overwritten', async () => {
  const { service, appendCalls, updateCalls, auditCalls } = loadBonosTotalesService({
    getAll: async () => ([
      {
        _rowIndex: 4,
        id: 'BON-1',
        fecha: '2026-05-04',
        caja_id: 'CJ-1',
        caja: 'Caja 1',
        monto: 80,
      },
    ]),
  });

  const result = await service.upsert({
    fecha: '2026-05-04',
    caja_id: 'CJ-1',
    monto: 180,
  }, {
    userId: 'AD-1',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

  assert.equal(result.overwritten, true);
  assert.equal(result.monto, 180);
  assert.equal(appendCalls.length, 0);
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].data.monto, 180);
  assert.equal(auditCalls[0][0], 'upsert_overwrite');
  assert.equal(auditCalls[0][1], 'bono_total');
});

test('upsert rechaza una caja_id inexistente', async () => {
  const { service } = loadBonosTotalesService({
    getAll: async () => ([]),
    getTable: async () => ([]),
  });

  await assert.rejects(
    () => service.upsert({
      fecha: '2026-05-04',
      caja_id: 'CJ-404',
      monto: 100,
    }, {
      userId: 'AD-1',
      role: 'admin',
      nombre: 'Administrador',
      user: 'Administrador',
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test('upsert rechaza un monto negativo', async () => {
  const { service } = loadBonosTotalesService({
    getAll: async () => ([]),
  });

  await assert.rejects(
    () => service.upsert({
      fecha: '2026-05-04',
      caja_id: 'CJ-1',
      monto: -1,
    }, {
      userId: 'AD-1',
      role: 'admin',
      nombre: 'Administrador',
      user: 'Administrador',
    }),
    (error) => {
      assert.equal(error.statusCode, 400);
      return true;
    },
  );
});

test('getPagedAndFiltered ordena por fecha descendente y caja ascendente', async () => {
  const { service } = loadBonosTotalesService({
    getAll: async () => ([
      {
        id: 'BON-1',
        fecha: '2026-05-02',
        caja_id: 'CJ-2',
        caja: 'Caja 2',
        monto: 50,
      },
      {
        id: 'BON-2',
        fecha: '2026-05-04',
        caja_id: 'CJ-2',
        caja: 'Caja 2',
        monto: 70,
      },
      {
        id: 'BON-3',
        fecha: '2026-05-04',
        caja_id: 'CJ-1',
        caja: 'Caja 1',
        monto: 90,
      },
    ]),
  });

  const result = await service.getPagedAndFiltered({}, 2, 1);

  assert.deepStrictEqual(
    result.items.map((row) => [row.id, row.fecha, row.caja]),
    [
      ['BON-2', '2026-05-04', 'Caja 2'],
      ['BON-1', '2026-05-02', 'Caja 2'],
    ],
  );
  assert.deepStrictEqual(result.pagination, {
    limit: 2,
    offset: 1,
    total: 3,
    hasMore: false,
  });
});

test('getLatest devuelve el ultimo bono por caja', async () => {
  const { service } = loadBonosTotalesService({
    getAll: async () => ([
      {
        id: 'BON-1',
        fecha: '2026-05-01',
        caja_id: 'CJ-1',
        caja: 'Caja 1',
        monto: 50,
      },
      {
        id: 'BON-2',
        fecha: '2026-05-03',
        caja_id: 'CJ-1',
        caja: 'Caja 1',
        monto: 80,
      },
      {
        id: 'BON-3',
        fecha: '2026-05-02',
        caja_id: 'CJ-2',
        caja: 'Caja 2',
        monto: 60,
      },
    ]),
  });

  const result = await service.getLatest();

  assert.deepStrictEqual(
    result.map((row) => [row.id, row.fecha, row.caja_id]),
    [
      ['BON-2', '2026-05-03', 'CJ-1'],
      ['BON-3', '2026-05-02', 'CJ-2'],
    ],
  );
});
