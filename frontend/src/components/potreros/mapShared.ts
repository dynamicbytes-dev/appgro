/**
 * Constantes y utilidades compartidas por los mapas del módulo Potreros
 * (editor de croquis y visor de la granja). Usa Leaflet + tiles públicos.
 */

/** Imagen satelital (Esri World Imagery). Requiere conexión a internet. */
export const SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const SATELLITE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics';

/** Mapa de calles estándar (OpenStreetMap). */
export const STREETS_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const STREETS_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Centro por defecto (Venezuela) cuando no hay geometrías ni ubicación. */
export const DEFAULT_MAP_CENTER: [number, number] = [8.0, -66.0];

export const DEFAULT_MAP_ZOOM = 13;

/** Estilos por estado operativo del potrero. */
export const STATE_STYLE: Record<string, { fill: string; stroke: string; label: string }> = {
  disponible: { fill: '#10b981', stroke: '#059669', label: 'Disponible' },
  ocupado: { fill: '#f59e0b', stroke: '#d97706', label: 'Ocupado' },
  descanso: { fill: '#0ea5e9', stroke: '#0284c7', label: 'En Descanso' },
  mantenimiento: { fill: '#f97316', stroke: '#ea580c', label: 'En Mantenimiento' },
  inactivo: { fill: '#94a3b8', stroke: '#64748b', label: 'Inactivo' },
};

/** Anillos [lng, lat] de una geometría GeoJSON Polygon/MultiPolygon. */
export const geometryRings = (geometry: unknown): number[][][] => {
  const geo = geometry as { type?: string; coordinates?: unknown } | null;
  if (!geo) return [];
  if (geo.type === 'Polygon') {
    return (geo.coordinates as number[][][]) || [];
  }
  if (geo.type === 'MultiPolygon') {
    return ((geo.coordinates as number[][][][]) || []).flat();
  }
  return [];
};
