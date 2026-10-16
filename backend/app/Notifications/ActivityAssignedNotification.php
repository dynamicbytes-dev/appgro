<?php

namespace App\Notifications;

use App\Models\Activity;
use Illuminate\Notifications\Notification;

/**
 * Notificación en base de datos (canal 'database') que recibe el
 * subordinado cuando el administrador le asigna una nueva actividad.
 *
 * Síncrona a propósito (sin ShouldQueue): la entrega no depende de
 * que haya un worker de colas corriendo.
 */
class ActivityAssignedNotification extends Notification
{
    public function __construct(public Activity $activity)
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
            'type' => 'activity_assigned',
            'title' => 'Nueva actividad asignada',
            'message' => "Tienes una nueva actividad asignada: «{$this->activity->title}».",
            'activity_id' => $this->activity->id,
            'activity_title' => $this->activity->title,
            'status' => $this->activity->status,
            'due_date' => optional($this->activity->due_date)->toDateString(),
            'farm_id' => $this->activity->farm_id,
        ];
    }
}
