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
