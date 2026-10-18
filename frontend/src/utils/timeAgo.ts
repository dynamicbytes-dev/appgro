/**
 * Convierte una fecha en un texto relativo en español ("hace 5 min").
 *
 * @param date  Fecha objetivo (Date, ISO string o timestamp).
 * @param from  Referencia temporal (por defecto "ahora"). Permite recalcular
 *              el texto en cada tick de un reloj en vivo.
 * @param fallback Texto devuelto cuando la fecha es inválida o ausente.
 */
export const timeAgo = (
  date?: Date | string | number | null,
  from: Date = new Date(),
  fallback = '—'
): string => {
  if (date === null || date === undefined || date === '') return fallback;

  const then = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(then.getTime())) return fallback;

  const seconds = Math.max(0, Math.round((from.getTime() - then.getTime()) / 1000));
  if (seconds < 10) return 'hace unos segundos';
  if (seconds < 60) return `hace ${seconds} s`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.round(hours / 24);
  if (days < 30) return `hace ${days} d`;

  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? 'es' : ''}`;

  const years = Math.round(months / 12);
  return `hace ${years} año${years > 1 ? 's' : ''}`;
};

export default timeAgo;
