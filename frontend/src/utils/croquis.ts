/**
 * Utilidades geográficas del módulo Potreros.
 *
 * Los croquis ahora se dibujan sobre un mapa satelital real (Leaflet) y se
 * guardan como GeoJSON con coordenadas [lng, lat]. El backend calcula el área
 * exacta; aquí solo se ofrece un cálculo aproximado para mostrar en vivo.
 */

export type LngLat = [number, number];

/** Área aproximada (ha) de un anillo, proyectando grados a metros localmente. */
export const ringAreaHa = (ring: LngLat[]): number => {
  if (ring.length < 4) return 0;

  const meanLat = ring.reduce((acc, [, lat]) => acc + lat, 0) / ring.length;
  const mPerDegLat = 110574;
  const mPerDegLng = 111320 * Math.cos((meanLat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area += x1 * mPerDegLng * (y2 * mPerDegLat) - x2 * mPerDegLng * (y1 * mPerDegLat);
  }

  return Math.abs(area) / 2 / 10000;
};
