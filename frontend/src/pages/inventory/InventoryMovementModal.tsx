import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Building2, Loader2, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { NumberInput } from '../../components/ui/NumberInput';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventoryService';
import { lotService } from '../../services/lotService';
import { safeText } from '../../utils/safeText';
import {
  INVENTORY_MOVEMENT_TYPES,
  type InventoryItem,
  type InventoryLot,
  type InventoryMovementType,
} from '../../types/inventory';
import { formatQtyWithUnit, inputClasses, toNumber, unitShortOf } from './inventoryShared';

interface LotOption {
  id: number;
  code: string;
}

interface InventoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  presetItemId?: number | null;
  onSaved: () => void;
}

const TYPE_ICON: Record<InventoryMovementType, React.ReactNode> = {
  entrada: <ArrowDownCircle className="w-4 h-4" />,
  salida: <ArrowUpCircle className="w-4 h-4" />,
  ajuste: <SlidersHorizontal className="w-4 h-4" />,
};

/** Orden estable por id para evitar reordenamientos del DOM. */
const sortById = <T extends { id: number }>(list: T[]): T[] =>
  [...list].sort((a, b) => Number(a.id) - Number(b.id));

/** Formatea una fecha ISO a dd/mm/aaaa sin depender del locale. */
const formatLotDate = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

const supplyLotLabel = (lot: InventoryLot): string => {
  const code = safeText(lot.code, `Lote #${lot.id}`);
  const expiry = formatLotDate(lot.expiration_date);
  return expiry ? `${code} · vence ${expiry}` : code;
};

/**
 * Formulario reutilizable para registrar un movimiento de inventario
 * (entrada / salida / ajuste). Lo usan tanto la pestaña de Insumos
 * (acción rápida por fila) como la pestaña de Movimientos.
 *
 *  - Entrada → lote de insumo (catálogo propio de Inventario, con opción de
 *    crear uno nuevo en el momento).
 *  - Salida  → lote de animales como destino de consumo.
 *  - Ajuste  → sin lote.
 */
export const InventoryMovementModal: React.FC<InventoryMovementModalProps> = ({
  isOpen,
  onClose,
  items,
  presetItemId,
  onSaved,
}) => {
  const { toastSuccess, toastError } = useToast();
  const { user, activeFarm } = useAuth();

  const farmId = (activeFarm?.id as number) || (user?.farm_id as number) || undefined;

  const [type, setType] = useState<InventoryMovementType>('entrada');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [destinationLotId, setDestinationLotId] = useState('');
  const [inventoryLotId, setInventoryLotId] = useState('');
  const [notes, setNotes] = useState('');
  const [animalLots, setAnimalLots] = useState<LotOption[]>([]);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [supplyLots, setSupplyLots] = useState<InventoryLot[]>([]);
  const [isLoadingSupplyLots, setIsLoadingSupplyLots] = useState(false);
  const [isCreatingLot, setIsCreatingLot] = useState(false);
  const [newLotCode, setNewLotCode] = useState('');
  const [newLotExpiration, setNewLotExpiration] = useState('');
  const [isSavingLot, setIsSavingLot] = useState(false);
  const [lotErrors, setLotErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset al abrir
  useEffect(() => {
    if (!isOpen) return;
    setType('entrada');
    setItemId(presetItemId ? String(presetItemId) : '');
    setQuantity('');
    setDestinationLotId('');
    setInventoryLotId('');
    setNotes('');
    setIsCreatingLot(false);
    setNewLotCode('');
    setNewLotExpiration('');
    setLotErrors({});
    setErrors({});
  }, [isOpen, presetItemId]);

  // Lotes de insumo (catálogo propio de Inventario): necesarios para la entrada.
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingSupplyLots(true);

    inventoryService
      .getLots({ farm_id: farmId })
      .then((list) => {
        if (!active) return;
        setSupplyLots(Array.isArray(list) ? sortById(list) : []);
      })
      .catch(() => {
        if (active) setSupplyLots([]);
      })
      .finally(() => {
        if (active) setIsLoadingSupplyLots(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, farmId]);

  // Lotes de animales: solo se consultan cuando el movimiento es una salida,
  // para no depender de catálogos ajenos al inventario en las entradas.
  useEffect(() => {
    if (!isOpen || type !== 'salida') return;

    let active = true;
    setIsLoadingLots(true);

    lotService
      .getAll()
      .then((response) => {
        if (!active) return;
        const list = (response?.data ?? [])
          .map((lot: any) => ({ id: Number(lot.id), code: String(lot.code ?? `Lote #${lot.id}`) }))
          .filter((lot: LotOption) => !Number.isNaN(lot.id));
        setAnimalLots(sortById(list));
      })
      .catch(() => {
        if (active) setAnimalLots([]);
      })
      .finally(() => {
        if (active) setIsLoadingLots(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, type]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === itemId) ?? null,
    [items, itemId]
  );

  /**
   * Lotes de insumo elegibles: los del insumo seleccionado más los que aún
   * no tienen insumo asignado (se asignan al usarse).
   */
  const supplyLotOptions = useMemo(() => {
    const list = Array.isArray(supplyLots) ? supplyLots : [];
    const filtered = selectedItem
      ? list.filter(
          (lot) =>
            lot.inventory_item_id === null ||
            Number(lot.inventory_item_id) === Number(selectedItem.id)
        )
      : list;

    return sortById(filtered);
  }, [supplyLots, selectedItem]);

  const quantityNumber = toNumber(quantity);

  const projectedStock = useMemo(() => {
    if (!selectedItem) return null;
    const current = toNumber(selectedItem.current_stock);
    if (type === 'entrada') return current + Math.abs(quantityNumber);
    if (type === 'salida') return current - Math.abs(quantityNumber);
    return current + quantityNumber;
  }, [selectedItem, type, quantityNumber]);

  const lotFieldLabel =
    type === 'entrada'
      ? 'Lote de insumo (opcional)'
      : type === 'salida'
        ? 'Lote de destino (opcional)'
        : 'Lote';

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!itemId) nextErrors.inventory_item_id = 'Selecciona el insumo.';
    if (quantity === '' || Number.isNaN(Number(quantity))) {
      nextErrors.quantity = 'Ingresa una cantidad válida.';
    } else if (type === 'entrada' || type === 'salida') {
      if (quantityNumber <= 0) nextErrors.quantity = 'La cantidad debe ser mayor que cero.';
    } else if (type === 'ajuste' && quantityNumber === 0) {
      nextErrors.quantity = 'El ajuste debe ser distinto de cero (puede ser negativo).';
    }

    if (!nextErrors.quantity && projectedStock !== null && projectedStock < 0) {
      nextErrors.quantity = 'Stock insuficiente para este movimiento.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const cancelNewLot = () => {
    setIsCreatingLot(false);
    setNewLotCode('');
    setNewLotExpiration('');
    setLotErrors({});
  };

  const handleCreateLot = async () => {
    setIsSavingLot(true);
    setLotErrors({});

    try {
      const lot = await inventoryService.createLot({
        code: newLotCode.trim() || null,
        inventory_item_id: selectedItem ? Number(selectedItem.id) : null,
        expiration_date: newLotExpiration || null,
        farm_id: farmId,
      });

      setSupplyLots((prev) => sortById([lot, ...(Array.isArray(prev) ? prev : [])]));
      setInventoryLotId(String(lot.id));
      setIsCreatingLot(false);
      setNewLotCode('');
      setNewLotExpiration('');
      toastSuccess('Lote registrado', `Lote ${safeText(lot.code, '')} creado y seleccionado.`);
    } catch (error: any) {
      const payload = error?.response?.data;
      const backendErrors = payload?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setLotErrors(mapped);
      }

      toastError('Error', payload?.message || 'No se pudo registrar el lote.');
    } finally {
      setIsSavingLot(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      await inventoryService.createMovement({
        inventory_item_id: Number(itemId),
        type,
        quantity: Number(quantity),
        destination_lot_id: type === 'salida' && destinationLotId ? Number(destinationLotId) : null,
        inventory_lot_id: type === 'entrada' && inventoryLotId ? Number(inventoryLotId) : null,
        notes: notes.trim() || null,
      });

      toastSuccess('Movimiento registrado', 'El stock del insumo fue actualizado.');
      onSaved();
      onClose();
    } catch (error: any) {
      const payload = error?.response?.data;
      const backendErrors = payload?.errors;

      if (backendErrors && typeof backendErrors === 'object') {
        const mapped: Record<string, string> = {};
        Object.entries(backendErrors).forEach(([field, messages]) => {
          mapped[field] = Array.isArray(messages) ? String(messages[0]) : String(messages);
        });
        setErrors(mapped);
      }

      toastError('Error', payload?.message || 'No se pudo registrar el movimiento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar movimiento"
      subtitle="Entradas, salidas y ajustes de stock"
      maxWidth="md"
    >
      <div translate="no" className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4" translate="no">
          {/* Tipo */}
          <div key="field-type">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              <span>Tipo de movimiento *</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(INVENTORY_MOVEMENT_TYPES || []).map((option) => (
                <button
                  key={`mov-modal-type-${option.value}`}
                  type="button"
                  onClick={() => setType(option.value)}
                  title={option.hint}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    type === option.value
                      ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                      : 'bg-white dark:bg-[#18221F] text-gray-600 dark:text-gray-300 border-gray-300 dark:border-[#263632] hover:bg-gray-50 dark:hover:bg-[#263632]'
                  }`}
                >
                  {TYPE_ICON[option.value]}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              <span>{INVENTORY_MOVEMENT_TYPES.find((o) => o.value === type)?.hint ?? ''}</span>
            </p>
          </div>

          {/* Insumo */}
          <div key="field-item">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              <span>Insumo *</span>
            </label>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                // El lote de insumo elegido puede no aplicar al nuevo insumo.
                setInventoryLotId('');
              }}
              className={inputClasses}
            >
              <option key="default-item-opt" value="">
                Seleccionar insumo...
              </option>
              {(items || []).map((item) => {
                const farmTag = item.farm?.name || item.farm_name ? ` [${item.farm?.name || item.farm_name}]` : '';
                return (
                  <option key={`mov-modal-item-${item.id}`} value={item.id}>
                    {safeText(item.code, '')} · {safeText(item.name, `Insumo #${item.id}`)}{farmTag} (stock:{' '}
                    {formatQtyWithUnit(item.current_stock, item.unit)})
                  </option>
                );
              })}
            </select>
            {selectedItem && (selectedItem.farm?.name || selectedItem.farm_name) ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Granja: <strong className="font-bold">{selectedItem.farm?.name || selectedItem.farm_name}</strong>
                </span>
              </div>
            ) : null}
            {errors.inventory_item_id ? (
              <p key="err-inventory-item-id" className="text-xs text-red-600 mt-1">
                {errors.inventory_item_id}
              </p>
            ) : null}
          </div>

          <div key="field-row-quantity-lot" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cantidad */}
            <div key="field-quantity">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                <span>Cantidad </span>
                <span>{type === 'ajuste' ? '(con signo)' : 'movilizada'}</span>
                <span>{selectedItem ? ` (${unitShortOf(selectedItem.unit)})` : ''}</span>
                <span> *</span>
              </label>
              <NumberInput
                step="0.01"
                allowNegative={type === 'ajuste'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={type === 'ajuste' ? 'Ej: -5 o 3' : 'Ej: 25'}
                className={inputClasses}
              />
              {errors.quantity ? (
                <p key="err-quantity" className="text-xs text-red-600 mt-1">
                  {errors.quantity}
                </p>
              ) : null}
            </div>

            {/* Lote (depende del tipo de movimiento) */}
            <div key="field-lot">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                <span>{lotFieldLabel}</span>
              </label>

              {/* Lote de insumo — solo entrada */}
              <select
                key="mov-modal-supply-lot"
                value={inventoryLotId}
                onChange={(e) => setInventoryLotId(e.target.value)}
                disabled={type !== 'entrada' || isLoadingSupplyLots}
                className={`${inputClasses} disabled:opacity-60 ${type === 'entrada' ? '' : 'hidden'}`}
              >
                <option key="default-supply-lot-opt" value="">
                  {isLoadingSupplyLots
                    ? 'Cargando lotes...'
                    : supplyLotOptions.length === 0
                      ? 'Sin lotes de insumo registrados'
                      : 'Sin lote asignado'}
                </option>
                {(supplyLotOptions || []).map((lot) => (
                  <option key={`mov-modal-supply-lot-${lot.id}`} value={lot.id}>
                    {supplyLotLabel(lot)}
                  </option>
                ))}
              </select>

              {/* Lote de destino (animales) — solo salida */}
              <select
                key="mov-modal-destination-lot"
                value={destinationLotId}
                onChange={(e) => setDestinationLotId(e.target.value)}
                disabled={type !== 'salida' || isLoadingLots || (animalLots || []).length === 0}
                className={`${inputClasses} disabled:opacity-60 ${type === 'salida' ? '' : 'hidden'}`}
              >
                <option key="default-lot-opt" value="">
                  {isLoadingLots
                    ? 'Cargando lotes...'
                    : (animalLots || []).length === 0
                      ? 'Sin lotes disponibles'
                      : 'Sin lote específico'}
                </option>
                {(animalLots || []).map((lot) => (
                  <option key={`mov-modal-animal-lot-${lot.id}`} value={lot.id}>
                    {safeText(lot.code, `Lote #${lot.id}`)}
                  </option>
                ))}
              </select>

              {/* Aviso de ajuste */}
              <p
                className={`text-[11px] text-gray-400 dark:text-gray-500 ${
                  type === 'ajuste' ? '' : 'hidden'
                }`}
              >
                El ajuste por conteo físico no requiere lote.
              </p>

              {/* Acción: crear un lote de insumo nuevo */}
              <button
                type="button"
                onClick={() => setIsCreatingLot(true)}
                className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#1B4D3E] dark:text-[#6DBF5C] hover:underline ${
                  type === 'entrada' && !isCreatingLot ? '' : 'hidden'
                }`}
              >
                <Plus className="w-3 h-3" />
                <span>Nuevo lote de insumo</span>
              </button>

              {/* Mini-formulario de nuevo lote (siempre montado) */}
              <div
                className={`mt-2 space-y-2 rounded-xl border border-gray-200 dark:border-[#263632] bg-gray-50 dark:bg-[#121816] p-2.5 ${
                  type === 'entrada' && isCreatingLot ? '' : 'hidden'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newLotCode}
                    onChange={(e) => setNewLotCode(e.target.value)}
                    placeholder="Código (automático)"
                    className={inputClasses}
                  />
                  <input
                    type="date"
                    value={newLotExpiration}
                    onChange={(e) => setNewLotExpiration(e.target.value)}
                    title="Fecha de vencimiento"
                    className={inputClasses}
                  />
                </div>
                {lotErrors.code ? (
                  <p key="err-new-lot-code" className="text-xs text-red-600">
                    {lotErrors.code}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={cancelNewLot}>
                    <span>Cancelar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    disabled={isSavingLot}
                    onClick={() => void handleCreateLot()}
                    icon={isSavingLot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  >
                    <span>{isSavingLot ? 'Guardando...' : 'Guardar lote'}</span>
                  </Button>
                </div>
              </div>

              {errors.inventory_lot_id ? (
                <p key="err-inventory-lot" className="text-xs text-red-600 mt-1">
                  {errors.inventory_lot_id}
                </p>
              ) : null}
            </div>
          </div>

          {/* Notas */}
          <div key="field-notes">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              <span>Observaciones</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivo, proveedor, consumo por lote..."
              className={`${inputClasses} resize-none`}
            />
          </div>

          {/* Contenedor estable para la vista previa del stock (sin alterar número de hermanos) */}
          <div key="field-stock-preview-wrapper">
            {selectedItem ? (
              <div
                key={`stock-preview-box-${selectedItem.id}`}
                className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-[#121816] border border-gray-200 dark:border-[#263632] px-3 py-2.5 text-xs"
              >
                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Stock resultante estimado</span>
                </span>
                <span
                  className={`font-bold ${
                    projectedStock !== null && projectedStock < 0 ? 'text-red-600' : 'text-[#1B4D3E] dark:text-[#6DBF5C]'
                  }`}
                >
                  <span>{projectedStock !== null ? formatQtyWithUnit(projectedStock, selectedItem.unit) : '—'}</span>
                </span>
              </div>
            ) : null}
          </div>

          <div key="modal-actions" className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#263632]">
            <Button type="button" variant="outline" onClick={onClose}>
              <span>Cancelar</span>
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={isSaving}
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            >
              <span>{isSaving ? 'Guardando...' : 'Registrar movimiento'}</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default InventoryMovementModal;
