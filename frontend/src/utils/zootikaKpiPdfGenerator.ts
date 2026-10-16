import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface KpiCardItem {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: 'emerald' | 'amber' | 'red' | 'slate';
}

export interface ExecutiveKpiPdfOptions {
  /** Nombre completo del módulo, ej. "Módulo de Lotes Pecuarios" */
  moduleTitle: string;
  /** Slug identificador para el nombre del archivo, ej. "lotes" */
  moduleSlug?: string;
  /** Nombre de la granja activa */
  farmName?: string;
  /** Código de la granja */
  farmCode?: string;
  /** Nombre del usuario en sesión */
  userName?: string;
  /** Rol del usuario */
  userRole?: string;
  /** Arreglo de 4 indicadores clave */
  kpis: KpiCardItem[];
  /** Texto resumen o hallazgo ejecutivo de la salud operativa */
  diagnosis: string;
  /** Encabezados de la tabla de registros */
  columns: string[];
  /** Filas de datos del módulo */
  rows: (string | number)[][];
}

/**
 * Carga una imagen y la convierte a Data URL Base64 para jsPDF.
 */
async function loadBase64Image(url: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Genera y descarga el PDF Ejecutivo de KPIs con membrete institucional de Zootika.
 */
export async function generateExecutiveKpiPdf(options: ExecutiveKpiPdfOptions): Promise<void> {
  const {
    moduleTitle,
    moduleSlug = 'modulo',
    farmName = 'Granja Principal',
    farmCode = '',
    userName = 'Usuario en Sesión',
    userRole = 'Administrador',
    kpis,
    diagnosis,
    columns,
    rows,
  } = options;

  // Instanciar documento A4 vertical en milímetros
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const fileDate = now.toISOString().split('T')[0];

  /* ------------------------------------------------------------------ */
  /* 1. CABECERA CORPORATIVA (BANNER SUPERIOR VERDE BOSQUE #064E3B)      */
  /* ------------------------------------------------------------------ */
  const headerHeight = 28;
  // Fondo Verde Bosque (#064E3B = RGB 6, 78, 59)
  doc.setFillColor(6, 78, 59);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Franja decorativa inferior Verde Esmeralda (#10B981 = RGB 16, 185, 129)
  doc.setFillColor(16, 185, 129);
  doc.rect(0, headerHeight, pageWidth, 1.5, 'F');

  // Intento de incrustar el logotipo oficial (/logo-zootika.png)
  const logoData = await loadBase64Image('/logo-zootika.png');
  let textStartX = marginX;

  if (logoData) {
    try {
      // Contenedor redondeado oscuro de respaldo para el logo
      doc.setFillColor(4, 47, 36); // #042f24
      doc.roundedRect(marginX, 3.5, 21, 21, 3, 3, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, 3.5, 21, 21, 3, 3, 'D');

      doc.addImage(logoData, 'PNG', marginX + 1.5, 5, 18, 18, undefined, 'FAST');
      textStartX = marginX + 25;
    } catch {
      textStartX = marginX;
    }
  }

  // Título Corporativo "ZOOTIKA"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text('ZOOTIKA', textStartX, 11);

  // Badge "MULTIGRANJA" al lado del título
  const titleWidth = doc.getTextWidth('ZOOTIKA');
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(textStartX + titleWidth + 2.5, 6, 24, 6, 2, 2, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('MULTIGRANJA', textStartX + titleWidth + 4.5, 10.2);

  // Subtítulo oficial en verde esmeralda claro (#A7F3D0)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208);
  doc.text('Sistema de Gestión Agropecuaria Integral — Reporte Ejecutivo de KPIs', textStartX, 17);

  // Nombre de la Granja y Módulo
  doc.setFontSize(8);
  doc.setTextColor(209, 250, 229);
  doc.text(`Unidad de Producción: ${farmName}${farmCode ? ` (${farmCode})` : ''}`, textStartX, 22.5);

  // Metadatos de auditoría en la esquina superior derecha
  doc.setFontSize(7.5);
  doc.setTextColor(220, 252, 231);
  const metaRightX = pageWidth - marginX;
  doc.text(`Fecha: ${dateStr} - ${timeStr}`, metaRightX, 9, { align: 'right' });
  doc.text(`Usuario: ${userName} (${userRole})`, metaRightX, 14, { align: 'right' });
  doc.text('Auditoría: Oficial / Validado', metaRightX, 19, { align: 'right' });
  doc.text('Seguridad: Confidencial Nivel 1', metaRightX, 24, { align: 'right' });

  /* ------------------------------------------------------------------ */
  /* 2. TÍTULO DEL MÓDULO Y DIAGNÓSTICO EJECUTIVO                        */
  /* ------------------------------------------------------------------ */
  let currentY = headerHeight + 8;

  // Título del Módulo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(6, 78, 59); // #064E3B
  doc.text(moduleTitle.toUpperCase(), marginX, currentY);

  currentY += 4.5;

  // Caja de Diagnóstico Ejecutivo
  // Fondo #ECFDF5, borde #D1FAE5, texto #065F46
  const diagBoxY = currentY;
  const diagBoxWidth = pageWidth - marginX * 2;
  const splitDiag = doc.splitTextToSize(diagnosis || 'Diagnóstico operacional normal sin incidencias críticas reportadas.', diagBoxWidth - 10);
  const diagBoxHeight = Math.max(12, splitDiag.length * 4.2 + 8);

  doc.setFillColor(236, 253, 245); // #ECFDF5
  doc.setDrawColor(209, 250, 229); // #D1FAE5
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, diagBoxY, diagBoxWidth, diagBoxHeight, 2.5, 2.5, 'FD');

  // Barra de acento lateral izquierda en verde esmeralda
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(marginX, diagBoxY, 2, diagBoxHeight, 1, 1, 'F');

  // Encabezado del diagnóstico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(6, 95, 70); // #065F46
  doc.text('DIAGNÓSTICO EJECUTIVO Y SALUD OPERATIVA DEL MÓDULO', marginX + 5, diagBoxY + 5.5);

  // Cuerpo del texto del diagnóstico
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(4, 120, 87); // #047857
  doc.text(splitDiag, marginX + 5, diagBoxY + 10);

  currentY = diagBoxY + diagBoxHeight + 6;

  /* ------------------------------------------------------------------ */
  /* 3. GRID DE 4 TARJETAS DE KPIS ESTILIZADAS                           */
  /* ------------------------------------------------------------------ */
  const fourKpis = (kpis || []).slice(0, 4);
  const cardGap = 3.5;
  const totalCardsWidth = pageWidth - marginX * 2;
  const cardWidth = (totalCardsWidth - cardGap * 3) / 4;
  const cardHeight = 22;

  const toneColors: Record<string, { bar: [number, number, number]; valueText: [number, number, number] }> = {
    emerald: { bar: [16, 185, 129], valueText: [6, 78, 59] },
    amber: { bar: [245, 158, 11], valueText: [180, 83, 9] },
    red: { bar: [239, 68, 68], valueText: [185, 28, 28] },
    slate: { bar: [100, 116, 139], valueText: [30, 41, 59] },
  };

  fourKpis.forEach((kpi, idx) => {
    const cardX = marginX + idx * (cardWidth + cardGap);
    const cardTone = toneColors[kpi.tone || 'emerald'] || toneColors.emerald;

    // Fondo #F8FAFC, borde #E2E8F0
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    // Barra lateral de estado
    doc.setFillColor(...cardTone.bar);
    doc.roundedRect(cardX, currentY, 2, cardHeight, 1, 1, 'F');

    // Título del KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // #64748B
    const truncatedTitle = doc.splitTextToSize(kpi.title.toUpperCase(), cardWidth - 5);
    doc.text(truncatedTitle[0] || '', cardX + 4.5, currentY + 5);

    // Valor principal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...cardTone.valueText);
    doc.text(String(kpi.value), cardX + 4.5, currentY + 12.5);

    // Subtítulo descriptivo
    if (kpi.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184); // #94A3B8
      const truncSub = doc.splitTextToSize(kpi.subtitle, cardWidth - 5);
      doc.text(truncSub[0] || '', cardX + 4.5, currentY + 18);
    }
  });

  currentY += cardHeight + 7;

  /* ------------------------------------------------------------------ */
  /* 4. TABLA DETALLADA DE REGISTROS CON JSPDF-AUTOTABLE                 */
  /* ------------------------------------------------------------------ */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 78, 59);
  doc.text('REGISTROS Y MATRIZ DETALLADA DE OPERACIONES', marginX, currentY);

  currentY += 2.5;

  autoTable(doc, {
    startY: currentY,
    head: [columns],
    body: rows,
    margin: { left: marginX, right: marginX, bottom: 18 },
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59], // #064E3B
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // #F9FAFB
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [31, 41, 55], // #1F2937
      cellPadding: 2.2,
      lineColor: [229, 231, 235], // #E5E7EB
      lineWidth: 0.15,
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'auto',
    },
    didDrawPage: (data) => {
      // Pie de página institucional en cada página
      const totalPages = doc.getNumberOfPages();
      const currentPage = data.pageNumber;

      // Línea divisoria en pie de página
      doc.setDrawColor(209, 213, 219);
      doc.setLineWidth(0.2);
      doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

      // Franja Verde Bosque del pie
      doc.setFillColor(6, 78, 59);
      doc.rect(marginX, pageHeight - 12, 10, 0.6, 'F');

      // Texto de pie de página
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128); // #6B7280
      doc.text(
        `Zootika Multigranja • Sistema de Gestión Agropecuaria Integral • ${farmName}`,
        marginX,
        pageHeight - 7.5
      );

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(
        `Reporte Confidencial — Página ${currentPage} de ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 7.5,
        { align: 'right' }
      );
    },
  });

  /* ------------------------------------------------------------------ */
  /* 5. GUARDADO AUTOMÁTICO DEL ARCHIVO PDF                              */
  /* ------------------------------------------------------------------ */
  const cleanSlug = moduleSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const filename = `Zootika_KPIs_${cleanSlug}_${fileDate}.pdf`;
  doc.save(filename);
}

export default generateExecutiveKpiPdf;
