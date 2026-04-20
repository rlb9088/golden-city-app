# UAT Balance

Checklist manual para validar el redisenio del modulo Balance antes de cerrar el sprint.

## Antes de empezar

1. Levanta el backend y el frontend.
2. Ejecuta el verificador E2E:

```bash
node backend/scripts/verifyBalanceE2E.js
```

3. Abre la pagina de Balance con un usuario admin.

## Checklist manual

- [ ] Con fecha hoy sin registro en `bancos` el calculo usa ayer + movimientos del dia.
- [ ] Con fecha historica se muestra el snapshot correcto.
- [ ] Los anulados no afectan los totales.
- [ ] Los desgloses cuadran con los totales.
- [ ] Editar `caja_inicio_mes` desde Configuracion impacta el Balance acumulado.
- [ ] Cambiar el filtro de fecha actualiza todos los KPIs y tablas.

## Criterio de cierre

- [ ] Todos los items anteriores estan marcados como OK por el usuario.
- [ ] Cualquier diferencia encontrada quedo resuelta con rollback o hotfix antes del cierre.
