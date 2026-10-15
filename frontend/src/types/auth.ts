export type UserRole = "root" | "admin" | "subordinate" | "ROOT" | "ADMIN" | "ENCARGADO";

export type ModuleId = 'especies' | 'galpones' | 'lotes' | 'actividades' | 'analitica' | 'historial';

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
  farm_id?: number | string;
}

export interface UpdateSpeciesDTO {
  name?: string;
  category?: string;
  is_active?: boolean;
}

export interface Barn {
  id: number;
  farm_id: number;
  species_id?: number | null;
  name: string;
  category?: string;
  sector?: string;
  purpose: string;
  max_capacity: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  species?: {
    id: number;
    name: string;
    category?: string;
  } | null;
  farm?: {
    id: number | string;
    name: string;
    code?: string;
  };
  lots?: any[];
}

export type Galpon = Barn;

export interface CreateBarnDTO {
  name: string;
  species_id: number;
  category?: string;
  sector?: string;
  purpose: string;
  max_capacity: number;
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
  is_active?: boolean;
}

/* ------------------------------------------------------------------ */
/* Módulo Lotes                                                        */
/* ------------------------------------------------------------------ */

export interface Lot {
  id: number;
  farm_id: number;
  galpon_id: number | null;
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
  created_at?: string;
  updated_at?: string;
  galpon?: {
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
  galpon_id: number;
  species_id: number;
  quantity: number;
  purpose?: string;
  entry_date?: string;
  farm_id?: number | string;
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
  species_id?: number;
  quantity?: number;
  purpose?: string;
  status?: string;
  entry_date?: string;
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
