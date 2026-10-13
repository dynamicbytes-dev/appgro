import { api } from '../services/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { farmService } from '../services/farmService';
import { adminService } from '../services/adminService';
import type { Farm, User } from '../types/auth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { safeText } from '../utils/safeText';
import {
  Building2,
  Users,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
} from 'lucide-react';

export const RootDashboard: React.FC = () => {
  const { user } = useAuth();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [admins, setAdmins] = useState<User[]>([]);
  const [farmsMetric, setFarmsMetric] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [adminsMetric, setAdminsMetric] = useState<{ total: number; active: number }>({ total: 0, active: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Farm Create Modal
  const [isAddFarmOpen, setIsAddFarmOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const statsRes = await api.get('/root/stats').catch(() => null);
      const statsData = statsRes?.data?.data || statsRes?.data;

      const [farmRes, adminRes] = await Promise.all([
        farmService.getAllFarms().catch((err) => {
          console.error('Error fetching farms for Root:', err);
          return [];
        }),
        adminService.getAllAdmins().catch((err) => {
          console.error('Error fetching admins for Root:', err);
          return [];
        }),
      ]);

      console.log('ESTADÍSTICAS ROOT:', farmRes);
      console.log('ESTADÍSTICAS ROOT (ADMINS):', adminRes);

      // Extract farm list and count metrics
      const farmList: Farm[] = Array.isArray(farmRes)
        ? farmRes
        : Array.isArray(farmRes?.data)
        ? farmRes.data
        : Array.isArray(farmRes?.data?.data)
        ? farmRes.data.data
        : Array.isArray(farmRes?.farms)
        ? farmRes.farms
        : [];

      const totalFarms =
        typeof (farmRes as any)?.total === 'number'
          ? (farmRes as any).total
          : typeof farmRes?.total_farms === 'number'
          ? farmRes.total_farms
          : typeof farmRes?.farmsCount === 'number'
          ? farmRes.farmsCount
          : typeof farmRes?.totalFarms === 'number'
          ? farmRes.totalFarms
          : farmList.length;

      const activeFarms =
        typeof (farmRes as any)?.active_count === 'number'
          ? (farmRes as any).active_count
          : typeof farmRes?.active_farms === 'number'
          ? farmRes.active_farms
          : typeof farmRes?.activeFarms === 'number'
          ? farmRes.activeFarms
          : farmList.filter((f: any) => f && (f.is_active === true || f.is_active === 1 || f.status === 'active')).length;

      // Extract admin list and count metrics
      const adminList: User[] = Array.isArray(adminRes)
        ? adminRes
        : Array.isArray(adminRes?.data)
        ? adminRes.data
        : Array.isArray(adminRes?.data?.data)
        ? adminRes.data.data
        : Array.isArray(adminRes?.admins)
        ? adminRes.admins
        : Array.isArray(adminRes?.users)
        ? adminRes.users
        : [];

      const totalAdmins =
        typeof (adminRes as any)?.total === 'number'
          ? (adminRes as any).total
          : typeof adminRes?.total_admins === 'number'
          ? adminRes.total_admins
          : typeof adminRes?.adminsCount === 'number'
          ? adminRes.adminsCount
          : typeof adminRes?.totalAdmins === 'number'
          ? adminRes.totalAdmins
          : adminList.length;

      const activeAdmins =
        typeof (adminRes as any)?.active_count === 'number'
          ? (adminRes as any).active_count
          : typeof adminRes?.active_admins === 'number'
          ? adminRes.active_admins
          : typeof adminRes?.activeAdmins === 'number'
          ? adminRes.activeAdmins
          : adminList.filter((a: any) => a && (a.is_active === true || a.is_active === 1 || a.status === 'active')).length;

      setFarms(farmList);
      setFarmsMetric({
        total: statsData?.total_farms ?? Math.max(totalFarms, farmList.length),
        active: statsData?.active_farms ?? activeFarms,
      });

      setAdmins(adminList);
      setAdminsMetric({
        total: statsData?.total_admins ?? Math.max(totalAdmins, adminList.length),
        active: statsData?.active_admins ?? activeAdmins,
      });
    } catch (e) {
      console.error('Error loading Root dashboard data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newFarmName.trim()) {
      setErrorMessage('El nombre de la granja es obligatorio.');
      return;
    }

    try {
      await farmService.createFarm({ name: newFarmName.trim(), is_active: true });
      setSuccessMessage('Granja creada exitosamente.');
      setNewFarmName('');
      setIsAddFarmOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Error al crear la granja.');
    }
  };

  if (isLoading && (!farms || farms.length === 0)) {
    return <SkeletonLoader type="dashboard" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1B4D3E] via-[#143A2F] to-[#0B2019] text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden border border-emerald-900/30">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-xs text-emerald-200 font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-[#6DBF5C]" />
            Consola Global de Super Administrador (Root)
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Bienvenido, {safeText(user?.name, 'Administrador Root')}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200/90 mt-1 max-w-2xl">
            Control global de infraestructura agropecuaria multi-granja. Gestiona empresas, dueños y permisos desde PostgreSQL.
          </p>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{safeText(successMessage)}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{safeText(errorMessage)}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <Card className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Granjas Totales</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
                {farmsMetric.total || farms.length}
              </h3>
              <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                {farmsMetric.active} Activas
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-[#4E9F3D]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Administradores</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
                {adminsMetric.total || admins.length}
              </h3>
              <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                {adminsMetric.active} Cuentas Activas
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-[#4E9F3D]">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Módulos del Sistema</p>
              <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">6</h3>
              <p className="text-[11px] text-blue-600 mt-1 font-semibold">Configuración dinámicas farm_modules</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </Card>

      </div>

      {/* Quick Action Button & Table Overview */}
      <div className="flex justify-between items-center bg-white dark:bg-[#18221F] p-4 rounded-2xl border border-gray-200 dark:border-[#263632]">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Resumen de Granjas Registradas
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refrescar
          </Button>
          <Button variant="accent" size="sm" onClick={() => setIsAddFarmOpen(true)} icon={<Plus className="w-4 h-4" />}>
            Nueva Granja
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-500">
            Cargando datos desde PostgreSQL...
          </div>
        ) : farms.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No se han registrado granjas aún. Usa el botón 'Nueva Granja' para agregar una.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#121816] border-b border-gray-200 dark:border-[#263632] text-gray-500 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Granja</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4">Fecha Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {(farms || [])?.map((farm) => (
                  <tr key={farm.id} className="hover:bg-gray-50/50 dark:hover:bg-[#18221F]/50">
                    <td className="py-3 px-4 font-mono font-bold text-gray-500">#{farm.id}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-gray-100">{safeText(farm.name)}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge isActive={farm.is_active} gender="female" />
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {farm.created_at ? new Date(farm.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Quick Create Farm */}
      <Modal
        isOpen={isAddFarmOpen}
        onClose={() => setIsAddFarmOpen(false)}
        title="Registrar Nueva Granja"
        destroyOnClose={true}
      >
        <form onSubmit={handleCreateFarm} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Nombre de la Granja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Granja Agropecuaria La Esperanza"
              value={newFarmName}
              onChange={(e) => setNewFarmName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] rounded-xl text-xs focus:ring-2 focus:ring-[#1B4D3E]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddFarmOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="accent">
              Guardar Granja
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
