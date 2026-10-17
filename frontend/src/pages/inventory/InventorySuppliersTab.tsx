import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { inventoryService } from '../../services/inventoryService';
import { safeText } from '../../utils/safeText';
import type { InventorySupplier } from '../../types/inventory';
import { inputClasses } from './inventoryShared';

interface InventorySuppliersTabProps {
  isAdmin: boolean;
}

interface SupplierForm {
  name: string;
  tax_id: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM: SupplierForm = {
  name: '',
  tax_id: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  is_active: true,
};

type ActiveFilter = '' | 'active' | 'inactive';

/**
 * Pestaña «Proveedores» del módulo Inventario.
 *
 * Catálogo de proveedores por granja. Admin/root gestionan (CRUD); el
 * encargado solo consulta.
 */
export const InventorySuppliersTab: React.FC<InventorySuppliersTabProps> = ({ isAdmin }) => {
  const { user, activeFarm } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selected, setSelected] = useState<InventorySupplier | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<SupplierForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const farmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const data = await inventoryService.getSuppliers({ farm_id: farmId });
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudieron cargar los proveedores.');
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const filtered = useMemo(() => {
    const list = Array.isArray(suppliers) ? suppliers : [];
    const term = searchTerm.trim().toLowerCase();

    return list.filter((supplier) => {
      if (!supplier) return false;
      const matchesSearch =
        !term ||
        safeText(supplier.name, '').toLowerCase().includes(term) ||
        safeText(supplier.tax_id ?? '', '').toLowerCase().includes(term) ||
        safeText(supplier.contact_name ?? '', '').toLowerCase().includes(term) ||
        safeText(supplier.email ?? '', '').toLowerCase().includes(term);

      const matchesActive =
        activeFilter === '' ||
        (activeFilter === 'active' ? supplier.is_active : !supplier.is_active);

      return matchesSearch && matchesActive;
    });
  }, [suppliers, searchTerm, activeFilter]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSelected(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (supplier: InventorySupplier) => {
    setForm({
      name: supplier.name,
      tax_id: supplier.tax_id ?? '',
      contact_name: supplier.contact_name ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
      is_active: supplier.is_active,
    });
    setFormErrors({});
    setSelected(supplier);
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'El nombre del proveedor es obligatorio.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'El correo no tiene un formato válido.';
    }

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
        tax_id: form.tax_id.trim() || null,
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };

      if (selected) {
        await inventoryService.updateSupplier(selected.id, payload);
        toastSuccess('Proveedor actualizado', 'Los cambios se guardaron correctamente.');
      } else {
        await inventoryService.createSupplier({ ...payload, farm_id: farmId });
        toastSuccess('Proveedor registrado', 'El proveedor se agregó al catálogo.');
      }

      setIsFormModalOpen(false);
      await loadSuppliers();
    } catch (error: any) {
      const backendErrors = error?.response?.data?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setFormErrors(mapped);
      }

      toastError('Error', error?.response?.data?.message || 'No se pudo guardar el proveedor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    try {
      await inventoryService.removeSupplier(selected.id);
      toastSuccess('Proveedor eliminado', 'El proveedor fue eliminado del catálogo.');
      setIsDeleteModalOpen(false);
      setSelected(null);
      await loadSuppliers();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo eliminar el proveedor.');
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
                onClick={() => void loadSuppliers()}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Actualizar
              </Button>
            </div>

            {isAdmin && (
              <Button variant="accent" size="sm" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
                Nuevo Proveedor
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
                placeholder="Buscar por nombre, RUC, contacto o correo..."
                className={`${inputClasses} pl-9`}
              />
            </div>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className={inputClasses}
            >
              <option value="">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
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
            <Truck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No hay proveedores registrados.</p>
            <p className="text-xs mt-1">
              {isAdmin
                ? 'Crea el primer proveedor con el botón «Nuevo Proveedor».'
                : 'Cuando el administrador registre proveedores aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#263632] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-3 font-bold">Proveedor</th>
                  <th className="px-4 py-3 font-bold">Contacto</th>
                  <th className="px-4 py-3 font-bold">Correo</th>
                  <th className="px-4 py-3 font-bold">Dirección</th>
                  <th className="px-4 py-3 font-bold">Insumos</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  {isAdmin ? <th className="px-4 py-3 font-bold text-right">Acciones</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {(filtered || []).map((supplier) => (
                  <tr key={`supplier-${supplier.id}`} className="hover:bg-gray-50 dark:hover:bg-[#263632]/40 transition-colors">
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="font-semibold text-sm text-[#1E1E1E] dark:text-gray-100 truncate">
                        {safeText(supplier.name, `Proveedor #${supplier.id}`)}
                      </p>
                      {supplier.tax_id ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          RUC/ID: {safeText(supplier.tax_id, '')}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 dark:text-gray-200">
                        {safeText(supplier.contact_name ?? '', '—')}
                      </p>
                      {supplier.phone ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{safeText(supplier.phone, '')}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">
                      {safeText(supplier.email ?? '', '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200 max-w-[220px] truncate">
                      {safeText(supplier.address ?? '', '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">
                      {supplier.items_count ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={supplier.is_active ? 'success' : 'danger'}>
                        {supplier.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    {isAdmin ? (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(supplier)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Editar proveedor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(supplier);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Eliminar proveedor"
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
        title={selected ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        subtitle={selected ? 'Actualiza los datos del proveedor' : 'Registra un proveedor en el catálogo'}
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
                placeholder="Ej: Distribuidora del Norte"
                className={inputClasses}
              />
              {formErrors.name ? <p className="text-xs text-red-600 mt-1">{formErrors.name}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                RUC / Identificación
              </label>
              <input
                type="text"
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder="Ej: 1790012345001"
                className={inputClasses}
              />
              {formErrors.tax_id ? <p className="text-xs text-red-600 mt-1">{formErrors.tax_id}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Persona de contacto
              </label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Ej: Ana Pérez"
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Teléfono
              </label>
              <PhoneInput
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ej: 0999999999"
                className={inputClasses}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Ej: ventas@proveedor.com"
                className={inputClasses}
              />
              {formErrors.email ? <p className="text-xs text-red-600 mt-1">{formErrors.email}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ej: Av. Principal 123"
                className={inputClasses}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Notas
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observaciones, condiciones de pago, etc."
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
            Proveedor activo
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
              {isSaving ? 'Guardando...' : selected ? 'Guardar Cambios' : 'Crear Proveedor'}
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
        title="Eliminar Proveedor"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span>¿Seguro que deseas eliminar el proveedor </span>
              <span className="font-semibold">«{safeText(selected?.name, '')}»</span>
              <span>? Los insumos que lo tengan asignado quedarán sin proveedor.</span>
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

export default InventorySuppliersTab;
