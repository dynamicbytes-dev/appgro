import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Undo2, Trash2, LocateFixed, Satellite, Map as MapIcon } from 'lucide-react';
import type { PotreroGeometry } from '../../types/auth';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  SATELLITE_ATTRIBUTION,
  SATELLITE_TILE_URL,
  STREETS_ATTRIBUTION,
  STREETS_TILE_URL,
} from './mapShared';
import { ringAreaHa } from '../../utils/croquis';

/** Punto en formato GeoJSON: [lng, lat]. */
type Point = [number, number];

/** Extrae los vértices (sin cerrar) de una geometría GeoJSON. */
const pointsFromGeometry = (geometry?: PotreroGeometry | null): Point[] => {
  if (!geometry) return [];

  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates[0];
  const ring = rings?.[0] || [];
  if (ring.length < 2) return [];

  const first = ring[0];
  const last = ring[ring.length - 1];
  const isClosed = ring.length > 1 && first[0] === last[0] && first[1] === last[1];
  const open = isClosed ? ring.slice(0, -1) : ring;

  return open.map((point) => [Number(point[0]), Number(point[1])] as Point);
};

/** Construye un GeoJSON Polygon (o null si aún no hay 3 vértices). */
const toGeometry = (points: Point[]): PotreroGeometry | null => {
  if (points.length < 3) return null;
  return { type: 'Polygon', coordinates: [[...points, points[0]]] };
};

/** Icono circular para los vértices (evita depender de los assets de Leaflet). */
const vertexIcon = L.divIcon({
  className: '',
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#1B4D3E;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface PotreroMapEditorProps {
  value?: PotreroGeometry | null;
  onChange: (geometry: PotreroGeometry | null) => void;
}

/**
 * Editor de croquis sobre mapa satelital real (Leaflet). Permite dibujar el
 * contorno del potrero haciendo clic, arrastrar vértices, deshacer/limpiar y
 * centrar con la ubicación actual del dispositivo. Guarda un GeoJSON Polygon
 * con coordenadas geográficas reales [lng, lat].
 *
 * El mapa se crea de forma imperativa (no con react-leaflet) para que sea
 * inmune al doble montaje de React StrictMode.
 */
export const PotreroMapEditor: React.FC<PotreroMapEditorProps> = ({ value, onChange }) => {
  const [points, setPoints] = useState<Point[]>(() => pointsFromGeometry(value));
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'streets'>('satellite');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const pointsRef = useRef<Point[]>(points);
  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string>(JSON.stringify(value?.coordinates ?? null));

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emit = useCallback((next: Point[]) => {
    pointsRef.current = next;
    setPoints(next);
    const geometry = toGeometry(next);
    lastEmittedRef.current = JSON.stringify(geometry?.coordinates ?? null);
    onChangeRef.current(geometry);
  }, []);

  const emitRef = useRef(emit);
  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  // Sincroniza los vértices cuando el valor cambia externamente (p. ej. al abrir
  // el modal en modo edición), sin pisar lo que el usuario está dibujando.
  const serialized = useMemo(() => JSON.stringify(value?.coordinates ?? null), [value]);
  useEffect(() => {
    if (serialized !== lastEmittedRef.current) {
      const next = pointsFromGeometry(value);
      pointsRef.current = next;
      setPoints(next);
      lastEmittedRef.current = serialized;
    }
  }, [serialized, value]);

  // Creación única del mapa (inmune a StrictMode: recrea si se desmonta).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const initialPoints = pointsRef.current;
    const initialCenter: [number, number] =
      initialPoints.length > 0
        ? [
            initialPoints.reduce((acc, [, lat]) => acc + lat, 0) / initialPoints.length,
            initialPoints.reduce((acc, [lng]) => acc + lng, 0) / initialPoints.length,
          ]
        : DEFAULT_MAP_CENTER;

    const map = L.map(container, {
      center: initialCenter,
      zoom: DEFAULT_MAP_ZOOM,
      doubleClickZoom: false,
      scrollWheelZoom: false,
    });
    mapRef.current = map;
    groupRef.current = L.layerGroup().addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      emitRef.current([
        ...pointsRef.current,
        [Number(event.latlng.lng.toFixed(7)), Number(event.latlng.lat.toFixed(7))],
      ]);
    });

    if (initialPoints.length > 0) {
      const bounds = L.latLngBounds(
        initialPoints.map(([lng, lat]) => [lat, lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
    }

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
      tileRef.current = null;
    };
  }, []);

  // Capa base (satélite / calles).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      map.removeLayer(tileRef.current);
      tileRef.current = null;
    }
    const isSatellite = baseLayer === 'satellite';
    const layer = L.tileLayer(isSatellite ? SATELLITE_TILE_URL : STREETS_TILE_URL, {
      attribution: isSatellite ? SATELLITE_ATTRIBUTION : STREETS_ATTRIBUTION,
    });
    layer.addTo(map);
    tileRef.current = layer;
  }, [baseLayer]);

  // Dibuja el polígono y los vértices arrastrables.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    const positions = points.map(([lng, lat]) => [lat, lng] as [number, number]);

    if (points.length === 2) {
      L.polyline(positions, { color: '#1B4D3E', weight: 3, interactive: false }).addTo(group);
    } else if (points.length >= 3) {
      L.polygon(positions, {
        color: '#1B4D3E',
        weight: 3,
        fillColor: '#1B4D3E',
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(group);
    }

    points.forEach(([lng, lat], index) => {
      const marker = L.marker([lat, lng], { icon: vertexIcon, draggable: true });
      marker.on('dragend', () => {
        const latlng = marker.getLatLng();
        emitRef.current(
          pointsRef.current.map((current, i) =>
            i === index ? ([latlng.lng, latlng.lat] as Point) : current
          )
        );
      });
      marker.addTo(group);
    });
  }, [points]);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) {
      setLocationMessage('La geolocalización no está disponible en este dispositivo.');
      return;
    }
    setLocationMessage('Obteniendo ubicación…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 17);
        setLocationMessage(null);
      },
      () => setLocationMessage('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const areaHa = useMemo(
    () => (points.length >= 3 ? ringAreaHa([...points, points[0]]) : 0),
    [points]
  );

  const controlClass =
    'inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const neutralClass = `${controlClass} border-gray-200 dark:border-[#263632] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#18221F]`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-gray-400">
          {points.length === 0
            ? 'Haz clic en el mapa para marcar los vértices del contorno.'
            : `${points.length} vértice(s) marcado(s).`}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setBaseLayer(baseLayer === 'satellite' ? 'streets' : 'satellite')}
            className={neutralClass}
            title="Alternar entre imagen satelital y calles"
          >
            {baseLayer === 'satellite' ? (
              <>
                <MapIcon className="w-3 h-3" /> Calles
              </>
            ) : (
              <>
                <Satellite className="w-3 h-3" /> Satélite
              </>
            )}
          </button>
          <button type="button" onClick={handleLocate} className={neutralClass}>
            <LocateFixed className="w-3 h-3" /> Mi ubicación
          </button>
          <button
            type="button"
            onClick={() => emit(points.slice(0, -1))}
            disabled={points.length === 0}
            className={neutralClass}
          >
            <Undo2 className="w-3 h-3" /> Deshacer
          </button>
          <button
            type="button"
            onClick={() => emit([])}
            disabled={points.length === 0}
            className={`${controlClass} border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20`}
          >
            <Trash2 className="w-3 h-3" /> Limpiar
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[300px] w-full overflow-hidden rounded-xl border border-gray-200 dark:border-[#263632] bg-[#F4F7F5] dark:bg-[#0E1513]"
      />

      <p className="text-[10px] text-gray-400">
        {locationMessage ? (
          <span className="text-amber-600 dark:text-amber-400">{locationMessage}</span>
        ) : points.length < 3 ? (
          'Se necesitan al menos 3 vértices para formar el contorno. Arrastra un vértice para ajustarlo.'
        ) : (
          `Superficie aproximada del croquis: ${areaHa.toFixed(2)} ha. Arrastra un vértice para ajustarlo.`
        )}
      </p>
    </div>
  );
};
