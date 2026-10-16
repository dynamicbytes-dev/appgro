/**
 * Generador Oficial de Reportes PDF de Indicadores Clave (KPIs) de Zootika.
 * Membrete institucional con el logotipo oficial (/logo-zootika.png) y
 * diseño adaptado para impresión y exportación digital a PDF de alta resolución.
 */

export interface KpiMetric {
  label: string;
  value: string | number;
  subtext?: string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export interface KpiTableSection {
  title: string;
  description?: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface KpiPdfReportOptions {
  moduleName: 'Especies' | 'Galpones' | 'Lotes' | 'Inventario' | 'Actividades' | 'Analítica' | string;
  farmName?: string;
  farmCode?: string;
  userName?: string;
  userRole?: string;
  summaryText?: string;
  kpis: KpiMetric[];
  tables?: KpiTableSection[];
  notes?: string;
}

/**
 * Convierte una imagen a Base64 para garantizar que se imprima incluso en
 * entornos donde los recursos relativos en popups sean bloqueados por el navegador.
 */
async function getLogoBase64(): Promise<string> {
  try {
    const response = await fetch('/logo-zootika.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('/logo-zootika.png');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '/logo-zootika.png';
  }
}

/**
 * Genera y abre el documento de reporte con membrete oficial de Zootika para
 * guardarlo como PDF o imprimirlo.
 */
export async function generateKpiPdf(options: KpiPdfReportOptions): Promise<void> {
  const {
    moduleName,
    farmName = 'Granja Principal',
    farmCode = '',
    userName = 'Administrador de Sistema',
    userRole = 'Administrador',
    summaryText,
    kpis,
    tables = [],
    notes,
  } = options;

  const logoSrc = await getLogoBase64();
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const reportCode = `ZTK-KPI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    success: { bg: '#ecfdf5', text: '#065f46', border: '#10b981' },
    warning: { bg: '#fffbeb', text: '#92400e', border: '#f59e0b' },
    danger: { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
    info: { bg: '#eff6ff', text: '#1e40af', border: '#3b82f6' },
    neutral: { bg: '#f9fafb', text: '#1f2937', border: '#10b981' },
  };

  const kpisHtml = kpis
    .map((kpi) => {
      const style = statusColors[kpi.status || 'neutral'];
      return `
        <div class="kpi-card" style="border-top: 4px solid ${style.border};">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-value">${kpi.value}</div>
          ${kpi.subtext ? `<div class="kpi-subtext">${kpi.subtext}</div>` : ''}
        </div>
      `;
    })
    .join('');

  const tablesHtml = tables
    .map(
      (t) => `
      <div class="section-container">
        <h3 class="section-title">${t.title}</h3>
        ${t.description ? `<p class="section-desc">${t.description}</p>` : ''}
        <table class="report-table">
          <thead>
            <tr>
              ${t.headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${t.rows
              .map(
                (row) => `
              <tr>
                ${row.map((cell) => `<td>${cell}</td>`).join('')}
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte de KPIs ${moduleName} - Zootika</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }

    /* Membrete Institucional Oficial */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #064E3B;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-logo-container {
      width: 72px;
      vertical-align: middle;
    }
    .header-logo-box {
      width: 64px;
      height: 64px;
      background-color: #042f24;
      border: 1.5px solid #10B981;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header-logo-box img {
      width: 52px;
      height: 52px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .header-brand {
      vertical-align: middle;
      padding-left: 12px;
    }
    .header-brand h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 900;
      color: #064E3B;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .header-brand .brand-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      background: #10B981;
      color: #ffffff;
      padding: 2px 7px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      vertical-align: middle;
    }
    .header-brand p {
      margin: 3px 0 0 0;
      font-size: 10px;
      font-weight: 600;
      color: #047857;
      letter-spacing: 0.2px;
    }
    .header-meta {
      vertical-align: middle;
      text-align: right;
      font-size: 9.5px;
      color: #4b5563;
      line-height: 1.45;
    }
    .header-meta strong {
      color: #111827;
    }

    /* Título del Reporte */
    .report-banner {
      background: linear-gradient(135deg, #064E3B 0%, #10B981 100%);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .report-banner h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .report-banner .pill {
      background: rgba(255,255,255,0.2);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 9.5px;
      font-weight: 600;
    }

    .summary-text {
      font-size: 11px;
      color: #374151;
      background: #f8fafc;
      border-left: 3px solid #10B981;
      padding: 8px 12px;
      margin-bottom: 16px;
      border-radius: 0 6px 6px 0;
    }

    /* Grid de KPIs */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 20px;
      font-weight: 900;
      color: #064E3B;
      letter-spacing: -0.5px;
    }
    .kpi-subtext {
      font-size: 8.5px;
      color: #9ca3af;
      margin-top: 2px;
    }

    /* Tablas */
    .section-container {
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #064E3B;
      margin: 0 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      border-bottom: 1.5px solid #e5e7eb;
      padding-bottom: 3px;
    }
    .section-desc {
      font-size: 9.5px;
      color: #6b7280;
      margin: 0 0 8px 0;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .report-table th {
      background-color: #064E3B;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #064E3B;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .report-table td {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      color: #374151;
    }
    .report-table tbody tr:nth-child(even) {
      background-color: #f9fafb;
    }

    /* Firmas y Auditoría */
    .signatures-container {
      margin-top: 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      page-break-inside: avoid;
    }
    .sig-box {
      border-top: 1px dashed #9ca3af;
      padding-top: 6px;
      text-align: center;
      font-size: 9.5px;
      color: #4b5563;
    }
    .sig-box strong {
      display: block;
      color: #111827;
      font-size: 10px;
      margin-bottom: 2px;
    }

    /* Footer */
    .report-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 8.5px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <!-- Membrete Institucional Oficial Zootika -->
  <table class="header-table">
    <tr>
      <td class="header-logo-container">
        <div class="header-logo-box">
          <img src="${logoSrc}" alt="Zootika Logo" />
        </div>
      </td>
      <td class="header-brand">
        <h1>ZOOTIKA <span class="brand-badge">MULTIGRANJA</span></h1>
        <p>SISTEMA DE GESTIÓN AGROPECUARIA INTEGRAL</p>
      </td>
      <td class="header-meta">
        <div><strong>CÓDIGO:</strong> ${reportCode}</div>
        <div><strong>EMISIÓN:</strong> ${dateFormatted} - ${timeFormatted}</div>
        <div><strong>GRANJA:</strong> ${farmName} ${farmCode ? `(${farmCode})` : ''}</div>
        <div><strong>RESPONSABLE:</strong> ${userName} (${userRole})</div>
      </td>
    </tr>
  </table>

  <!-- Banner del Módulo -->
  <div class="report-banner">
    <h2>Reporte de Indicadores Clave (KPIs) — ${moduleName}</h2>
    <div class="pill">AUDITORÍA ACTIVA</div>
  </div>

  ${
    summaryText
      ? `<div class="summary-text"><strong>Resumen Ejecutivo:</strong> ${summaryText}</div>`
      : ''
  }

  <!-- Grid de Métricas Principales (KPIs) -->
  <div class="kpi-grid">
    ${kpisHtml}
  </div>

  <!-- Tablas de Detalle y Registros -->
  ${tablesHtml}

  ${
    notes
      ? `
    <div class="section-container">
      <h3 class="section-title">Observaciones y Recomendaciones Operativas</h3>
      <p class="section-desc">${notes}</p>
    </div>
  `
      : ''
  }

  <!-- Firmas Institucionales -->
  <div class="signatures-container">
    <div class="sig-box">
      <strong>${userName}</strong>
      Responsable de Registro y Control Operativo
    </div>
    <div class="sig-box">
      <strong>Gerencia Técnica / Administración de Granja</strong>
      Zootika Multigranja • Sistema de Gestión Integral
    </div>
  </div>

  <!-- Pie de Página -->
  <div class="report-footer">
    <span>Zootika Sistema de Gestión Agropecuaria Integral &bull; Reporte Confidencial</span>
    <span>Página 1 de 1</span>
  </div>

  <script>
    window.onload = function() {
      // Auto-disparar el diálogo de impresión / guardar PDF nativo del navegador
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
  `;

  // Abrir ventana limpia con el informe institucional
  const printWindow = window.open('', '_blank', 'width=900,height=750,menubar=no,toolbar=no');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Si el navegador bloqueó el popup, usamos un iframe temporal
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    iframe.contentWindow?.document.open();
    iframe.contentWindow?.document.write(html);
    iframe.contentWindow?.document.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }, 500);
  }
}

/**
 * Plantillas rápidas para generar el reporte de KPIs de cualquiera de los 6 módulos principales.
 */
export const pdfKpiGenerators = {
  especies: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Especies',
      summaryText:
        'Estado del inventario taxonómico de especies pecuarias registradas en la granja, categorías taxonómicas oficiales y niveles de actividad.',
      ...params,
    }),

  galpones: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Galpones',
      summaryText:
        'Indicadores de infraestructura pecuaria, capacidad máxima, ocupación animal en tiempo real y disponibilidad de alojamiento.',
      ...params,
    }),

  lotes: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Lotes',
      summaryText:
        'Rendimiento productivo de lotes de crianza y engorde, tasa de conversión, control de mortalidad y fechas estimadas de cosecha/faena.',
      ...params,
    }),

  inventario: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Inventario',
      summaryText:
        'Valorización del stock agropecuario en almacenes, balance de insumos, control de mermas y alertas tempranas por vencimiento.',
      ...params,
    }),

  actividades: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Actividades',
      summaryText:
        'Eficiencia del personal operativo, cumplimiento de protocolos sanitarios y seguimiento de tareas diarias programadas.',
      ...params,
    }),

  analitica: (params: { farmName?: string; kpis: KpiMetric[]; tables?: KpiTableSection[] }) =>
    generateKpiPdf({
      moduleName: 'Analítica',
      summaryText:
        'Consolidado ejecutivo de métricas financieras, márgenes brutos, costos operativos y retorno sobre la inversión pecuaria.',
      ...params,
    }),
};

export default generateKpiPdf;
