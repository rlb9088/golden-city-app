const test = require('node:test');
const assert = require('node:assert/strict');

function loadBancosService({ getAll, getConfigBancoById, getTable, validateReferences }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const configPath = require.resolve('../services/config.service');
  const servicePath = require.resolve('../services/bancos.service');

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
      deleteRow: async () => ({}),
      findByColumn: async () => [],
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
      validateReferences: validateReferences || (async () => []),
      getConfigBancoById: getConfigBancoById || (async (bancoId) => (bancoId ? { id: bancoId, nombre: String(bancoId) } : null)),
      getTable: getTable || (async () => []),
    },
  };

  return {
    service: require('../services/bancos.service'),
    appendCalls,
    updateCalls,
    auditCalls,
  };
}

test('upsert crea un saldo nuevo aunque exista otro banco con el mismo nombre', async () => {
  const { service, appendCalls, updateCalls, auditCalls } = loadBancosService({
    getAll: async () => ([
      {
        _rowIndex: 4,
        id: 'BAN-OLD',
        fecha: '2026-04-18',
        banco_id: 'BK-2',
        banco: 'BCP',
        saldo: 50,
      },
    ]),
    getConfigBancoById: async (bancoId) => {
      if (bancoId === 'BK-1') {
        return { id: 'BK-1', nombre: 'BCP', propietario_id: 'AG-1' };
      }

      if (bancoId === 'BK-2') {
        return { id: 'BK-2', nombre: 'BCP', propietario_id: 'AG-2' };
      }

      return null;
    },
  });

  const result = await service.upsert({
    fecha: '2026-04-18',
    banco_id: 'BK-1',
    saldo: 120,
  }, {
    userId: 'AG-1',
    role: 'admin',
    nombre: 'Administrador',
    user: 'Administrador',
  });

  assert.equal(result.overwritten, false);
  assert.equal(result.banco_id, 'BK-1');
  assert.equal(result.banco, 'BCP');
  assert.equal(appendCalls.length, 1);
  assert.equal(updateCalls.length, 0);
  assert.equal(appendCalls[0].data.banco_id, 'BK-1');
  assert.equal(appendCalls[0].data.banco, 'BCP');
  assert.equal(auditCalls[0][0], 'create');
  assert.equal(auditCalls[0][3].banco_id, 'BK-1');
});

test('getLatest agrupa por banco_id y conserva el saldo mas reciente por cuenta', async () => {
  const { service } = loadBancosService({
    getAll: async () => ([
      {
        id: 'BAN-1',
        fecha: '2026-04-17',
        banco_id: 'BK-1',
        banco: 'BCP',
        saldo: 80,
      },
      {
        id: 'BAN-2',
        fecha: '2026-04-18',
        banco_id: 'BK-1',
        banco: 'BCP',
        saldo: 90,
      },
      {
        id: 'BAN-3',
        fecha: '2026-04-17',
        banco_id: 'BK-2',
        banco: 'BCP',
        saldo: 70,
      },
    ]),
  });

  const result = await service.getLatest();

  assert.equal(result.length, 2);
  assert.deepStrictEqual(
    result.map((row) => [row.banco_id, row.fecha, row.saldo]),
    [
      ['BK-1', '2026-04-18', 90],
      ['BK-2', '2026-04-17', 70],
    ],
  );
});

test('getScopedBancos usa config_bancos, filtra por propietario y usa el caller como fallback para admin', async () => {
  const { service } = loadBancosService({
    getAll: async () => [],
    getTable: async () => ([
      { id: 'BK-1', nombre: 'BCP', propietario_id: 'AG-1' },
      { id: 'BK-2', nombre: 'Interbank', propietario_id: 'AG-2' },
      { id: 'BK-3', nombre: 'Yape', propietario_id: 'AG-1' },
    ]),
  });

  const agentResult = await service.getScopedBancos({
    caller: { userId: 'AG-1', role: 'agent', nombre: 'Agente 1' },
    agenteId: 'AG-2',
  });

  assert.deepStrictEqual(agentResult.map((row) => row.id), ['BK-1', 'BK-3']);

  const adminResult = await service.getScopedBancos({
    caller: { userId: 'AG-2', role: 'admin', nombre: 'Administrador' },
    agenteId: 'AG-2',
  });

  assert.deepStrictEqual(adminResult.map((row) => row.id), ['BK-2']);

  const adminAllResult = await service.getScopedBancos({
    caller: { userId: 'AG-2', role: 'admin', nombre: 'Administrador' },
  });

  assert.deepStrictEqual(adminAllResult.map((row) => row.id), ['BK-2']);
});

test('upsert rechaza bancos fuera del scope del administrador autenticado', async () => {
  const { service } = loadBancosService({
    getAll: async () => [],
    getConfigBancoById: async () => ({
      id: 'BK-9',
      nombre: 'BCP',
      propietario_id: 'AG-2',
    }),
  });

  await assert.rejects(
    () => service.upsert({
      fecha: '2026-04-18',
      banco_id: 'BK-9',
      saldo: 120,
    }, {
      userId: 'AUTH-ADMIN',
      role: 'admin',
      nombre: 'Administrador',
      user: 'Administrador',
    }),
    (error) => {
      assert.equal(error.statusCode, 403);
      return true;
    },
  );
});
