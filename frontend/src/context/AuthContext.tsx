import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Farm, Subordinate, ModuleId } from '../types/auth';
import { authService, type UpdateProfileDTO } from '../services/authService';
import { farmService } from '../services/farmService';
import { setOnSessionExpired, tokenStorage } from '../services/api';
import { SYSTEM_MODULES, normalizeModuleCode, isModuleItemEnabled } from '../config/modules';

export const extractEnabledModules = (rawUser: User, rawModules?: any[]): string[] => {
  if (!rawUser) return [];

  const roleUpper = (rawUser.role || '').toUpperCase();
  if (roleUpper === 'ROOT') {
    return Object.keys(SYSTEM_MODULES);
  }

  // Inspect non-empty module lists across all potential backend response keys
  const candidates = [
    rawModules,
    rawUser.farm_modules,
    rawUser.subordinate_modules,
    rawUser.modules,
    rawUser.enabledModules,
    rawUser.farm && (rawUser.farm as any).modules,
    rawUser.farm && (rawUser.farm as any).farm_modules,
  ];

  let modulesList: any[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      modulesList = candidate;
      break;
    }
  }

  if (modulesList.length > 0) {
    const enabled: string[] = [];

    for (const item of modulesList) {
      if (!isModuleItemEnabled(item)) continue;

      let codeRaw = item;
      if (typeof item === 'object' && item !== null) {
        codeRaw = item.code || item.slug || item.id || item.name || (item.pivot && (item.pivot.module_id || item.pivot.code));
      }

      const code = normalizeModuleCode(codeRaw);
      if (code && code in SYSTEM_MODULES) {
        enabled.push(code);
      }
    }

    if (enabled.length > 0) {
      return Array.from(new Set(enabled));
    }
  }

  // Fallback check if rawUser.enabledModules is already an array of strings/codes
  if (Array.isArray(rawUser.enabledModules) && rawUser.enabledModules.length > 0) {
    return rawUser.enabledModules
      .map((m) => normalizeModuleCode(typeof m === 'string' ? m : (m as any).code || (m as any).id))
      .filter((m): m is ModuleId => m !== null && m in SYSTEM_MODULES);
  }

  return [];
};

const resolveUserEnabledModules = async (u: User, rawModules?: any[]): Promise<string[]> => {
  let enabled = extractEnabledModules(u, rawModules);

  const roleUpper = (u.role || '').toUpperCase();
  const isRoot = roleUpper === 'ROOT';

  if (!isRoot && enabled.length === 0) {
    const farmId =
      u.farm_id ||
      u.farmId ||
      (u.farm && u.farm.id) ||
      tokenStorage.getUser()?.farm_id ||
      tokenStorage.getUser()?.farmId;

    if (farmId) {
      try {
        const rawRes = await farmService.getFarmModules(farmId);
        let rawList: any[] = [];
        if (Array.isArray(rawRes)) rawList = rawRes;
        else if (Array.isArray(rawRes?.data)) rawList = rawRes.data;
        else if (Array.isArray(rawRes?.modules)) rawList = rawRes.modules;
        else if (Array.isArray(rawRes?.farm_modules)) rawList = rawRes.farm_modules;
        else if (rawRes?.data && typeof rawRes.data === 'object') {
          if (Array.isArray(rawRes.data.modules)) rawList = rawRes.data.modules;
          else if (Array.isArray(rawRes.data.farm_modules)) rawList = rawRes.data.farm_modules;
        }

        if (rawList.length > 0) {
          const fetchedMods: string[] = [];
          for (const item of rawList) {
            if (!isModuleItemEnabled(item)) continue;
            let codeRaw = item;
            if (typeof item === 'object' && item !== null) {
              codeRaw =
                item.code ||
                item.slug ||
                item.module_code ||
                item.id ||
                item.module_id ||
                item.name ||
                (item.pivot && (item.pivot.module_id || item.pivot.code || item.pivot.slug));
            }
            const code = normalizeModuleCode(codeRaw);
            if (code && code in SYSTEM_MODULES) {
              fetchedMods.push(code);
            }
          }
          if (fetchedMods.length > 0) {
            enabled = Array.from(new Set(fetchedMods));
          }
        }
      } catch (err) {
        console.warn('Could not fetch farm modules during AuthContext resolve:', err);
      }
    }
  }

  return enabled;
};

interface AuthContextType {
  user: User | null;
  enabledModules: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isDarkMode: boolean;
  farms: Farm[];
  subordinates: Subordinate[];
  activeFarm: Farm | null;
  toggleTheme: () => void;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UpdateProfileDTO) => Promise<User>;
  refreshFarms: () => Promise<void>;
  setActiveFarmId: (farmId: number | string) => void;
  createSubordinate: (subData: any) => void;
  updateSubordinate: (subId: any, updatedData: Partial<Subordinate>) => void;
  updateSubordinateModules: (subId: any, modules: any) => void;
  toggleSubordinateStatus: (subId: any) => void;
  updateEnabledModules: (modules: string[]) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [subordinates, setSubordinates] = useState<Subordinate[]>([]);
  const [activeFarm, setActiveFarm] = useState<Farm | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('agro_theme');
      return savedTheme ? savedTheme === 'dark' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('agro_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('agro_theme', 'light');
    }
  }, [isDarkMode]);

  const updateEnabledModules = (modules: string[]) => {
    const valid = modules
      .map(normalizeModuleCode)
      .filter((m): m is ModuleId => m !== null && m in SYSTEM_MODULES);
    const unique = Array.from(new Set(valid));

    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, enabledModules: unique };
      tokenStorage.setUser(updated);
      return updated;
    });
  };

  const refreshFarms = async () => {
    try {
      if (tokenStorage.getToken()) {
        const farmList = await farmService.getAllFarms();
        setFarms(farmList);
        if (farmList.length > 0 && !activeFarm) {
          setActiveFarm(farmList[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load farms', e);
    }
  };

  useEffect(() => {
    setOnSessionExpired(() => {
      logout();
    });

    const initAuth = async () => {
      setIsLoading(true);
      try {
        if (tokenStorage.getToken()) {
          const cachedUser = tokenStorage.getUser();
          if (cachedUser) {
            setUser(cachedUser);
          }

          const res = await authService.getCurrentUser();
          if (res && res.user) {
            const enabledMods = await resolveUserEnabledModules(res.user, res.modules);
            const fullUser = { ...res.user, enabledModules: enabledMods };
            setUser(fullUser);
            tokenStorage.setUser(fullUser);

            const roleUpper = (res.user.role || '').toUpperCase();
            if (roleUpper === 'ROOT') {
              const farmList = await farmService.getAllFarms();
              setFarms(farmList);
              if (farmList.length > 0) {
                setActiveFarm(farmList[0]);
              }
            }
          } else {
            tokenStorage.clearTokens();
          }
        }
      } catch (e) {
        console.error('Failed to restore session', e);
        tokenStorage.clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const { user: apiUser, modules: apiModules } = await authService.login({ email, password });
      const enabledMods = await resolveUserEnabledModules(apiUser, apiModules);
      const fullUser = { ...apiUser, enabledModules: enabledMods };
      setUser(fullUser);
      tokenStorage.setUser(fullUser);

      const roleUpper = (apiUser.role || '').toUpperCase();
      if (roleUpper === 'ROOT') {
        const farmList = await farmService.getAllFarms();
        setFarms(farmList);
        if (farmList.length > 0) {
          setActiveFarm(farmList[0]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setFarms([]);
    setSubordinates([]);
    setActiveFarm(null);
  };

  const updateProfile = async (data: UpdateProfileDTO): Promise<User> => {
    const updatedUser = await authService.updateProfile(data);
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
    return updatedUser;
  };

  const setActiveFarmId = (farmId: number | string) => {
    const targetFarm = farms.find((f) => String(f.id) === String(farmId));
    if (targetFarm) {
      setActiveFarm(targetFarm);
    }
  };

  const createSubordinate = (subData: any) => {
    const newSub: Subordinate = {
      id: `sub-${Date.now()}`,
      name: subData.name || 'Nuevo Encargado',
      email: subData.email || 'encargado@granja.com',
      password: subData.password || '',
      role: 'ENCARGADO',
      farmId: activeFarm?.id || user?.farm_id || 1,
      assignedModules: subData.assignedModules || [],
      status: 'active',
      lastAccess: 'Nunca',
    };
    setSubordinates((prev) => [...prev, newSub]);
  };

  const updateSubordinate = (subId: any, updatedData: Partial<Subordinate>) => {
    setSubordinates((prev) =>
      prev.map((s) => (String(s.id) === String(subId) ? { ...s, ...updatedData } : s))
    );
  };

  const updateSubordinateModules = (subId: any, modules: any) => {
    setSubordinates((prev) =>
      prev.map((s) => (String(s.id) === String(subId) ? { ...s, assignedModules: modules } : s))
    );
  };

  const toggleSubordinateStatus = (subId: any) => {
    setSubordinates((prev) =>
      prev.map((s) =>
        String(s.id) === String(subId)
          ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' }
          : s
      )
    );
  };

  const enabledModules = user ? (user.enabledModules || extractEnabledModules(user)) : [];

  return (
    <AuthContext.Provider
      value={{
        user,
        enabledModules,
        isAuthenticated: !!user,
        isLoading,
        isDarkMode,
        farms,
        subordinates,
        activeFarm,
        toggleTheme,
        login,
        logout,
        updateProfile,
        refreshFarms,
        setActiveFarmId,
        createSubordinate,
        updateSubordinate,
        updateSubordinateModules,
        toggleSubordinateStatus,
        updateEnabledModules,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
