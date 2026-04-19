const test = require('node:test');
const assert = require('node:assert/strict');

function loadConfigService({ getAll, deleteRow, auditLog }) {
  const repoPath = require.resolve('../repositories/sheetsRepository');
  const auditPath = require.resolve('../services/audit.service');
  const servicePath = require.resolve('../services/config.service');

  delete require.cache[servicePath];
  delete require.cache[repoPath];
  delete require.cache[auditPath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: {
      getAll,
      deleteRow,
      append: async () => ({}),
      update: async () => ({}),
      findByColumn: async () => [],
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      log: auditLog,
    },
  };

  return require('../services/config.service');
}

function loadConfigController({ removeFromTable }) {
  const servicePath = require.resolve('../services/config.service');
  const controllerPath = require.resolve('../controllers/config.controller');

  delete require.cache[controllerPath];
  delete require.cache[servicePath];

  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: {
      removeFromTable,
    },
  };

  return require('../controllers/config.controller');
}

test('removeFromTable borra la fila real de Sheets y audita el delete', async () => {
  let deletedCall = null;
  let auditCall = null;

  const configService = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_bancos') {
        return [
          {
            _rowIndex: 7,
            id: 'BK-99',
            nombre: 'Banco Demo',
            propietario: '',
            propietario_id: 'AG-1',
          },
        ];
      }

      if (sheetName === 'config_agentes') {
        return [
          {
            _rowIndex: 2,
            id: 'AG-1',
            nombre: 'Administrador',
            username: 'admin',
            password_hash: 'hash-1',
            role: 'admin',
            activo: true,
          },
        ];
      }

      return [];
    },
    deleteRow: async (sheetName, rowIndex) => {
      deletedCall = { sheetName, rowIndex };
      return { status: 'success', mode: 'sheets' };
    },
    auditLog: async (action, entity, user, changes) => {
      auditCall = { action, entity, user, changes };
      return { id: 'AUD-1' };
    },
  });

  const result = await configService.removeFromTable('bancos', 'BK-99', 'tester');

  assert.deepStrictEqual(result, { status: 'removed', id: 'BK-99' });
  assert.deepStrictEqual(deletedCall, { sheetName: 'config_bancos', rowIndex: 7 });
  assert.deepStrictEqual(auditCall, {
    action: 'delete',
    entity: 'config_bancos',
    user: 'tester',
    changes: {
      id: 'BK-99',
      nombre: 'Banco Demo',
      propietario: '',
      propietario_id: 'AG-1',
    },
  });
});

test('removeFromTable borra seed data cuando la hoja esta vacia', async () => {
  let deleteRowCalled = false;
  let auditCall = null;

  const configService = loadConfigService({
    getAll: async () => [],
    deleteRow: async () => {
      deleteRowCalled = true;
      return { status: 'success', mode: 'memory' };
    },
    auditLog: async (action, entity, user, changes) => {
      auditCall = { action, entity, user, changes };
      return { id: 'AUD-2' };
    },
  });

  const result = await configService.removeFromTable('agentes', 'AG-1', 'tester');

  assert.deepStrictEqual(result, { status: 'removed', id: 'AG-1' });
  assert.equal(deleteRowCalled, false);
  assert.deepStrictEqual(auditCall, {
    action: 'delete',
    entity: 'config_agentes',
    user: 'tester',
    changes: {
      id: 'AG-1',
      nombre: 'Agente 1',
      username: 'agente1',
      role: 'agent',
      activo: true,
    },
  });
});

test('removeFromTable rechaza eliminar al unico admin activo', async () => {
  const configService = loadConfigService({
    getAll: async (sheetName) => {
      if (sheetName === 'config_agentes') {
        return [
          {
            _rowIndex: 2,
            id: 'AG-1',
            nombre: 'Administrador',
            username: 'admin',
            password_hash: 'hash-1',
            role: 'admin',
            activo: true,
          },
        ];
      }

      return [];
    },
    deleteRow: async () => ({ status: 'success' }),
    auditLog: async () => ({ id: 'AUD-3' }),
  });

  await assert.rejects(
    () => configService.removeFromTable('agentes', 'AG-1', 'tester'),
    /sin un admin activo/i,
  );
});

test('removeFromTable del controller propaga el usuario autenticado al service', async () => {
  let receivedArgs = null;
  const controller = loadConfigController({
    removeFromTable: async (table, id, user) => {
      receivedArgs = { table, id, user };
      return { status: 'removed', id };
    },
  });

  const req = {
    params: { table: 'bancos', id: 'BK-1' },
    auth: { user: 'controller-user' },
  };
  const res = {
    jsonPayload: null,
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };

  await controller.removeFromTable(req, res);

  assert.deepStrictEqual(receivedArgs, {
    table: 'bancos',
    id: 'BK-1',
    user: 'controller-user',
  });
  assert.deepStrictEqual(res.jsonPayload, {
    status: 'success',
    data: { status: 'removed', id: 'BK-1' },
  });
});
