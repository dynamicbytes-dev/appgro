import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;

  const StatusBadge({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
  });

  factory StatusBadge.forStatus(String status) {
    final s = status.toLowerCase();
    if (s == 'terminada' || s == 'activo' || s == 'disponible') {
      return StatusBadge(
        label: status.toUpperCase(),
        backgroundColor: AppColors.successBg,
        textColor: AppColors.success,
      );
    }
    if (s == 'en_proceso' || s == 'descanso') {
      return StatusBadge(
        label: status.replaceAll('_', ' ').toUpperCase(),
        backgroundColor: AppColors.infoBg,
        textColor: AppColors.info,
      );
    }
    if (s == 'pendiente' || s == 'mantenimiento') {
      return StatusBadge(
        label: status.toUpperCase(),
        backgroundColor: AppColors.warningBg,
        textColor: AppColors.warning,
      );
    }
    return StatusBadge(
      label: status.toUpperCase(),
      backgroundColor: AppColors.errorBg,
      textColor: AppColors.error,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

