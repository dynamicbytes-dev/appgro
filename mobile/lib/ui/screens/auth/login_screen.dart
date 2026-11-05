import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../../../core/constants/api_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../widgets/custom_button.dart';
import '../../widgets/custom_text_field.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final success = await auth.login(
      _emailController.text,
      _passwordController.text,
    );

    if (!mounted) return;

    if (!success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Error al iniciar sesión'),
          backgroundColor: AppColors.error,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _showServerConfigDialog() {
    final urlController = TextEditingController(text: ApiEndpoints.baseUrl);
    bool isTesting = false;
    String? testResult;
    bool isSuccess = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Conexión al Servidor Zootika',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Configura la dirección del backend Laravel para conectar el teléfono.',
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 16),
                  CustomTextField(
                    controller: urlController,
                    label: 'URL Base del API',
                    hint: 'http://localhost:8000/api/v1',
                  ),
                  const SizedBox(height: 12),
                  const Text('Accesos rápidos:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: [
                      ActionChip(
                        avatar: const Icon(Icons.usb, size: 16),
                        label: const Text('Cable USB (localhost)', style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          setModalState(() {
                            urlController.text = 'http://localhost:8000/api/v1';
                          });
                        },
                      ),
                      ActionChip(
                        avatar: const Icon(Icons.wifi, size: 16),
                        label: const Text('Wi-Fi Mac (192.168.1.11)', style: TextStyle(fontSize: 12)),
                        onPressed: () {
                          setModalState(() {
                            urlController.text = 'http://192.168.1.11:8000/api/v1';
                          });
                        },
                      ),
                    ],
                  ),
                  if (testResult != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSuccess ? AppColors.successBg : AppColors.errorBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            isSuccess ? Icons.check_circle : Icons.error,
                            color: isSuccess ? AppColors.success : AppColors.error,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              testResult!,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: isSuccess ? AppColors.success : AppColors.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: isTesting
                              ? null
                              : () async {
                                  setModalState(() {
                                    isTesting = true;
                                    testResult = null;
                                  });
                                  final targetUrl = urlController.text.trim();
                                  try {
                                    final res = await http.get(
                                      Uri.parse('$targetUrl/auth/me'),
                                      headers: {'Accept': 'application/json'},
                                    ).timeout(const Duration(seconds: 4));
                                    setModalState(() {
                                      isTesting = false;
                                      isSuccess = res.statusCode == 200 || res.statusCode == 401;
                                      testResult = isSuccess
                                          ? '¡Conexión establecida con éxito! (${res.statusCode})'
                                          : 'Servidor respondió con código ${res.statusCode}';
                                    });
                                  } catch (e) {
                                    setModalState(() {
                                      isTesting = false;
                                      isSuccess = false;
                                      testResult = 'No se pudo conectar: $e';
                                    });
                                  }
                                },
                          child: isTesting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Probar Conexión'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: () async {
                            final target = urlController.text.trim();
                            if (target.isNotEmpty) {
                              await ApiEndpoints.setBaseUrl(target);
                              if (context.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('Servidor guardado: $target'),
                                    backgroundColor: AppColors.success,
                                  ),
                                );
                              }
                            }
                          },
                          child: const Text('Guardar'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_ethernet, color: AppColors.primary),
            tooltip: 'Configurar Servidor',
            onPressed: _showServerConfigDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 10),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset(
                        'assets/images/logo-zootika.png',
                        width: 90,
                        height: 90,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(
                              color: AppColors.primarySoft,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.agriculture,
                              size: 44,
                              color: AppColors.primary,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Zootika',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      color: AppColors.primaryDark,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Gestión Agropecuaria Multi-Granja y Multi-Rol',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 32),

                  CustomTextField(
                    controller: _emailController,
                    label: 'Correo Electrónico',
                    hint: 'ejemplo@finca.com',
                    prefixIcon: Icons.email_outlined,
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Ingresa tu correo';
                      }
                      if (!value.contains('@')) {
                        return 'Correo inválido';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 18),

                  CustomTextField(
                    controller: _passwordController,
                    label: 'Contraseña',
                    hint: '••••••••',
                    prefixIcon: Icons.lock_outline,
                    obscureText: _obscurePassword,
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                        color: AppColors.textMuted,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Ingresa tu contraseña';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 28),

                  CustomButton(
                    text: 'Iniciar Sesión',
                    isLoading: auth.status == AuthStatus.loading,
                    onPressed: _handleLogin,
                  ),

                  const SizedBox(height: 24),
                  Center(
                    child: Text(
                      'Conectado a: ${ApiEndpoints.baseUrl}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
