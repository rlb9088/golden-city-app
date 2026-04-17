/**
 * Timezone helper — Centraliza todas las operaciones de fecha/hora
 * Zona horaria por defecto: America/Lima (UTC-5)
 */

const DEFAULT_TZ = 'America/Lima';

/**
 * Retorna la fecha/hora actual en la zona horaria configurada (ISO string).
 */
function nowLima() {
  return new Date().toLocaleString('sv-SE', {
    timeZone: DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(' ', 'T');
}

/**
 * Retorna la fecha actual como YYYY-MM-DD en la zona horaria configurada.
 */
function todayLima() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: DEFAULT_TZ });
}

/**
 * Retorna la zona horaria configurada.
 */
function getTimezone() {
  return DEFAULT_TZ;
}

module.exports = { nowLima, todayLima, getTimezone };
