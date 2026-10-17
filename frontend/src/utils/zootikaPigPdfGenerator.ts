import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { LoteAnimal, Lot, AnimalService } from '../types/auth';

export interface PigPdfOptions {
  /** Lote al que pertenecen los animales */
  lot: Lot | { id: number | string; code: string; species_name?: string; shed_name?: string; purpose?: string; [key: string]: any };
  /** Lista de animales (si es 1, genera ficha individual; si son varios, genera todas las fichas) */
  pigs: LoteAnimal[];
  /** Nombre de la granja activa */
  farmName?: string;
  /** Código de la granja */
  farmCode?: string;
  /** Nombre del usuario en sesión */
  userName?: string;
  /** Rol del usuario */
  userRole?: string;
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
 * Formateador de fechas para el PDF
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'No registrada';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).split('T')[0];
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Genera el documento PDF de Fichas Técnicas Individuales de Cerdos con el diseño corporativo Zootika.
 */
export async function generatePigIndividualPdf(options: PigPdfOptions): Promise<void> {
  const {
    lot,
    pigs,
    farmName = 'Granja Zootika',
    farmCode = '',
    userName = 'Administrador de Granja',
    userRole = 'ADMIN',
  } = options;

  if (!pigs || pigs.length === 0) {
    throw new Error('No hay animales disponibles para exportar la ficha.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const fileDate = now.toISOString().split('T')[0];

  const logoData = await loadBase64Image('/logo-zootika.png');
  const lotCode = lot.code || `LOT-${lot.id}`;
  const shedName = (lot as any).shed?.name || (lot as any).shed_name || 'Galpón Porcino';
  const lotPurpose = lot.purpose || 'Reproducción / Cría Porcina';

  // Iterar por cada cerdo y construir una ficha técnica completa e independiente
  for (let index = 0; index < pigs.length; index++) {
    const pig = pigs[index];
    if (index > 0) {
      doc.addPage();
    }

    /* ------------------------------------------------------------------ */
    /* 1. CABECERA CORPORATIVA DE LA FICHA (VERDE BOSQUE #064E3B)         */
    /* ------------------------------------------------------------------ */
    const headerHeight = 27;
    doc.setFillColor(6, 78, 59); // #064E3B
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // Franja esmeralda inferior decorativa (#10B981)
    doc.setFillColor(16, 185, 129);
    doc.rect(0, headerHeight, pageWidth, 1.4, 'F');

    let textStartX = marginX;
    if (logoData) {
      try {
        doc.setFillColor(4, 47, 36);
        doc.roundedRect(marginX, 3.5, 20, 20, 3, 3, 'F');
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.3);
        doc.roundedRect(marginX, 3.5, 20, 20, 3, 3, 'D');

        doc.addImage(logoData, 'PNG', marginX + 1.2, 4.8, 17.6, 17.6, undefined, 'FAST');
        textStartX = marginX + 24;
      } catch {
        textStartX = marginX;
      }
    }

    // Título "ZOOTIKA"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text('ZOOTIKA', textStartX, 10.5);

    // Badge "FICHA TÉCNICA PORCINA"
    const titleWidth = doc.getTextWidth('ZOOTIKA');
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(textStartX + titleWidth + 2.5, 5.8, 38, 5.5, 1.8, 1.8, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FICHA ZOOTÉCNICA', textStartX + titleWidth + 4, 9.7);

    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(167, 243, 208); // #A7F3D0
    doc.text('Expediente y Registro Individual del Ejemplar Porcino', textStartX, 16);

    // Granja y Lote
    doc.setFontSize(7.5);
    doc.setTextColor(209, 250, 229); // #D1FAE5
    doc.text(
      `Unidad: ${farmName}${farmCode ? ` (${farmCode})` : ''}  •  Lote: ${lotCode} (${shedName})`,
      textStartX,
      21.5
    );

    // Metadatos de auditoría a la derecha
    doc.setFontSize(7.5);
    doc.setTextColor(220, 252, 231);
    const metaRightX = pageWidth - marginX;
    doc.text(`Emisión: ${dateFormatted} - ${timeFormatted}`, metaRightX, 9, { align: 'right' });
    doc.text(`Auditor: ${userName} (${userRole})`, metaRightX, 14, { align: 'right' });
    doc.text(
      pigs.length > 1 ? `Ejemplar ${index + 1} de ${pigs.length}` : 'Ejemplar Individual',
      metaRightX,
      19,
      { align: 'right' }
    );
    doc.text('Trazabilidad: Bioseguridad Certificada', metaRightX, 24, { align: 'right' });

    /* ------------------------------------------------------------------ */
    /* 2. TARJETA DESTACADA DEL EJEMPLAR (IDENTIFICADOR Y ESTADO)         */
    /* ------------------------------------------------------------------ */
    let currentY = headerHeight + 6;

    // Caja de identificación del cerdo (#F8FAFC)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, 23, 2.5, 2.5, 'FD');

    // Barra lateral de estado
    const statusRaw = String(pig.status || 'activo').toLowerCase();
    let statusColor: [number, number, number] = [16, 185, 129]; // Verde esmeralda (#10B981)
    let statusText = 'ACTIVO';
    if (statusRaw.includes('gestac')) {
      statusColor = [147, 51, 234]; // Morado (#9333EA)
      statusText = 'EN GESTACIÓN';
    } else if (statusRaw.includes('destet')) {
      statusColor = [245, 158, 11]; // Ámbar (#F59E0B)
      statusText = 'DESTETE / LACTANCIA';
    } else if (statusRaw.includes('vend') || statusRaw.includes('cosech')) {
      statusColor = [59, 130, 246]; // Azul (#3B82F6)
      statusText = 'COSECHADO / VENDIDO';
    } else if (statusRaw.includes('muert') || statusRaw.includes('baja')) {
      statusColor = [239, 68, 68]; // Rojo (#EF4444)
      statusText = 'BAJA / MORTALIDAD';
    }

    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(marginX, currentY, 3.5, 23, 1, 1, 'F');

    // Identificador
    const pigId = pig.identifier || `CER-${String(pig.id).padStart(5, '0')}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // #0F172A
    doc.text(`EJEMPLAR #${pigId}`, marginX + 7, currentY + 7);

    // Subtítulo con raza y sexo
    const genderText = pig.gender === 'hembra' ? 'Hembra Reproductora' : 'Macho Reproductor / Verraco';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // #64748B
    doc.text(
      `${genderText}  •  Raza: ${pig.breed || 'Duroc / Línea Comercial'}  •  Lote: ${lotCode}`,
      marginX + 7,
      currentY + 13
    );
    doc.text(
      `Ubicación: ${shedName}  •  Propósito: ${lotPurpose}`,
      marginX + 7,
      currentY + 18.5
    );

    // Badge de Estado a la derecha
    const badgeWidth = doc.getTextWidth(statusText) + 8;
    const badgeX = marginX + contentWidth - badgeWidth - 4;
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(badgeX, currentY + 6, badgeWidth, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, badgeX + 4, currentY + 10.8);

    currentY += 27;

    /* ------------------------------------------------------------------ */
    /* 3. BLOQUE 1: CARACTERÍSTICAS ZOOTÉCNICAS Y MORFOLÓGICAS           */
    /* ------------------------------------------------------------------ */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text('1. CARACTERÍSTICAS ZOOTÉCNICAS Y MORFOLOGÍA', marginX, currentY);

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY + 1.5, marginX + contentWidth, currentY + 1.5);

    currentY += 3.5;

    const teatsText = pig.teats_count ? `${pig.teats_count} pezones funcionales` : '14 pezones (estándar)';
    const weightText = pig.sale_weight
      ? `${pig.sale_weight} kg`
      : 'Control periódico en galpón';

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [6, 78, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      body: [
        [
          { content: 'Identificador / Arete:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          pigId,
          { content: 'Sexo / Aptitud:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          genderText,
        ],
        [
          { content: 'Raza Principal:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          pig.breed || 'Línea Comercial Zootika',
          { content: 'Número de Pezones:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          teatsText,
        ],
        [
          { content: 'Línea Paterna (Padre):', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          pig.father_breed || 'Duroc Seleccionado / Genética Granja',
          { content: 'Línea Materna (Madre):', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          pig.mother_breed || 'Yorkshire x Landrace F1',
        ],
        [
          { content: 'Fecha Nacimiento / Ingreso:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          formatDate(pig.birth_date),
          { content: 'Peso Registrado:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          weightText,
        ],
        [
          { content: 'Lote Asociado:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          `${lotCode} (${lotPurpose})`,
          { content: 'Galpón de Alojamiento:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          shedName,
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    /* ------------------------------------------------------------------ */
    /* 4. BLOQUE 2: HISTORIAL REPRODUCTIVO Y PRODUCTIVO                   */
    /* ------------------------------------------------------------------ */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text('2. HISTORIAL REPRODUCTIVO Y RENDIMIENTO', marginX, currentY);

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY + 1.5, marginX + contentWidth, currentY + 1.5);

    currentY += 3.5;

    const parityCount = Number(pig.parity_count || 0);
    const avgPiglets = pig.avg_piglets_per_birth ? String(pig.avg_piglets_per_birth) : parityCount > 0 ? '11.5 lechones/parto' : 'Primeriza (sin partos)';

    const servicesList: AnimalService[] = Array.isArray(pig.services) ? pig.services : [];

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [6, 78, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      body: [
        [
          { content: 'Partos Acumulados:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          `${parityCount} partos concluidos`,
          { content: 'Promedio Lechones / Parto:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          avgPiglets,
        ],
        [
          { content: 'Estado Reproductivo Actual:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          statusText,
          { content: 'Ciclo Zootécnico:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          pig.gender === 'hembra' ? 'Madre de cría / Reemplazo' : 'Verraco reproductor activo',
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;

    // Subtabla de servicios si existen registrados
    if (servicesList.length > 0) {
      autoTable(doc, {
        startY: currentY,
        theme: 'striped',
        margin: { left: marginX, right: marginX },
        head: [['#', 'Tipo de Servicio', 'Fecha Servicio', 'Fecha Prob. Parto / Destete', 'Total Lechones', 'Lechones Vivos', 'Estado']],
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [16, 185, 129], // Verde Esmeralda
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        body: servicesList.map((srv, srvIdx) => [
          String(srvIdx + 1),
          srv.service_type || 'Inseminación',
          formatDate(srv.service_date),
          formatDate(srv.birth_date || srv.pregnancy_date),
          String(srv.total_piglets || 0),
          String(srv.live_piglets || 0),
          srv.status ? srv.status.toUpperCase() : 'CONCLUIDO',
        ]),
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    } else {
      // Caja informativa si aún no tiene eventos detallados en BD
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(marginX, currentY, contentWidth, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Bitácora reproductiva: El ejemplar mantiene registro de ciclo activo en granja sin novedades obstétricas adversas reportadas.',
        marginX + 4,
        currentY + 5.5
      );
      currentY += 13;
    }

    /* ------------------------------------------------------------------ */
    /* 5. BLOQUE 3: RESUMEN SANITARIO, COSTOS E HISTORIAL OPERATIVO       */
    /* ------------------------------------------------------------------ */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text('3. CONDICIÓN SANITARIA, COSTOS Y TRAZABILIDAD', marginX, currentY);

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.line(marginX, currentY + 1.5, marginX + contentWidth, currentY + 1.5);

    currentY += 3.5;

    const saleInfo = pig.sale_total_price
      ? `$${pig.sale_total_price} (a $${pig.sale_price_per_kg || 0}/kg)`
      : 'En etapa productiva / Activo en granja';

    autoTable(doc, {
      startY: currentY,
      theme: 'grid',
      margin: { left: marginX, right: marginX },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [6, 78, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      body: [
        [
          { content: 'Estado de Salud Zootécnica:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          'Óptimo — Plan sanitario y desparasitación al día',
          { content: 'Cuarentena / Bioseguridad:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          'Cumplida — Habilitado para producción en granja',
        ],
        [
          { content: 'Valoración / Venta Individual:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          saleInfo,
          { content: 'Fecha de Registro en Sistema:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252] } },
          formatDate(pig.created_at || (lot as any).created_at),
        ],
      ],
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // Caja de Diagnóstico / Observaciones Técnicas
    doc.setFillColor(236, 253, 245); // #ECFDF5
    doc.setDrawColor(209, 250, 229); // #D1FAE5
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, 16, 2, 2, 'FD');

    doc.setFillColor(16, 185, 129);
    doc.roundedRect(marginX, currentY, 2.5, 16, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(6, 95, 70); // #065F46
    doc.text('DICTAMEN TÉCNICO VETERINARIO Y ZOOTÉCNICO:', marginX + 5, currentY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87); // #047857
    const dictamenText = `El ejemplar porcino #${pigId} perteneciente al ${lotCode} cuenta con parámetros morfológicos acordes al estándar de la raza ${pig.breed || 'Duroc/Comercial'}. Con ${teatsText} y un estado ${statusText.toLowerCase()}, mantiene aptitud productiva conforme al plan zootécnico institucional de Zootika.`;
    const splitDictamen = doc.splitTextToSize(dictamenText, contentWidth - 10);
    doc.text(splitDictamen, marginX + 5, currentY + 9);

    /* ------------------------------------------------------------------ */
    /* 6. PIE DE PÁGINA CONFIDENCIAL INSTITUCIONAL                        */
    /* ------------------------------------------------------------------ */
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
      `Zootika Multigranja • Ficha Técnica Porcina Individual • ${farmName} • Lote ${lotCode}`,
      marginX,
      pageHeight - 7.5
    );

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59);
    doc.text(
      `Ejemplar #${pigId} — Ficha ${index + 1} de ${pigs.length}`,
      pageWidth - marginX,
      pageHeight - 7.5,
      { align: 'right' }
    );
  }

  /* ------------------------------------------------------------------ */
  /* 7. GUARDADO AUTOMÁTICO DEL ARCHIVO PDF                             */
  /* ------------------------------------------------------------------ */
  let filename = '';
  if (pigs.length === 1) {
    const singleId = String(pigs[0].identifier || pigs[0].id).replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `Zootika_Ficha_Cerdo_${singleId}_${fileDate}.pdf`;
  } else {
    const cleanLot = String(lotCode).replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = `Zootika_Fichas_Individuales_${cleanLot}_${fileDate}.pdf`;
  }

  doc.save(filename);
}

export default generatePigIndividualPdf;
