const TIMEZONE = 'America/Lima';

/**
 * Formatea un monto como moneda peruana (PEN / S/).
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'S/ 0.00';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(num);
}

/**
 * Formatea un ISO string como fecha + hora en timezone Lima.
 */
export function formatDateTime(iso: string): string {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TIMEZONE,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Formatea un ISO string o YYYY-MM-DD como solo fecha.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    // Handle YYYY-MM-DD format (add time to avoid timezone shift)
    const d = dateStr.length === 10 ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: TIMEZONE,
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Retorna la fecha/hora actual en formato datetime-local para inputs HTML
 * en timezone Lima.
 */
export function getNowLima(): string {
  const now = new Date();
  return now.toLocaleString('sv-SE', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(' ', 'T');
}

/**
 * Retorna la fecha actual en formato YYYY-MM-DD en timezone Lima.
 */
export function getTodayLima(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: TIMEZONE });
}
