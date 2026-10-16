import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Edit2,
  Eye,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import {
  INVENTORY_ALERT_LABELS,
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_LABELS,
  INVENTORY_UNIT_LABELS,
  INVENTORY_UNITS,
  DEFAULT_INVENTORY_UNIT,
  type InventoryAlertFlag,
  type InventoryItem,
  type InventoryStats,
  type InventorySupplier,
  type InventoryWarehouse,
} from '../../types/inventory';
import {
  ALERT_BADGE_VARIANT,
  formatDate,
  formatMoney,
  formatQty,
  formatQtyWithUnit,
  inputClasses,
  toNumber,
  unitShortOf,
} from './inventoryShared';
import { InventoryMovementModal } from './InventoryMovementModal';

interface InventoryItemsTabProps {
  isAdmin: boolean;
}

interface ItemForm {
  name: string;
  category: string;
  unit: string;
  min_stock: string;
  max_stock: string;
  batch_number: string;
  manufacturing_date: string;
  expiration_date: string;
  warehouse_id: string;
  unit_cost: string;
  supplier_id: string;
  last_purchase_date: string;
  current_stock: string;
}

const EMPTY_FORM: ItemForm = {
  name: '',
  category: INVENTORY_CATEGORIES[0].value,
  unit: DEFAULT_INVENTORY_UNIT,
  min_stock: '',
  max_stock: '',
  batch_number: '',
  manufacturing_date: '',
  expiration_date: '',
  warehouse_id: '',
  unit_cost: '',
  supplier_id: '',
  last_purchase_date: '',
  current_stock: '',
};

type AlertFilter = '' | 'low_stock' | 'over_stock' | 'expiring' | 'expired';

const ALERT_FLAG_BY_FILTER: Record<Exclude<AlertFilter, ''>, InventoryAlertFlag> = {
  low_stock: 'bajo_minimo',
  over_stock: 'sobre_stock',
  expiring: 'por_vencer',
  expired: 'vencido',
};

export const InventoryItemsTab: React.FC<InventoryItemsTabProps> = ({ isAdmin }) => {
  const { user, activeFarm } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('');

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [supplierOptions, setSupplierOptions] = useState<InventorySupplier[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<InventoryWarehouse[]>([]);

  const farmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = isAdmin
        ? await inventoryService.getAll({ farm_id: farmId })
        : await inventoryService.getMy();

      setItems(Array.isArray(result.data) ? result.data : []);
      setStats(result.stats ?? null);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || 'No se pudo cargar el inventario.');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, farmId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Catálogos de proveedores y bodegas para los desplegables del formulario.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [suppliers, warehouses] = await Promise.all([
          inventoryService.getSuppliers({ farm_id: farmId }),
          inventoryService.getWarehouses({ farm_id: farmId }),
        ]);

        if (!cancelled) {
          setSupplierOptions(Array.isArray(suppliers) ? suppliers : []);
          setWarehouseOptions(Array.isArray(warehouses) ? warehouses : []);
        }
      } catch {
        // Catálogos opcionales: si fallan, el insumo se guarda sin ellos.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const term = searchTerm.trim().toLowerCase();

    return list.filter((item) => {
      if (!item) return false;
      const matchesSearch =
        !term ||
        safeText(item.name, '').toLowerCase().includes(term) ||
        safeText(item.code, '').toLowerCase().includes(term) ||
        safeText(item.batch_number ?? '', '').toLowerCase().includes(term) ||
        safeText(item.supplier ?? '', '').toLowerCase().includes(term) ||
        safeText(item.location ?? '', '').toLowerCase().includes(term);

      const matchesCategory = !categoryFilter || item.category === categoryFilter;

      const matchesAlert =
        !alertFilter || (item.alert_flags ?? []).includes(ALERT_FLAG_BY_FILTER[alertFilter]);

      return matchesSearch && matchesCategory && matchesAlert;
    });
  }, [items, searchTerm, categoryFilter, alertFilter]);

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setSelectedItem(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setForm({
      name: item.name,
      category: String(item.category),
      unit: item.unit || DEFAULT_INVENTORY_UNIT,
      min_stock: formatQty(item.min_stock),
      max_stock: item.max_stock === null || item.max_stock === undefined ? '' : formatQty(item.max_stock),
      batch_number: item.batch_number ?? '',
      manufacturing_date: item.manufacturing_date ? item.manufacturing_date.split('T')[0] : '',
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
      warehouse_id: item.warehouse_id ? String(item.warehouse_id) : '',
      unit_cost: formatQty(item.unit_cost),
      supplier_id: item.supplier_id ? String(item.supplier_id) : '',
      last_purchase_date: item.last_purchase_date ? item.last_purchase_date.split('T')[0] : '',
      current_stock: '',
    });
    setFormErrors({});
    setSelectedItem(item);
    setIsFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = 'El nombre es obligatorio.';
    if (!form.category) errors.category = 'La categoría es obligatoria.';
    if (!form.unit) errors.unit = 'La unidad de medida es obligatoria.';
    if (form.min_stock === '' || Number.isNaN(Number(form.min_stock))) {
      errors.min_stock = 'El stock mínimo es obligatorio.';
    } else if (toNumber(form.min_stock) < 0) {
      errors.min_stock = 'El stock mínimo no puede ser negativo.';
    }
    if (form.max_stock !== '' && !Number.isNaN(Number(form.max_stock))) {
      if (toNumber(form.max_stock) < toNumber(form.min_stock)) {
        errors.max_stock = 'El stock máximo debe ser mayor o igual al mínimo.';
      }
    }
    if (form.unit_cost === '' || Number.isNaN(Number(form.unit_cost))) {
      errors.unit_cost = 'El costo unitario es obligatorio.';
    } else if (toNumber(form.unit_cost) < 0) {
      errors.unit_cost = 'El costo unitario no puede ser negativo.';
    }
    if (form.current_stock !== '' && toNumber(form.current_stock) < 0) {
      errors.current_stock = 'El stock inicial no puede ser negativo.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const basePayload = {
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        min_stock: toNumber(form.min_stock),
        max_stock: form.max_stock === '' ? null : toNumber(form.max_stock),
        batch_number: form.batch_number.trim() || null,
        manufacturing_date: form.manufacturing_date || null,
        expiration_date: form.expiration_date || null,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : null,
        unit_cost: toNumber(form.unit_cost),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        last_purchase_date: form.last_purchase_date || null,
      };

      if (selectedItem) {
        await inventoryService.update(selectedItem.id, basePayload);
        toastSuccess('Insumo actualizado', 'Los cambios se guardaron correctamente.');
      } else {
        await inventoryService.create({
          ...basePayload,
          current_stock: form.current_stock === '' ? 0 : toNumber(form.current_stock),
          farm_id: isAdmin ? farmId : undefined,
        });
        toastSuccess('Insumo registrado', 'El insumo se agregó al inventario con su código único.');
      }

      setIsFormModalOpen(false);
      await loadItems();
    } catch (error: any) {
      const payload = error?.response?.data;
      const backendErrors = payload?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setFormErrors(mapped);
      }

      toastError('Error', payload?.message || 'No se pudo guardar el insumo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await inventoryService.remove(selectedItem.id);
      toastSuccess('Insumo eliminado', 'El insumo y sus movimientos fueron eliminados.');
      setIsDeleteModalOpen(false);
      setSelectedItem(null);
      await loadItems();
    } catch (error: any) {
      toastError('Error', error?.response?.data?.message || 'No se pudo eliminar el insumo.');
      setIsDeleteModalOpen(false);
    }
  };

  const summaryCards = [
    { id: 'total-items', label: 'Insumos', value: stats?.total_items ?? (items || []).length, icon: Package, color: 'text-[#1B4D3E] dark:text-[#6DBF5C]', bg: 'bg-[#1B4D3E]/10' },
    { id: 'total-value', label: 'Valor total', value: formatMoney(stats?.total_value ?? 0), icon: PackagePlus, color: 'text-[#4E9F3D]', bg: 'bg-[#4E9F3D]/10' },
    { id: 'low-stock', label: 'Bajo mínimo', value: stats?.low_stock ?? 0, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    { id: 'expiring-soon', label: 'Por vencer', value: stats?.expiring ?? 0, icon: CalendarClock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(summaryCards || []).map((card) => (
          <Card key={card.id} className="p-4!">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-extrabold text-[#1E1E1E] dark:text-gray-100 truncate">{card.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {card.label}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Barra de acciones + filtros */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadItems()}
                icon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Actualizar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsMovementModalOpen(true)}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Registrar movimiento
              </Button>
            </div>

            {isAdmin ? (
              <Button variant="accent" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
                Nuevo Insumo
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, código, lote o proveedor..."
                className={`${inputClasses} pl-9`}
              />
            </div>

            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputClasses}>
              <option value="">Todas las categorías</option>
              {(INVENTORY_CATEGORIES || []).map((category) => (
                <option key={`cat-${category.value}`} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>

            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value as AlertFilter)}
              className={inputClasses}
            >
              <option value="">Todas las alertas</option>
              <option value="low_stock">Bajo mínimo</option>
              <option value="over_stock">Sobre stock</option>
              <option value="expiring">Por vencer</option>
              <option value="expired">Vencidos</option>
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
        ) : (filteredItems || []).length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-gray-500">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold">No hay insumos registrados.</p>
            <p className="text-xs mt-1">
              {isAdmin
                ? 'Crea el primer insumo con el botón «Nuevo Insumo».'
                : 'Cuando el administrador registre insumos aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#263632] text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-3 font-bold">Insumo</th>
                  <th className="px-4 py-3 font-bold">Categoría</th>
                  <th className="px-4 py-3 font-bold">Stock</th>
                  <th className="px-4 py-3 font-bold">Lote / Vence</th>
                  <th className="px-4 py-3 font-bold">Costos</th>
                  <th className="px-4 py-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#263632]">
                {(filteredItems || []).map((item) => {
                  const alerts = Array.isArray(item?.alert_flags) ? item.alert_flags : [];
                  const itemId = item.id ? String(item.id) : `item-fallback-${item.code || item.name}`;

                  return (
                    <tr key={itemId} className="hover:bg-gray-50 dark:hover:bg-[#263632]/40 transition-colors">
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#1B4D3E] dark:text-[#6DBF5C]">
                            {safeText(item.code, '')}
                          </span>
                          {alerts.map((flag, flagIdx) => (
                            <Badge
                              key={`${itemId}-flag-${flag}-${flagIdx}`}
                              variant={ALERT_BADGE_VARIANT[flag] ?? 'warning'}
                              className="text-[10px]!"
                            >
                              {INVENTORY_ALERT_LABELS[flag] ?? flag}
                            </Badge>
                          ))}
                        </div>
                        <p className="font-semibold text-sm text-[#1E1E1E] dark:text-gray-100 truncate mt-0.5">
                          {safeText(item.name, `Insumo #${item.id}`)}
                        </p>
                        {item.location ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{safeText(item.location, '')}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-700 dark:text-gray-200">
                          {safeText(item.category_label ?? INVENTORY_CATEGORY_LABELS[item.category], item.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-[#1E1E1E] dark:text-gray-100">
                          {formatQtyWithUnit(item.current_stock, item.unit)}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          <span>Mín: {formatQtyWithUnit(item.min_stock, item.unit)}</span>
                          {item.max_stock !== null && item.max_stock !== undefined ? (
                            <span>{` · Máx: ${formatQtyWithUnit(item.max_stock, item.unit)}`}</span>
                          ) : null}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700 dark:text-gray-200">{safeText(item.batch_number ?? '', '—')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{formatDate(item.expiration_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-700 dark:text-gray-200">Unit: {formatMoney(item.unit_cost)}</p>
                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          Total: {formatMoney(item.total_cost)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#1B4D3E] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsMovementModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-[#4E9F3D] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            title="Registrar movimiento"
                          >
                            <PackagePlus className="w-4 h-4" />
                          </button>

                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                                title="Editar insumo"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                title="Eliminar insumo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Crear / Editar */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={selectedItem ? 'Editar Insumo' : 'Nuevo Insumo'}
        subtitle={
          selectedItem
            ? `Código ${safeText(selectedItem.code, '')} · el stock se ajusta con movimientos`
            : 'El código se genera automáticamente'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Balanceado de crecimiento"
                className={inputClasses}
              />
              {formErrors.name ? <p className="text-xs text-red-600 mt-1">{formErrors.name}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Categoría *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClasses}
              >
                {(INVENTORY_CATEGORIES || []).map((category) => (
                  <option key={`form-cat-${category.value}`} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {formErrors.category ? <p className="text-xs text-red-600 mt-1">{formErrors.category}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Unidad de medida *
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className={inputClasses}
              >
                {(INVENTORY_UNITS || []).map((unit) => (
                  <option key={`form-unit-${unit.value}`} value={unit.value}>
                    {unit.label} ({unit.short})
                  </option>
                ))}
              </select>
              {formErrors.unit ? <p className="text-xs text-red-600 mt-1">{formErrors.unit}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Stock mínimo ({unitShortOf(form.unit)}) *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                placeholder="Ej: 10"
                className={inputClasses}
              />
              {formErrors.min_stock ? <p className="text-xs text-red-600 mt-1">{formErrors.min_stock}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Stock máximo ({unitShortOf(form.unit)})
              </label>
              <input
                type="number"
                step="0.01"
                value={form.max_stock}
                onChange={(e) => setForm({ ...form, max_stock: e.target.value })}
                placeholder="Ej: 500"
                className={inputClasses}
              />
              {formErrors.max_stock ? <p className="text-xs text-red-600 mt-1">{formErrors.max_stock}</p> : null}
            </div>

            {!selectedItem ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Stock inicial ({unitShortOf(form.unit)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.current_stock}
                  onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                  placeholder="Ej: 100"
                  className={inputClasses}
                />
                {formErrors.current_stock ? <p className="text-xs text-red-600 mt-1">{formErrors.current_stock}</p> : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Número de lote
              </label>
              <input
                type="text"
                value={form.batch_number}
                onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                placeholder="Ej: L-2026-001"
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Bodega / Ubicación
              </label>
              <select
                value={form.warehouse_id}
                onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}
                className={inputClasses}
              >
                <option value="">Sin bodega asignada</option>
                {(warehouseOptions || []).map((warehouse) => (
                  <option key={`form-wh-${warehouse.id}`} value={warehouse.id}>
                    {safeText(warehouse.name, `Bodega #${warehouse.id}`)}
                    {warehouse.is_active ? '' : ' (inactiva)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Fecha de fabricación
              </label>
              <input
                type="date"
                value={form.manufacturing_date}
                onChange={(e) => setForm({ ...form, manufacturing_date: e.target.value })}
                className={inputClasses}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={form.expiration_date}
                onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
                className={inputClasses}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Costo unitario *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
                placeholder="Ej: 2.50"
                className={inputClasses}
              />
              {formErrors.unit_cost ? <p className="text-xs text-red-600 mt-1">{formErrors.unit_cost}</p> : null}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Proveedor principal
              </label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className={inputClasses}
              >
                <option value="">Sin proveedor</option>
                {(supplierOptions || []).map((supplier) => (
                  <option key={`form-sup-${supplier.id}`} value={supplier.id}>
                    {safeText(supplier.name, `Proveedor #${supplier.id}`)}
                    {supplier.is_active ? '' : ' (inactivo)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Última fecha de compra
              </label>
              <input
                type="date"
                value={form.last_purchase_date}
                onChange={(e) => setForm({ ...form, last_purchase_date: e.target.value })}
                className={inputClasses}
              />
            </div>
          </div>

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
              {isSaving ? 'Guardando...' : selectedItem ? 'Guardar Cambios' : 'Crear Insumo'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalle */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedItem(null);
        }}
        title="Detalle del Insumo"
        subtitle={selectedItem ? `${safeText(selectedItem.code, '')} · ${safeText(selectedItem.name, '')}` : undefined}
        maxWidth="lg"
      >
        {selectedItem ? (
          <div className="space-y-4">
            {(selectedItem.alert_flags ?? []).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(selectedItem.alert_flags ?? []).map((flag, flagIdx) => (
                  <Badge key={`${selectedItem.id}-detail-flag-${flag}-${flagIdx}`} variant={ALERT_BADGE_VARIANT[flag] ?? 'warning'}>
                    {INVENTORY_ALERT_LABELS[flag] ?? flag}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Stock actual" value={formatQtyWithUnit(selectedItem.current_stock, selectedItem.unit)} />
              <Field label="Stock mínimo" value={formatQtyWithUnit(selectedItem.min_stock, selectedItem.unit)} />
              <Field
                label="Stock máximo"
                value={
                  selectedItem.max_stock === null || selectedItem.max_stock === undefined
                    ? '—'
                    : formatQtyWithUnit(selectedItem.max_stock, selectedItem.unit)
                }
              />
              <Field label="Costo unitario" value={formatMoney(selectedItem.unit_cost)} />
              <Field label="Costo total del lote" value={formatMoney(selectedItem.total_cost)} />
              <Field label="Categoría" value={safeText(selectedItem.category_label ?? INVENTORY_CATEGORY_LABELS[selectedItem.category], '—')} />
              <Field
                label="Unidad de medida"
                value={safeText(selectedItem.unit_label ?? INVENTORY_UNIT_LABELS[selectedItem.unit], '—')}
              />
              <Field label="Número de lote" value={safeText(selectedItem.batch_number ?? '', '—')} />
              <Field label="Ubicación" value={safeText(selectedItem.location ?? '', '—')} />
              <Field label="Proveedor" value={safeText(selectedItem.supplier ?? '', '—')} />
              <Field label="Fabricación" value={formatDate(selectedItem.manufacturing_date)} />
              <Field label="Vencimiento" value={formatDate(selectedItem.expiration_date)} />
              <Field label="Última compra" value={formatDate(selectedItem.last_purchase_date)} />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Modal Eliminar */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedItem(null);
        }}
        title="Eliminar Insumo"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span>¿Seguro que deseas eliminar el insumo </span>
              <span className="font-semibold">«{safeText(selectedItem?.name, '')}»</span>
              <span>? También se eliminarán sus movimientos asociados.</span>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedItem(null);
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

      {/* Modal Movimiento */}
      <InventoryMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => {
          setIsMovementModalOpen(false);
          setSelectedItem((prev) => (prev && !isDetailModalOpen ? null : prev));
        }}
        items={items}
        presetItemId={selectedItem?.id ?? null}
        onSaved={() => void loadItems()}
      />
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
    <p className="text-sm text-gray-700 dark:text-gray-200 break-words">{value}</p>
  </div>
);

export default InventoryItemsTab;
