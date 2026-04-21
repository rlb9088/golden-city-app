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

## UAT - Mi Caja (agente)

- [ ] Agente logueado ve el link "Balance" en el sidebar.
- [ ] Al entrar a /balance como agente: muestra "Mi Caja" (no el dashboard admin).
- [ ] Sin fecha seleccionada -> modo ahora; KPI y tablas muestran data del dia actual.
- [ ] Con fecha historica -> KPI y tablas muestran snapshot al cierre de ese dia.
- [ ] Boton "Limpiar" restaura modo ahora.
- [ ] Monto inicial + pagos del dia cuadran con el saldo total mostrado en el KPI.
- [ ] Suma de saldos por banco = total "Mi caja".
- [ ] Agente sin movimientos -> KPI en S/ 0.00, empty states en tablas.
- [ ] Anulados no afectan ningun total (registrar un pago, anularlo, verificar).
- [ ] Admin logueado en /balance sigue viendo dashboard de administrador completo.
- [ ] Un agente no puede ver la caja de otro (probar llamada directa a /api/balance/mi-caja con token de agente A -> solo datos de A).
