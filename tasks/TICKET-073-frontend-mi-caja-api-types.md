# TICKET-073 — Frontend: tipos y cliente `getMiCaja` en `api.ts`

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 14 — Balance Mi Caja (agente)
> **Prioridad**: P1
> **Esfuerzo estimado**: ~1h
> **Dependencias**: TICKET-071

---

## Contexto

El frontend necesita una función tipada para llamar al nuevo endpoint `GET /api/balance/mi-caja` y la interfaz TypeScript que describe su respuesta.

## Alcance

Editar [frontend/src/lib/api.ts](../frontend/src/lib/api.ts).

### 1. Nuevas interfaces

```ts
export interface MiCajaMovimiento {
  montoInicial: number;
  pagosDia: number;
  saldoTotal: number;
}

export interface MiCajaSnapshot {
  fecha: string | null;
  agente: string;
  total: number;
  movimiento: MiCajaMovimiento;
  bancos: BalanceBankDetail[];  // reutilizar interfaz existente
}
```

Colocarlas junto a las interfaces de Balance existentes (líneas ~707-741).

### 2. Nueva función cliente

```ts
export async function getMiCaja(fecha?: string): Promise<{ data: MiCajaSnapshot }> {
  const params = new URLSearchParams();
  if (fecha && String(fecha).trim()) {
    params.set('fecha', String(fecha).trim());
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<{ data: MiCajaSnapshot }>(`/api/balance/mi-caja${suffix}`);
}
```

Patrón idéntico a `getBalance(fecha?)` ya existente.

## Criterios de aceptación

- [ ] `MiCajaSnapshot`, `MiCajaMovimiento` exportadas desde `api.ts`.
- [ ] `getMiCaja(fecha?)` exportada y compilable sin errores TypeScript.
- [ ] Reutiliza `BalanceBankDetail` existente (no duplicar).
- [ ] `npm run build` o `tsc --noEmit` pasan sin errores nuevos.

## Notas

- No crear componentes UI en este ticket — solo los tipos y la función de cliente.
- La función usa la misma utilidad `request` interna del archivo.
