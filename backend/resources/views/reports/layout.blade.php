<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? config('zootika.app_name', 'Zootika') }} - Reporte Oficial</title>
    <style>
        :root {
            --primary: {{ config('zootika.colors.forest_green', '#064E3B') }};
            --secondary: {{ config('zootika.colors.emerald_green', '#10B981') }};
            --dark: #1F2937;
            --light: #F9FAFB;
            --border: #E5E7EB;
        }

        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: var(--dark);
            background-color: #FFFFFF;
            margin: 0;
            padding: 30px;
            font-size: 13px;
            line-height: 1.5;
        }

        .header-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid var(--primary);
            padding-bottom: 18px;
            margin-bottom: 24px;
        }

        .header-brand {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .header-logo {
            max-height: 58px;
            width: auto;
            object-fit: contain;
        }

        .header-title-box h1 {
            margin: 0;
            color: var(--primary);
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .header-title-box p {
            margin: 2px 0 0 0;
            color: var(--secondary);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .header-meta {
            text-align: right;
            font-size: 11px;
            color: #6B7280;
        }

        .header-meta strong {
            color: var(--dark);
        }

        .report-badge {
            display: inline-block;
            background-color: var(--primary);
            color: #FFFFFF;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 15px;
        }

        .content-box {
            margin-bottom: 30px;
        }

        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 20px;
        }

        table.data-table th {
            background-color: var(--primary);
            color: #FFFFFF;
            text-align: left;
            padding: 10px 12px;
            font-size: 12px;
            font-weight: 600;
        }

        table.data-table td {
            padding: 9px 12px;
            border-bottom: 1px solid var(--border);
        }

        table.data-table tr:nth-child(even) {
            background-color: #F9FAFB;
        }

        .footer-container {
            border-top: 1px solid var(--border);
            padding-top: 15px;
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #9CA3AF;
        }

        .footer-tagline {
            color: var(--primary);
            font-weight: 600;
        }

        @media print {
            body {
                padding: 15mm;
            }
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>

    <header class="header-container">
        <div class="header-brand">
            {{-- Soporte para ruta web pública y ruta absoluta en PDF --}}
            <img src="{{ file_exists(public_path('logo-zootika.png')) ? asset('logo-zootika.png') : url('/logo-zootika.png') }}"
                 alt="{{ config('zootika.app_name', 'Zootika') }}"
                 class="header-logo">
            <div class="header-title-box">
                <h1>{{ config('zootika.app_name', 'Zootika') }}</h1>
                <p>Plataforma de Gestión Agropecuaria</p>
            </div>
        </div>
        <div class="header-meta">
            <div><strong>Fecha:</strong> {{ date('d/m/Y H:i') }}</div>
            <div><strong>Reporte:</strong> {{ $report_code ?? 'GEN-' . date('Ymd') }}</div>
            @if(isset($farm_name))
                <div><strong>Granja:</strong> {{ $farm_name }}</div>
            @endif
        </div>
    </header>

    @if(isset($subtitle))
        <div class="report-badge">{{ $subtitle }}</div>
    @endif

    <main class="content-box">
        @yield('content')
    </main>

    <footer class="footer-container">
        <div>
            <span class="footer-tagline">{{ config('zootika.app_name', 'Zootika') }}</span> &copy; {{ date('Y') }} &bull; Todos los derechos reservados.
        </div>
        <div>
            Documento emitido electrónicamente por el servidor del sistema.
        </div>
    </footer>

</body>
</html>
