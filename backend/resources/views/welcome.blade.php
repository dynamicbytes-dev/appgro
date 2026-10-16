<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('zootika.app_name', 'Zootika') }} - Backend API Server</title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <style>
        :root {
            --forest-green: #064E3B;
            --emerald-green: #10B981;
            --emerald-glow: rgba(16, 185, 129, 0.2);
            --dark-surface: #061A14;
            --dark-card: #0A261E;
            --text-main: #F0FDF4;
            --text-muted: #9CA3AF;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
            background: radial-gradient(circle at 50% 0%, #0c3327 0%, var(--dark-surface) 75%, #030d0a 100%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .container {
            width: 100%;
            max-width: 680px;
            background: linear-gradient(145deg, rgba(10, 38, 30, 0.85) 0%, rgba(6, 26, 20, 0.95) 100%);
            border: 1px solid rgba(16, 185, 129, 0.25);
            border-radius: 20px;
            box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 35px -5px var(--emerald-glow);
            padding: 44px 36px;
            text-align: center;
            backdrop-filter: blur(12px);
        }

        .logo-wrap {
            margin-bottom: 24px;
            display: inline-block;
        }

        .logo-img {
            max-height: 86px;
            width: auto;
            object-fit: contain;
            filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35));
        }

        h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.8px;
            color: #FFFFFF;
            margin-bottom: 8px;
        }

        .subtitle {
            color: var(--emerald-green);
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 20px;
        }

        p.description {
            color: var(--text-muted);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .badge-list {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 32px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            color: var(--emerald-green);
        }

        .badge-dot {
            width: 7px;
            height: 7px;
            background-color: var(--emerald-green);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--emerald-green);
        }

        .endpoints-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            text-align: left;
            margin-top: 10px;
        }

        .endpoint-card {
            background: rgba(6, 26, 20, 0.65);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 14px 16px;
            text-decoration: none;
            transition: all 0.2s ease;
            display: block;
        }

        .endpoint-card:hover {
            border-color: var(--emerald-green);
            background: rgba(10, 38, 30, 0.9);
            transform: translateY(-2px);
        }

        .endpoint-method {
            display: inline-block;
            background: var(--forest-green);
            color: var(--emerald-green);
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            margin-bottom: 4px;
        }

        .endpoint-path {
            color: #FFFFFF;
            font-size: 13px;
            font-weight: 600;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        .endpoint-desc {
            color: var(--text-muted);
            font-size: 11px;
            margin-top: 2px;
        }

        footer {
            margin-top: 28px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.4);
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="logo-wrap">
            <img src="{{ asset('logo-zootika.png') }}"
                 alt="{{ config('zootika.app_name', 'Zootika') }}"
                 class="logo-img">
        </div>

        <h1>{{ config('zootika.app_name', 'Zootika') }}</h1>
        <div class="subtitle">API & Servicio Backend</div>

        <p class="description">
            Servidor de servicios RESTful y motor de gestión agropecuaria multiplataforma.
            Activos oficiales sincronizados y operativos.
        </p>

        <div class="badge-list">
            <div class="badge"><span class="badge-dot"></span> Servidor Activo</div>
            <div class="badge">Laravel {{ Illuminate\Foundation\Application::VERSION }}</div>
            <div class="badge">PHP v{{ PHP_VERSION }}</div>
            <div class="badge">Logo Oficial: /logo-zootika.png</div>
        </div>

        <div class="endpoints-grid">
            <a href="{{ url('/api/config') }}" class="endpoint-card">
                <span class="endpoint-method">GET</span>
                <div class="endpoint-path">/api/config</div>
                <div class="endpoint-desc">Configuración general y metadatos</div>
            </a>
            <a href="{{ url('/api/metadata') }}" class="endpoint-card">
                <span class="endpoint-method">GET</span>
                <div class="endpoint-path">/api/metadata</div>
                <div class="endpoint-desc">Metadatos de la aplicación y branding</div>
            </a>
            <a href="{{ asset('logo-zootika.png') }}" target="_blank" class="endpoint-card">
                <span class="endpoint-method">ASSET</span>
                <div class="endpoint-path">/logo-zootika.png</div>
                <div class="endpoint-desc">Recurso público del logo oficial</div>
            </a>
            <a href="{{ url('/api/v1/auth/login') }}" class="endpoint-card">
                <span class="endpoint-method">POST</span>
                <div class="endpoint-path">/api/v1/auth/login</div>
                <div class="endpoint-desc">Endpoint de autenticación JWT</div>
            </a>
        </div>

        <footer>
            &copy; {{ date('Y') }} {{ config('zootika.app_name', 'Zootika') }} &bull; Todos los derechos reservados.
        </footer>
    </div>

</body>
</html>
