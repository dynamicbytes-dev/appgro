import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { inventoryService } from '../../services/inventoryService';
import { safeText } from '../../utils/safeText';
import type { InventoryWarehouse } from '../../types/inventory';
import { inputClasses } from './inventoryShared';

interface InventoryWarehousesTabProps {
  isAdmin: boolean;
}

interface WarehouseForm {
  name: string;
  code: string;
  address: string;
  manager_name: string;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM: WarehouseForm = {
  name: '',
  code: '',
  address: '',
  manager_name: '',
  notes: '',
  is_active: true,
};

type ActiveFilter = '' | 'active' | 'inactive';

/**
 * Pestaña «Bodega» del módulo Inventario.
 *
 * Catálogo de bodegas / ubicaciones físicas por granja. Admin/root
 * gestionan (CRUD); el encargado solo consulta.
 */
export const InventoryWarehousesTab: React.FC<InventoryWarehousesTabProps> = ({ isAdmin }) => {
  const { user, activeFarm } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryWarehouse | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<WarehouseForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const farmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await inventoryService.getWarehouses({ farm_id: farmId });
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudieron cargar las bodegas.');
      setWarehouses([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const filtered = useMemo(() => {
    const list = Array.isArray(warehouses) ? warehouses : [];
    const term = searchTerm.trim().toLowerCase();

    return list.filter((warehouse) => {
      if (!warehouse) return false;
      const matchesSearch =
        !term ||
        safeText(warehouse.name, '').toLowerCase().includes(term) ||
        safeText(warehouse.code ?? '', '').toLowerCase().includes(term) ||
        safeText(warehouse.manager_name ?? '', '').toLowerCase().includes(term) ||
        safeText(warehouse.address ?? '', '').toLowerCase().includes(term);

      const matchesActive =
        activeFilter === '' ||
        (activeFilter === 'active' ? warehouse.is_active : !warehouse.is_active);

      return matchesSearch && matchesActive;
    });
  }, [warehouses, searchTerm, activeFilter]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSelected(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (warehouse: InventoryWarehouse) => {
    setForm({
      name: warehouse.name,
      code: warehouse.code ?? '',
      address: warehouse.address ?? '',
      manager_name: warehouse.manager_name ?? '',
      notes: warehouse.notes ?? '',
      is_active: warehouse.is_active,
    });
    setFormErrors({});
    setSelected(warehouse);
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'El nombre de la bodega es obligatorio.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        address: form.address.trim() || null,
        manager_name: form.manager_name.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };

      if (selected) {
        await inventoryService.updateWarehouse(selected.id, payload);
        toastSuccess('Bodega actualizada', 'Los cambios se guardaron correctamente.');
      } else {
        await inventoryService.createWarehouse({ ...payload, farm_id: farmId });
        toastSuccess('Bodega registrada', 'La bodega se agregó al catálogo.');
      }

      setIsFormModalOpen(false);
      await loadWarehouses();
    } catch (error: any) {
      const backendErrors = error?.response?.data?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setFormErrors(mapped);
      }

      toastError('Error', error?.response?.data?.message || 'No se pudo guardar la bodega.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    try {
      await inventoryService.removeWarehouse(selected.id);
      toastSuccess('Bodega eliminada', 'La bodega fue eliminada del catálogo.');
      setIsDeleteModalOpen(false);
      setSelected(null);
      await loadWarehouses();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo eliminar la bodega.');
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de acciones + filtros */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadWarehouses()}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Actualizar
              </Button>
            </div>

            {isAdmin && (
              <Button variant="accent" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
                Nueva Bodega
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, código, responsable o dirección..."
                className={`${inputClasses} pl-9`}
              />
            </div>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className={inputClasses}
            >
              <option value="">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card className="overflow-hidden p-0!">
        {errorMessage ? (
          <div className="m-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : (filtered || []).length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No hay bodegas registradas.</p>
            <p className="text-xs mt-1">
              {isAdmin
                ? 'Crea la primera bodega con el botón «Nueva Bodega».'
                : 'Cuando el administrador registre bodegas aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#263632] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-3 font-bold">Bodega</th>
                  <th className="px-4 py-3 font-bold">Responsable</th>
                  <th className="px-4 py-3 font-bold">Dirección</th>
                  <th className="px-4 py-3 font-bold">Insumos</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  {isAdmin ? <th className="px-4 py-3 font-bold text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {(filtered || []).map((warehouse) => (
                  <tr key={`warehouse-${warehouse.id}`} className="hover:bg-gray-50 dark:hover:bg-[#263632]/40 transition-colors">
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-semibold text-sm text-[#1E1E1E] dark:text-gray-100 truncate">
                        {safeText(warehouse.name, `Bodega #${warehouse.id}`)}
                      </p>
                      {warehouse.code ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Código: {safeText(warehouse.code, '')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">
                      {safeText(warehouse.manager_name ?? '', '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200 max-w-[260px] truncate">
                      {safeText(warehouse.address ?? '', '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">
                      {warehouse.items_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={warehouse.is_active ? 'success' : 'danger'}>
                        {warehouse.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(warehouse)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Editar bodega"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(warehouse);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Eliminar bodega"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selected ? 'Editar Bodega' : 'Nueva Bodega'}
        subtitle={selected ? 'Actualiza los datos de la bodega' : 'Registra una bodega en el catálogo'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Bodega Central"
                className={inputClasses}
              />
              {formErrors.name ? <p className="text-xs text-red-600 mt-1">{formErrors.name}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Código
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ej: BOD-01"
                className={inputClasses}
              />
              {formErrors.code ? <p className="text-xs text-red-600 mt-1">{formErrors.code}</p> : null}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Responsable
            </label>
            <input
              type="text"
              value={form.manager_name}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
              placeholder="Ej: Luis Gómez"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Dirección / Ubicación
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Ej: Sector norte, galpón 3"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observaciones sobre la bodega..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
            />
            Bodega activa
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={() => setIsFormModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={isSaving}
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isSaving ? 'Guardando...' : selected ? 'Guardar Cambios' : 'Crear Bodega'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelected(null);
        }}
        title="Eliminar Bodega"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span>¿Seguro que deseas eliminar la bodega </span>
              <span className="font-semibold">«{safeText(selected?.name, '')}»</span>
              <span>? Los insumos almacenados allí quedarán sin bodega asignada.</span>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelected(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={() => void handleDelete()}>
              Eliminar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryWarehousesTab;
