import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Map as MapIcon } from 'lucide-react';
import type { PotreroFeature } from '../../types/auth';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  SATELLITE_ATTRIBUTION,
  SATELLITE_TILE_URL,
  STATE_STYLE,
  geometryRings,
} from './mapShared';

interface PotreroCroquisProps {
  features: PotreroFeature[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  isLoading?: boolean;
}

/**
 * Croquis de la granja sobre mapa satelital real (Leaflet): renderiza los
 * polígonos GeoJSON de cada potrero, coloreados por estado operativo.
 *
 * El mapa se crea de forma imperativa por robustez frente a React StrictMode.
 */
export const PotreroCroquis: React.FC<PotreroCroquisProps> = ({
  features,
  selectedId,
  onSelect,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const drawable = useMemo(() => features.filter((feature) => feature.geometry), [features]);

  const allCoords = useMemo<[number, number][]>(
    () =>
      drawable.flatMap((feature) =>
        geometryRings(feature.geometry)
          .flatMap((ring) => ring)
          .map((point) => [Number(point[0]), Number(point[1])] as [number, number])
      ),
    [drawable]
  );

  // Creación única del mapa.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      scrollWheelZoom: true,
    });
    mapRef.current = map;
    L.tileLayer(SATELLITE_TILE_URL, { attribution: SATELLITE_ATTRIBUTION }).addTo(map);
    groupRef.current = L.layerGroup().addTo(map);

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 200);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      window.clearTimeout(resizeTimer);
      observer.disconnect();
      map.off();
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
    };
  }, []);

  // Dibuja los polígonos (reacciona a selección).
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    drawable.forEach((feature) => {
      const props = feature.properties;
      const geometry = feature.geometry;
      const rings = geometryRings(geometry).map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );
      if (rings.length === 0) return;

      const state = props.operational_state || 'disponible';
      const style = STATE_STYLE[state] || STATE_STYLE.disponible;
      const isSelected = selectedId != null && selectedId === props.id;

      const polygon = L.polygon(rings, {
        color: isSelected ? '#1B4D3E' : style.stroke,
        weight: isSelected ? 5 : 2.5,
        fillColor: style.fill,
        fillOpacity: 0.45,
      });

      polygon.bindTooltip(props.code || props.name, { sticky: true });

      const popup = document.createElement('div');
      popup.style.fontSize = '12px';
      const title = document.createElement('strong');
      title.textContent = props.name;
      popup.appendChild(title);
      const detail = document.createElement('div');
      detail.style.color = '#6b7280';
      detail.textContent = `${style.label} · ${Number(props.occupied_capacity)}/${Number(
        props.max_capacity
      )} animales`;
      popup.appendChild(detail);
      if (props.purpose) {
        const purpose = document.createElement('div');
        purpose.style.color = '#6b7280';
        purpose.textContent = `Propósito: ${props.purpose}`;
        popup.appendChild(purpose);
      }
      polygon.bindPopup(popup);

      polygon.on('click', () => onSelectRef.current?.(props.id));
      polygon.addTo(group);
    });
  }, [drawable, selectedId]);

  // Encuadra la vista al conjunto de geometrías.
  const boundsSignature = useMemo(
    () =>
      `${allCoords.length}:${allCoords[0]?.join(',') ?? ''}:${
        allCoords[allCoords.length - 1]?.join(',') ?? ''
      }`,
    [allCoords]
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || allCoords.length === 0) return;
    const bounds = L.latLngBounds(allCoords.map(([lng, lat]) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
  }, [boundsSignature, allCoords]);

  const isEmpty = !isLoading && drawable.length === 0;

  return (
    <div className="space-y-3">
      {/* El contenedor se monta siempre para que el mapa se cree una sola vez. */}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[440px] w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-[#263632] bg-[#F4F7F5] dark:bg-[#0E1513]"
        />

        {(isLoading || isEmpty) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/85 dark:bg-[#0E1513]/85 text-center pointer-events-none">
            <MapIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
            {isLoading ? (
              <p className="text-xs text-gray-500">Cargando croquis…</p>
            ) : (
              <>
                <p className="text-xs text-gray-400">
                  Aún no hay potreros con croquis dibujado.
                </p>
                <p className="text-[11px] text-gray-400">
                  Edita un potrero y dibuja su contorno en el mapa para verlo aquí.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Object.entries(STATE_STYLE).map(([state, style]) => (
            <span
              key={`legend-${state}`}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400"
            >
              <span
                className="w-3 h-3 rounded-sm border"
                style={{ backgroundColor: style.fill, borderColor: style.stroke }}
              />
              {style.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
