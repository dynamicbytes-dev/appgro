import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SYSTEM_MODULES } from '../config/modules';
import {
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Boxes,
  PiggyBank,
  Egg,
  Beef,
  Home,
  PackageCheck,
  TrendingUp,
  Truck,
  BarChart3,
  Users,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PiggyBank,
  Egg,
  Beef,
  Boxes,
  Home,
  PackageCheck,
  TrendingUp,
  Truck,
  BarChart3,
  Users,
};

import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { safeText } from '../utils/safeText';

export const EncargadoDashboard: React.FC = () => {
  const { user, activeFarm } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return <SkeletonLoader type="dashboard" />;
  }

  const assignedModules = user?.enabledModules || [];

  return (
    <div className="space-y-6">
      
      {/* Top Operational Banner */}
      <div className="bg-gradient-to-r from-[#1B4D3E] to-[#143A2F] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-3 border border-blue-400/40">
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Panel Operativo de Campo (Encargado)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hola, {safeText(user?.name, 'Encargado')}
          </h1>
          <p className="text-emerald-100/80 text-sm mt-1 max-w-2xl">
            {safeText(user?.farmName || activeFarm?.name, 'Granja Agropecuaria')} — Tareas de campo, registro de bitácora y monitoreo de lotes asignados por tu Administrador.
          </p>
        </div>

        <div className="bg-[#143A2F] px-4 py-2.5 rounded-2xl border border-[#256653] text-xs text-emerald-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#4E9F3D]" />
          <span>Turno Activo • Hoy 08:00 AM</span>
        </div>
      </div>

      {/* Security Context Banner */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-[#263632] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#4E9F3D] shrink-0" />
          <div>
            <div className="font-bold text-xs text-[#1B4D3E] dark:text-[#6DBF5C]">
              Acceso Restringido por Rol (Encargado)
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">
              Tienes acceso a <span className="font-bold text-[#4E9F3D]">{assignedModules.length} módulos</span> permitidos por tu Administrador. Las funciones de configuración global están inactivas por seguridad.
            </div>
          </div>
        </div>

        <Badge variant="success">Filtro de Seguridad Activo</Badge>
      </div>

      {/* Operational Modules Assigned */}
      <div>
        <h2 className="text-lg font-bold text-[#1E1E1E] dark:text-gray-100 mb-3">
          Módulos Operativos Permitidos
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(assignedModules || []).map((modItem: any, idx) => {
            const modId = typeof modItem === 'string' ? modItem : modItem?.code || modItem?.slug || modItem?.id || String(modItem || '');
            const mod = SYSTEM_MODULES[modId as keyof typeof SYSTEM_MODULES];
            if (!mod) return null;
            const Icon = ICON_MAP[mod.icon] || Boxes;

            return (
              <Card
                key={`encargado-mod-${modId || idx}`}
                className="hover:border-[#4E9F3D] transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="p-3 rounded-xl bg-[#4E9F3D]/10 dark:bg-[#4E9F3D]/20 text-[#4E9F3D] group-hover:bg-[#4E9F3D] group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant="success">Asignado</Badge>
                </div>

                <h3 className="font-bold text-base text-[#1E1E1E] dark:text-gray-100 mt-4 group-hover:text-[#4E9F3D] transition-colors">
                  {safeText(mod.name)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {safeText(mod.description)}
                </p>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#263632] flex items-center justify-between text-xs font-semibold text-[#4E9F3D]">
                  <button
                    onClick={() => navigate(`/modules/${modId}`)}
                    className="flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Registrar Trabajo en Módulo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Daily Routine / Checklists */}
      <Card
        title="Bitácora y Tareas del Día"
        subtitle="Registro diario de eventos en galpones, alimentación y controles sanitarios."
      >
        <div className="space-y-3">
          {[
            {
              id: 'task-1',
              title: 'Verificación de alimento en siloss/galpón A-1',
              time: '08:30 AM',
              status: 'completed',
            },
            {
              id: 'task-2',
              title: 'Inspección de temperatura y humedad en Lote Porcino P-03',
              time: '10:15 AM',
              status: 'completed',
            },
            {
              id: 'task-3',
              title: 'Registro de bajas y vacunación preventiva',
              time: '02:00 PM',
              status: 'pending',
            },
            {
              id: 'task-4',
              title: 'Cierre de ciclo de ventilación nocturna',
              time: '06:00 PM',
              status: 'pending',
            },
          ].map((task) => (
            <div
              key={task.id}
              className="p-3 rounded-xl border border-gray-100 dark:border-[#263632] flex items-center justify-between bg-gray-50/50 dark:bg-[#121816]"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2
                  className={`w-5 h-5 ${
                    task.status === 'completed'
                      ? 'text-[#4E9F3D]'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
                <div>
                  <div className="font-semibold text-xs text-gray-900 dark:text-gray-100">
                    {task.title}
                  </div>
                  <div className="text-[10px] text-gray-500">Hora programada: {task.time}</div>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  task.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {task.status === 'completed' ? 'Completada' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
