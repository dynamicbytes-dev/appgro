import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/notification_provider.dart';
import '../../widgets/app_drawer.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().loadNotifications();
    });
  }

  @override
  Widget build(BuildContext context) {
    final notifProv = context.watch<NotificationProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        actions: [
          if (notifProv.unreadCount > 0)
            TextButton(
              onPressed: () => notifProv.markAllAsRead(),
              child: const Text(
                'Marcar leídas',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => notifProv.loadNotifications(),
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: notifProv.isLoading
          ? const Center(child: CircularProgressIndicator())
          : notifProv.notifications.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.notifications_none, size: 64, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text(
                        'No tienes notificaciones pendientes',
                        style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => notifProv.loadNotifications(),
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: notifProv.notifications.length,
                    itemBuilder: (context, index) {
                      final n = notifProv.notifications[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        color: n.isRead ? Colors.white : AppColors.primary.withOpacity(0.05),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: n.isRead
                              ? BorderSide.none
                              : const BorderSide(color: AppColors.primary, width: 1),
                        ),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: n.isRead ? AppColors.background : AppColors.primary,
                            child: Icon(
                              Icons.notifications,
                              color: n.isRead ? AppColors.textSecondary : Colors.white,
                              size: 20,
                            ),
                          ),
                          title: Text(
                            n.title,
                            style: TextStyle(
                              fontWeight: n.isRead ? FontWeight.w600 : FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          subtitle: Text(
                            n.message,
                            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                          trailing: n.isRead
                              ? null
                              : Container(
                                  width: 10,
                                  height: 10,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
