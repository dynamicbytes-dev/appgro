import { useEffect, useState } from 'react';

/**
 * Devuelve la fecha/hora actual y la refresca automáticamente cada
 * `intervalMs` milisegundos. Útil para relojes en vivo y etiquetas del tipo
 * "actualizado hace X".
 */
export const useNow = (intervalMs = 1000): Date => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), Math.max(250, intervalMs));
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
};

export default useNow;
