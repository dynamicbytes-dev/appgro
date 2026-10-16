<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? config('zootika.app_name', 'Zootika') }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #F3F4F6;
            margin: 0;
            padding: 24px;
            color: #1F2937;
        }

        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #FFFFFF;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            border: 1px solid #E5E7EB;
        }

        .email-header {
            background-color: {{ config('zootika.colors.forest_green', '#064E3B') }};
            padding: 24px;
            text-align: center;
        }

        .email-logo {
            max-height: 52px;
            width: auto;
            display: inline-block;
        }

        .email-body {
            padding: 32px 28px;
            line-height: 1.6;
            font-size: 15px;
        }

        .email-body h2 {
            color: {{ config('zootika.colors.forest_green', '#064E3B') }};
            margin-top: 0;
            font-size: 20px;
        }

        .btn-primary {
            display: inline-block;
            background-color: {{ config('zootika.colors.emerald_green', '#10B981') }};
            color: #FFFFFF !important;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            text-decoration: none;
            margin: 18px 0;
        }

        .email-footer {
            background-color: #F9FAFB;
            border-top: 1px solid #E5E7EB;
            padding: 20px 24px;
            text-align: center;
            font-size: 12px;
            color: #6B7280;
        }

        .email-footer a {
            color: {{ config('zootika.colors.forest_green', '#064E3B') }};
            text-decoration: none;
            font-weight: 500;
        }
    </style>
</head>
<body>

    <div class="email-wrapper">
        <div class="email-header">
            <img src="{{ asset('logo-zootika.png') }}"
                 alt="{{ config('zootika.app_name', 'Zootika') }}"
                 class="email-logo">
        </div>

        <div class="email-body">
            @yield('content')
        </div>

        <div class="email-footer">
            <p>&copy; {{ date('Y') }} <strong>{{ config('zootika.app_name', 'Zootika') }}</strong>. Todos los derechos reservados.</p>
            <p>Este correo electrónico fue generado automáticamente. Por favor no responda directamente a este mensaje.</p>
        </div>
    </div>

</body>
</html>
