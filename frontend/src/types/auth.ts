export type UserRole = "root" | "admin" | "subordinate" | "ROOT" | "ADMIN" | "ENCARGADO";

export type ModuleId = 'especies' | 'galpones' | 'potreros' | 'lotes' | 'actividades' | 'inventario' | 'analitica' | 'historial';

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  category: "produccion" | "gestion" | "operativo";
  roles: UserRole[];
}

export interface SystemModule {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_enabled?: boolean;
}

export interface User {
  id: number | string;
  name: string;
  lastname?: string;
  email: string;
  phone?: string;
  role: string;
  farm_id?: number | string | null;
  farmId?: number | string | null;
  farm_name?: string;
  farmName?: string;
  is_active?: boolean;
  status?: string;
  created_at?: string;
  createdAt?: string;
  farm?: {
    id: number | string;
    name: string;
    code?: string;
    sector?: string;
    location?: string;
    is_active?: boolean;
  } | null;
  modules?: SystemModule[];
  farm_modules?: any[];
  subordinate_modules?: any[];
  enabledModules?: string[];
}

export interface Farm {
  id: number | string;
  code: string;
  name: string;
  sector?: string;
  location?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  is_active?: boolean;
  status?: string;
  created_at?: string;
  createdAt?: string;
  users_count?: number;
  totalAnimals?: number;
  totalSubordinates?: number;
  modules?: SystemModule[];
  enabledModules?: string[];
  users?: User[];
}

export interface CreateFarmDTO {
  name: string;
  sector?: string;
  location?: string;
  is_active?: boolean;
}

export interface UpdateFarmDTO {
  name?: string;
  sector?: string;
  location?: string;
  is_active?: boolean;
}

export interface CreateAdminDTO {
  name: string;
  lastname?: string;
  email: string;
  phone?: string;
  password: string;
  farm_id: number | string;
  is_active?: boolean;
  module_ids?: number[];
  modules?: string[];
}

export interface UpdateAdminDTO {
  name?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  password?: string;
  farm_id?: number | string;
  is_active?: boolean;
  module_ids?: number[];
  modules?: string[];
}

export interface Subordinate {
  id: number | string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  role: "ENCARGADO" | "subordinate";
  farmId: number | string;
  assignedModules: string[];
  status: "active" | "inactive";
  lastAccess?: string;
  createdAt?: string;
}

export interface AuthResponse {
  status: string;
  message?: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    user: User;
    modules: SystemModule[];
  };
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface Species {
  id: number;
  farm_id: number;
  name: string;
  category: string;
  is_active: boolean;
  /**
   * Nombre personalizado registrado con "Otro" (no pertenece a la
   * taxonomía oficial del sector). Solo admite el propósito "Carne".
   */
  is_custom?: boolean;
  created_at?: string;
  updated_at?: string;
  farm?: {
    id: number | string;
    name: string;
    code?: string;
  };
}

export interface CreateSpeciesDTO {
  name: string;
  category: string;
  is_active?: boolean;
  /** Marca la especie como personalizada (registrada con "Otro"). */
  is_custom?: boolean;
  farm_id?: number | string;
}

export interface UpdateSpeciesDTO {
  name?: string;
  category?: string;
  is_active?: boolean;
  /** Marca la especie como personalizada (registrada con "Otro"). */
  is_custom?: boolean;
}

/* ------------------------------------------------------------------ */
/* Módulo Potreros · Fase 3: georreferenciación (croquis GeoJSON)       */
/* ------------------------------------------------------------------ */

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type PotreroGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

export interface PotreroFeatureProperties {
  id: number;
  code?: string | null;
  name: string;
  category?: string | null;
  sector?: string | null;
  purpose?: string | null;
  species?: string | null;
  is_custom?: boolean;
  is_active?: boolean;
  operational_state?: string | null;
  max_capacity: number;
  occupied_capacity: number;
  available_capacity: number;
  superficie_ha?: number | null;
  capacidad_ua?: number | null;
  geo_area_ha?: number | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
}

export interface PotreroFeature {
  type: 'Feature';
  geometry: PotreroGeometry | null;
  properties: PotreroFeatureProperties;
}

export interface PotreroFeatureCollection {
  type: 'FeatureCollection';
  features: PotreroFeature[];
}

export interface Barn {
  id: number;
  farm_id: number;
  species_id?: number | null;
  name: string;
  /** Código interno único por granja (ej. POT-0001). */
  code?: string | null;
  category?: string;
  sector?: string;
  purpose: string;
  max_capacity: number;
  /** Superficie total del potrero en hectáreas. */
  superficie_ha?: string | number | null;
  /** Capacidad de carga máxima en Unidades Animales (UA). */
  capacidad_ua?: string | number | null;
  /** Estado operativo manual: disponible | descanso | mantenimiento. */
  operational_status?: string | null;
  tipo_pastura?: string | null;
  /** plano | ondulado | quebrado */
  topografia?: string | null;
  tipo_cercado?: string | null;
  fuente_agua?: string[] | null;
  notes?: string | null;
  /** Límite del potrero en GeoJSON (croquis). */
  geometry?: PotreroGeometry | null;
  centroid_lat?: string | number | null;
  centroid_lng?: string | number | null;
  /** Superficie calculada a partir de la geometría (ha). */
  geo_area_ha?: string | number | null;
  /** Estado mostrado (derivado): inactivo | ocupado | disponible | descanso | mantenimiento. */
  operational_state?: string | null;
  /** Carga agronómica calculada: UA por hectárea. */
  ua_per_ha?: number | null;
  occupied_capacity?: number;
  available_capacity?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  species?: {
    id: number;
    name: string;
    category?: string;
    is_active?: boolean;
    /** Nombre personalizado ("Otro"): solo admite el propósito Carne. */
    is_custom?: boolean;
  } | null;
  farm?: {
    id: number | string;
    name: string;
    code?: string;
  };
  lots?: any[];
}

export type Galpon = Barn;

/**
 * Módulo Potreros: espejo del módulo Galpones pero acotado a los
 * sectores pecuarios Bovino, Ovino y Caprino. Comparte la misma
 * estructura de datos, por lo que reutiliza el tipo `Barn`.
 */
export type Potrero = Barn;

export interface CreateBarnDTO {
  name: string;
  species_id: number;
  category?: string;
  sector?: string;
  purpose: string;
  max_capacity: number;
  code?: string;
  superficie_ha?: number | null;
  capacidad_ua?: number | null;
  operational_status?: string;
  tipo_pastura?: string | null;
  topografia?: string | null;
  tipo_cercado?: string | null;
  fuente_agua?: string[] | null;
  notes?: string | null;
  geometry?: PotreroGeometry | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  is_active?: boolean;
  farm_id?: number | string;
}

export interface UpdateBarnDTO {
  name?: string;
  species_id?: number;
  category?: string;
  sector?: string;
  purpose?: string;
  max_capacity?: number;
  code?: string;
  superficie_ha?: number | null;
  capacidad_ua?: number | null;
  operational_status?: string;
  tipo_pastura?: string | null;
  topografia?: string | null;
  tipo_cercado?: string | null;
  fuente_agua?: string[] | null;
  notes?: string | null;
  geometry?: PotreroGeometry | null;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  is_active?: boolean;
}

export type CreatePotreroDTO = CreateBarnDTO;
export type UpdatePotreroDTO = UpdateBarnDTO;

/* ------------------------------------------------------------------ */
/* Módulo Potreros · Fase 2: manejo agronómico                         */
/* ------------------------------------------------------------------ */

export interface PastureTreatment {
  id: number;
  farm_id: number;
  potrero_id: number;
  /** fertilizacion | control_malezas | resiembra | riego | encalado | otro */
  type: string;
  product?: string | null;
  dose?: string | number | null;
  dose_unit?: string | null;
  applied_at: string;
  cost?: string | number | null;
  notes?: string | null;
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePastureTreatmentDTO {
  type: string;
  product?: string | null;
  dose?: number | null;
  dose_unit?: string | null;
  applied_at: string;
  cost?: number | null;
  notes?: string | null;
}

export interface PastureBiomassSurvey {
  id: number;
  farm_id: number;
  potrero_id: number;
  surveyed_at: string;
  entry_height_cm?: string | number | null;
  exit_height_cm?: string | number | null;
  biomass_kg_dm_ha?: string | number | null;
  notes?: string | null;
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePastureBiomassSurveyDTO {
  surveyed_at: string;
  entry_height_cm?: number | null;
  exit_height_cm?: number | null;
  biomass_kg_dm_ha?: number | null;
  notes?: string | null;
}

export interface PotreroActiveLot {
  id: number;
  code?: string | null;
  quantity: number;
  current_occupancy: number;
  entry_date?: string | null;
}

export interface RotationHistoryEntry {
  id: number;
  code?: string | null;
  species?: string | null;
  purpose?: string | null;
  quantity: number;
  status: string;
  entry_date?: string | null;
  exit_date?: string | null;
  days_occupied?: number | null;
}

/**
 * Resumen de manejo y rotación de un potrero (Fase 2).
 * Incluye métricas derivadas de los lotes activos, el forraje disponible
 * y los historiales de tratamientos y aforos.
 */
export interface PotreroManagement {
  potrero: Potrero;
  occupied_capacity: number;
  available_capacity: number;
  operational_state: string;
  ua_per_ha: number | null;
  active_lots: PotreroActiveLot[];
  days_occupied: number | null;
  last_rest_date: string | null;
  days_resting: number | null;
  latest_biomass_kg_dm_ha: number | null;
  forage_available_kg_dm: number | null;
  daily_demand_kg_dm: number | null;
  estimated_exit_date: string | null;
  treatments: PastureTreatment[];
  biomass_surveys: PastureBiomassSurvey[];
  /** Fase 3: historial de rotaciones (lotes que ocuparon el potrero). */
  rotation_history: RotationHistoryEntry[];
  rotation_count: number;
}

/* ------------------------------------------------------------------ */
/* Módulo Lotes                                                        */
/* ------------------------------------------------------------------ */

export interface Lot {
  id: number;
  farm_id: number;
  galpon_id: number | null;
  potrero_id: number | null;
  barn_id: number | null;
  code: string;
  species_id: number | null;
  sector: string | null;
  purpose: string | null;
  quantity: number;
  /**
   * Ocupación actual del lote (animales activos +
   * en gestación + destetados). Solo las salidas
   * definitivas (cosechado / vendido / descartado /
   * muerto) dejan de ocupar.
   */
  current_occupancy?: number;
  /**
   * Costo total de cosecha: suma del precio total de
   * venta de los animales cosechados del lote.
   */
  harvest_cost?: number;
  status: string;
  entry_date: string | null;
  harvest_date: string | null;
  avg_weight: string | number | null;
  total_weight: string | number | null;
  price_per_kg: string | number | null;
  total_price: string | number | null;
  total_eggs: number;
  broken_eggs: number;
  egg_price: string | number | null;
  total_egg_cost: string | number | null;
  total_broken_cost: string | number | null;
  /**
   * Costo de inversión (adquisición) de los animales del lote.
   * `null` = sin dato (se excluye de los totales de Analítica).
   */
  investment_cost: string | number | null;
  created_at?: string;
  updated_at?: string;
  galpon?: {
    id: number;
    name: string;
    max_capacity?: number;
    occupied_capacity?: number;
    available_capacity?: number;
  } | null;
  potrero?: {
    id: number;
    name: string;
    max_capacity?: number;
    occupied_capacity?: number;
    available_capacity?: number;
  } | null;
  species?: {
    id: number;
    name: string;
    category?: string;
    is_active?: boolean;
    /** Nombre personalizado ("Otro"): solo admite el propósito Carne. */
    is_custom?: boolean;
  } | null;
  farm?: {
    id: number | string;
    name: string;
    code?: string;
  };
}

export interface LotStats {
  total_lotes: number;
  active_lotes: number;
  inactive_lotes: number;
  total_animals: number;
  total_lote_animals: number;
  /**
   * Animales realmente alojados (ocupando espacio):
   * activos + en gestación de los lotes activos; los
   * lotes sin seguimiento individual (ej. engorde)
   * aportan su cantidad declarada.
   */
  in_production_animals?: number;
}

export interface CreateLotDTO {
  /**
   * Destino del lote: galpón (especies Avícola/Porcina/Cunícola) o
   * potrero (especies Bovino/Ovino/Caprino). El backend exige el
   * destino correspondiente al sector de la especie.
   */
  galpon_id?: number;
  potrero_id?: number;
  species_id: number;
  quantity: number;
  purpose?: string;
  entry_date?: string;
  farm_id?: number | string;
  /**
   * Costo de inversión (adquisición) de los animales del lote.
   */
  investment_cost?: number | null;
  /**
   * Destetes de origen cuyos lechones vivos forman este lote
   * (flujo de lechones destetados). El backend valida la
   * cantidad EXACTA de vivos pendientes y marca los destetes
   * como resueltos.
   */
  from_service_ids?: number[];
}

export interface UpdateLotDTO {
  galpon_id?: number;
  potrero_id?: number;
  species_id?: number;
  quantity?: number;
  purpose?: string;
  status?: string;
  entry_date?: string;
  /**
   * Costo de inversión (adquisición) de los animales del lote.
   */
  investment_cost?: number | null;
}

export interface HarvestLotDTO {
  harvest_date?: string;
  avg_weight: number;
  price_per_kg: number;
  quantity?: number;
}

export interface RegisterEggsDTO {
  total_eggs: number;
  broken_eggs?: number;
  egg_price: number;
}

export interface LoteAnimal {
  id: number;
  lote_id: number;
  identifier: string;
  name: string | null;
  color: string | null;
  breed: string | null;
  father_breed: string | null;
  mother_breed: string | null;
  gender: string;
  birth_date: string | null;
  parity_count: number;
  teats_count: number;
  avg_piglets_per_birth: string | number;
  sale_weight: string | number | null;
  sale_price_per_kg: string | number | null;
  sale_total_price: string | number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  lote?: Lot | null;
  services?: AnimalService[];
}

export interface CreateLoteAnimalDTO {
  name?: string;
  color?: string;
  breed?: string;
  father_breed?: string;
  mother_breed?: string;
  gender: 'hembra' | 'macho';
  birth_date?: string;
  parity_count?: number;
  teats_count?: number;
  avg_piglets_per_birth?: number;
}

export interface UpdateLoteAnimalDTO {
  name?: string;
  color?: string;
  breed?: string;
  father_breed?: string;
  mother_breed?: string;
  gender?: 'hembra' | 'macho';
  birth_date?: string;
  parity_count?: number;
  teats_count?: number;
  avg_piglets_per_birth?: number;
  sale_weight?: number;
  sale_price_per_kg?: number;
  sale_total_price?: number;
  status?: string;
}

export interface AnimalService {
  id: number;
  lote_animal_id: number;
  service_type: string;
  service_date: string;
  status: string;
  pregnancy_date: string | null;
  birth_date: string | null;
  total_piglets: number;
  live_piglets: number;
  created_at?: string;
  updated_at?: string;
  animal?: LoteAnimal | null;
}

export interface CreateAnimalServiceDTO {
  service_type: 'inseminación' | 'monta' | 'parto';
  service_date: string;
  status?: 'activo' | 'gestación' | 'destete';
  pregnancy_date?: string;
  birth_date?: string;
  total_piglets?: number;
  live_piglets?: number;
}
