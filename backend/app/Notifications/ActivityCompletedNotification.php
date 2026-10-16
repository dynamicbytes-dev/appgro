<?php

namespace App\Notifications;

use App\Models\Activity;
use Illuminate\Notifications\Notification;

/**
 * Notificación en base de datos (canal 'database') que recibe el
 * administrador cuando uno de sus subordinados marca una actividad
 * como 'terminada'.
 */
class ActivityCompletedNotification extends Notification
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
        $assignee = $this->activity->assignee;
        $who = $assignee
            ? trim(($assignee->name ?? '').' '.($assignee->lastname ?? ''))
            : 'Un subordinado';

        return [
            'type' => 'activity_completed',
            'title' => 'Actividad terminada',
            'message' => "{$who} terminó la actividad «{$this->activity->title}».",
            'activity_id' => $this->activity->id,
            'activity_title' => $this->activity->title,
            'status' => $this->activity->status,
            'due_date' => optional($this->activity->due_date)->toDateString(),
            'farm_id' => $this->activity->farm_id,
        ];
    }
}
