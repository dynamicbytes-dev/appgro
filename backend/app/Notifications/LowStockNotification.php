<?php

namespace App\Notifications;

use App\Models\InventoryItem;
use Illuminate\Notifications\Notification;

/**
 * Notificación en base de datos (canal 'database') que reciben los
 * administradores de la granja cuando un insumo alcanza o baja de su
 * stock mínimo, para disparar la compra antes del desabastecimiento.
 *
 * Síncrona a propósito (sin ShouldQueue): no depende de un worker.
 */
class LowStockNotification extends Notification
{
    public function __construct(public InventoryItem $item)
    {
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification (tabla `notifications`).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'inventory_low_stock',
            'title' => 'Stock bajo mínimo',
            'message' => "El insumo «{$this->item->name}» ({$this->item->code}) alcanzó el stock mínimo: "
                ."{$this->item->current_stock}. Mínimo configurado: {$this->item->min_stock}.",
            'inventory_item_id' => $this->item->id,
            'item_name' => $this->item->name,
            'item_code' => $this->item->code,
            'current_stock' => (float) $this->item->current_stock,
            'min_stock' => (float) $this->item->min_stock,
            'farm_id' => $this->item->farm_id,
        ];
    }
}
