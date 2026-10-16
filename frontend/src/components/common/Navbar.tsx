import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ProfileModal } from './ProfileModal';
import { NotificationBell } from './NotificationBell';
import { ZootikaLogo } from './ZootikaLogo';
import { safeText } from '../../utils/safeText';
import {
  LogOut,
  Building2,
  ChevronDown,
  Sun,
  Moon,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, isDarkMode, toggleTheme, farms, activeFarm, setActiveFarmId } = useAuth();
  const [showFarmMenu, setShowFarmMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const farmMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isRoot = user?.role === 'root' || user?.role === 'ROOT';

  // Cleanup on route navigation
  useEffect(() => {
    setShowFarmMenu(false);
  }, [location.pathname]);

  // Click outside cleanup listener
  useEffect(() => {
    if (!showFarmMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (farmMenuRef.current && !farmMenuRef.current.contains(event.target as Node)) {
        setShowFarmMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFarmMenu]);

  return (
    <header className="bg-[#1B4D3E] text-white shadow-lg sticky top-0 z-40 border-b border-[#256653]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Official Brand Logo & Name */}
        <ZootikaLogo size="md" showText={true} textVariant="light" />

        {/* Center: Farm Selector for Root */}
        {isRoot && farms && farms.length > 0 && (
          <div ref={farmMenuRef} className="relative hidden md:block">
            <button
              onClick={() => setShowFarmMenu(!showFarmMenu)}
              className="flex items-center space-x-2 bg-[#143A2F] hover:bg-[#0E2C23] text-emerald-100 px-3.5 py-1.5 rounded-lg border border-[#256653] text-sm transition-all"
            >
              <Building2 className="w-4 h-4 text-[#4E9F3D]" />
              <span className="font-medium max-w-[160px] truncate">
                {activeFarm ? safeText(activeFarm.name, 'Granja') : 'Seleccionar Granja'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-300 opacity-70" />
            </button>

            {showFarmMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-[#18221F] rounded-xl shadow-2xl border border-gray-200 dark:border-[#263632] py-2 z-50 text-gray-800 dark:text-gray-100">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                  Granja Seleccionada
                </div>
                {(farms || []).map((f) => (
                  <button
                    key={`nav-farm-${f.id}`}
                    onClick={() => {
                      setActiveFarmId(f.id);
                      setShowFarmMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors ${
                      String(activeFarm?.id) === String(f.id) ? 'bg-emerald-50 dark:bg-emerald-950/60 font-semibold text-[#1B4D3E] dark:text-[#6DBF5C]' : ''
                    }`}
                  >
                    <div>
                      <div className="font-medium">{safeText(f.name, `Granja #${f.id}`)}</div>
                    </div>
                    {!f.is_active ? (
                      <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded">
                        Inactiva
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Activa
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right Controls: Notifications, Role Badge, Theme Toggle, User Profile */}
        <div className="flex items-center space-x-3">

          {/* Notification Bell (bandeja de notificaciones) */}
          <NotificationBell />

          {/* Active Role Badge */}
          <div className="hidden sm:flex items-center px-2.5 py-1 rounded-lg bg-[#143A2F] border border-[#256653] text-xs font-semibold text-[#6DBF5C]">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-300" />
            <span>{isRoot ? '👑 SUPER ROOT' : safeText(user?.role, 'Usuario')}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-[#143A2F] hover:bg-[#0E2C23] border border-[#256653] text-emerald-100 hover:text-white transition-colors"
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-emerald-200" />}
          </button>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-2 border-l border-[#256653] pl-3">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center space-x-2 text-left hover:opacity-80 transition-opacity"
              title="Ver mi perfil de cuenta"
            >
              <div className="w-8 h-8 rounded-full bg-[#143A2F] border border-[#256653] flex items-center justify-center text-emerald-200">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="hidden lg:block">
                <div className="text-xs font-bold text-white truncate max-w-[130px]">
                  {safeText(user?.name, 'Usuario')}
                </div>
                <div className="text-[10px] text-emerald-200 truncate max-w-[130px]">
                  {safeText(user?.email, '')}
                </div>
              </div>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-lg bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-200 transition-colors"
              title="Cerrar Sesión"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </header>
  );
};
