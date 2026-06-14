type PdfLine = {
  description: string;
  code?: string | null;
  quantity?: number;
  unitPrice?: number;
  taxAmount?: number | null;
  total?: number;
  taxable?: boolean;
};

const pageWidth = 612;
const pageHeight = 792;

class PdfDoc {
  private pages: string[][] = [[]];

  addPage() {
    this.pages.push([]);
  }

  text(value: string, x: number, y: number, options: { size?: number; bold?: boolean; align?: "left" | "right" | "center"; color?: string } = {}) {
    const size = options.size || 10;
    const font = options.bold ? "F2" : "F1";
    const text = sanitize(value);
    const adjustedX = options.align === "right" ? x - textWidth(text, size) : options.align === "center" ? x - textWidth(text, size) / 2 : x;
    const color = options.color ? `${rgb(options.color).join(" ")} rg ` : "";
    this.op(`q ${color}BT /${font} ${size} Tf ${adjustedX.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(text)}) Tj ET Q`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "#111827", width = 1) {
    this.op(`q ${rgb(color).join(" ")} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S Q`);
  }

  rect(x: number, y: number, width: number, height: number, fill = false) {
    this.op(`${x} ${y} ${width} ${height} re ${fill ? "f" : "S"}`);
  }

  fillRect(x: number, y: number, width: number, height: number, color: string) {
    this.op(`q ${rgb(color).join(" ")} rg ${x} ${y} ${width} ${height} re f Q`);
  }

  strokeRect(x: number, y: number, width: number, height: number, color = "#CBD5E1", lineWidth = 1) {
    this.op(`q ${rgb(color).join(" ")} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S Q`);
  }

  gray(value: number) {
    this.op(`${value.toFixed(2)} g`);
  }

  black() {
    this.op("0 g");
  }

  wrap(value: string, x: number, y: number, width: number, lineHeight = 12, size = 9) {
    const lines = wrapLines(value, width, size);
    lines.forEach((line, index) => this.text(line, x, y - index * lineHeight, { size }));
    return y - Math.max(lines.length, 1) * lineHeight;
  }

  toBuffer() {
    const objects: string[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages /Kids [${this.pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${this.pages.length} >>`,
    ];

    this.pages.forEach((ops, index) => {
      const contentObject = 4 + index * 2;
      const content = ops.join("\n");
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + this.pages.length * 2} 0 R /F2 ${4 + this.pages.length * 2} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    });

    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf);
  }

  private op(value: string) {
    this.pages[this.pages.length - 1].push(value);
  }
}

export function createInvoicePdf(invoice: any) {
  const doc = new PdfDoc();
  const paid = invoice.payments?.filter((payment: any) => payment.status !== "CANCELLED").reduce((sum: number, payment: any) => sum + payment.amount, 0) || 0;
  const balance = Math.max(Number(invoice.total || 0) - paid, 0);
  const lines: PdfLine[] = invoice.items || [];

  drawInvoiceHeader(doc, invoice);
  let y = 560;

  doc.fillRect(40, y, 532, 24, "#047857");
  doc.text("Codigo", 48, y + 8, { size: 8, bold: true, color: "#FFFFFF" });
  doc.text("Descripcion", 100, y + 8, { size: 8, bold: true, color: "#FFFFFF" });
  doc.text("Cant.", 360, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("Precio", 430, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("ISV", 492, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("Total", 562, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  y -= 18;

  lines.forEach((line, index) => {
    const descriptionLines = wrapLines(line.description || "-", 245, 8);
    const rowHeight = Math.max(26, 16 + descriptionLines.length * 10);
    if (y - rowHeight < 162) {
      doc.addPage();
      drawDocumentTitle(doc, "FACTURA", invoice.fiscalNumber || invoice.invoiceNumber || "-");
      drawInvoiceTableHeader(doc, 710);
      y = 710;
      y -= 18;
    }
    if (index % 2 === 0) {
      doc.fillRect(40, y - rowHeight + 8, 532, rowHeight, "#F0FDF4");
    }
    doc.line(40, y - rowHeight + 6, 572, y - rowHeight + 6, "#DCFCE7", 0.5);
    doc.text(line.code || (line as any).itemCode || "-", 48, y, { size: 8, color: "#047857" });
    descriptionLines.forEach((description, lineIndex) => doc.text(description, 100, y - lineIndex * 10, { size: 8, color: "#334155" }));
    doc.text(String(line.quantity || 1), 360, y, { size: 8, align: "right", color: "#334155" });
    doc.text(money(line.unitPrice || 0), 430, y, { size: 8, align: "right", color: "#334155" });
    doc.text(line.taxable ? money(line.taxAmount || (line as any).tax || 0) : "Exento", 492, y, { size: 8, align: "right", color: "#334155" });
    doc.text(money(line.total || 0), 562, y, { size: 8, align: "right", color: "#064E3B", bold: true });
    y -= rowHeight;
  });

  drawInvoiceTotals(doc, invoice, paid, balance);
  return doc.toBuffer();
}

export function createPrescriptionPdf(prescription: any) {
  const doc = new PdfDoc();
  drawDocumentTitle(doc, "RECETA MEDICA", `REC-${String(prescription.correlative).padStart(4, "0")}`);

  drawPrescriptionPatientBox(doc, prescription);

  let y = 548;
  doc.text("Medicamentos e indicaciones", 40, y, { size: 12, bold: true, color: "#064E3B" });
  y -= 22;
  prescription.items.forEach((item: any, index: number) => {
    const doseText = `Dosis: ${item.dosage || "-"} | Frecuencia: ${item.frequency || "-"} | Duracion: ${item.duration || "-"}`;
    const presentationLines = wrapLines(`Presentacion: ${item.presentation || "-"}`, 475, 9);
    const doseLines = wrapLines(doseText, 475, 9);
    const cardHeight = Math.max(64, 34 + presentationLines.length * 12 + doseLines.length * 12);

    if (y - cardHeight < 130) {
      doc.addPage();
      drawDocumentTitle(doc, "RECETA MEDICA", `REC-${String(prescription.correlative).padStart(4, "0")}`);
      y = 690;
    }
    doc.fillRect(40, y - cardHeight + 12, 532, cardHeight, "#FFFFFF");
    doc.strokeRect(40, y - cardHeight + 12, 532, cardHeight, "#DCFCE7");
    doc.text(`${index + 1}. ${item.drugName}`, 55, y, { size: 11, bold: true, color: "#047857" });
    let lineY = y - 18;
    presentationLines.forEach((line) => {
      doc.text(line, 65, lineY, { size: 9, color: "#334155" });
      lineY -= 12;
    });
    doseLines.forEach((line) => {
      doc.text(line, 65, lineY, { size: 9, color: "#334155" });
      lineY -= 12;
    });
    y -= cardHeight + 10;
  });

  if (y < 135) {
    doc.addPage();
    drawDocumentTitle(doc, "RECETA MEDICA", `REC-${String(prescription.correlative).padStart(4, "0")}`);
  }
  doc.line(350, 105, 540, 105, "#047857", 1);
  doc.text("Firma y sello del odontologo", 382, 88, { size: 9, color: "#334155" });
  doc.text("Documento generado electronicamente desde DentalCare Pro.", 40, 50, { size: 8, color: "#64748B" });
  return doc.toBuffer();
}

export function createConsentPdf(consent: any) {
  const doc = new PdfDoc();
  drawDocumentTitle(doc, "CONSENTIMIENTO INFORMADO", `CONS-${String(consent.id || "").slice(0, 8).toUpperCase()}`);

  const patientName = consent.patient ? `${consent.patient.firstName} ${consent.patient.lastName}` : "-";
  const procedureName = consent.procedureLog?.procedureType?.name || "Procedimiento odontologico";
  const signedDate = consent.signedAt || consent.createdAt || new Date();

  doc.fillRect(40, 618, 532, 84, "#F0FDF4");
  doc.strokeRect(40, 618, 532, 84, "#86EFAC");
  doc.text("Paciente", 55, 675, { size: 8, bold: true, color: "#047857" });
  doc.text(patientName, 55, 658, { size: 11, color: "#0F172A" });
  doc.text("Documento", 330, 675, { size: 8, bold: true, color: "#047857" });
  doc.text(consent.patient?.documentNumber || "-", 330, 658, { size: 11, color: "#0F172A" });
  doc.text("Procedimiento", 55, 632, { size: 8, bold: true, color: "#047857" });
  doc.text(procedureName, 55, 616, { size: 11, color: "#0F172A" });
  doc.text("Fecha", 430, 632, { size: 8, bold: true, color: "#047857" });
  doc.text(formatDate(signedDate), 430, 616, { size: 11, color: "#0F172A" });

  let y = 565;
  doc.text("Declaracion de consentimiento", 40, y, { size: 12, bold: true, color: "#064E3B" });
  y -= 22;
  y = doc.wrap(consent.description || "El paciente declara haber recibido informacion suficiente sobre el procedimiento, beneficios, riesgos, alternativas y cuidados posteriores.", 40, y, 532, 13, 10);
  y -= 22;

  doc.text("Confirmaciones", 40, y, { size: 11, bold: true, color: "#064E3B" });
  y -= 20;
  [
    "He tenido oportunidad de realizar preguntas y recibir respuestas claras.",
    "Comprendo los riesgos, beneficios y alternativas explicadas.",
    "Autorizo la realizacion del procedimiento indicado.",
    "Acepto que este documento se registre electronicamente en DentalCare Pro.",
  ].forEach((line) => {
    doc.text(`- ${line}`, 55, y, { size: 9, color: "#334155" });
    y -= 15;
  });

  y -= 20;
  doc.line(55, y, 250, y, "#047857", 1);
  doc.line(330, y, 525, y, "#047857", 1);
  doc.text(consent.signerName || patientName, 78, y - 17, { size: 9, color: "#334155" });
  doc.text("Firma del paciente o responsable", 70, y - 32, { size: 8, color: "#64748B" });
  doc.text("Firma y sello de la clinica", 370, y - 32, { size: 8, color: "#64748B" });
  doc.text(`Estado: ${consent.status || "SIGNED"}`, 40, 55, { size: 8, bold: true, color: "#047857" });
  return doc.toBuffer();
}

function drawInvoiceHeader(doc: PdfDoc, invoice: any) {
  drawDocumentTitle(doc, "FACTURA", invoice.fiscalNumber || invoice.invoiceNumber || "-");
  doc.fillRect(40, 610, 255, 92, "#F0FDF4");
  doc.strokeRect(40, 610, 255, 92, "#86EFAC");
  doc.fillRect(40, 688, 255, 14, "#D1FAE5");
  doc.text("Datos fiscales", 55, 692, { size: 9, bold: true, color: "#064E3B" });
  doc.text(`CAI: ${invoice.cai || "-"}`, 55, 662, { size: 8, color: "#334155" });
  doc.text(`Rango: ${invoice.rangeStart || "-"} al ${invoice.rangeEnd || "-"}`, 55, 648, { size: 8, color: "#334155" });
  doc.text(`Limite emision: ${invoice.emissionDeadline ? formatDate(invoice.emissionDeadline) : "-"}`, 55, 634, { size: 8, color: "#334155" });
  doc.text("Original: Cliente / Copia: Emisor", 55, 620, { size: 8, color: "#64748B" });

  doc.fillRect(315, 610, 257, 92, "#FFFFFF");
  doc.strokeRect(315, 610, 257, 92, "#86EFAC");
  doc.fillRect(315, 688, 257, 14, "#D1FAE5");
  doc.text("Cliente", 330, 692, { size: 9, bold: true, color: "#064E3B" });
  doc.text(invoice.customerName || `${invoice.patient.firstName} ${invoice.patient.lastName}`, 330, 662, { size: 9, color: "#0F172A", bold: true });
  doc.text(`Documento/RTN: ${invoice.customerRtn || invoice.customerIdentity || invoice.patient.documentNumber || "-"}`, 330, 648, { size: 8, color: "#334155" });
  doc.text(`Direccion: ${invoice.customerAddress || "-"}`, 330, 634, { size: 8, color: "#334155" });
  doc.text(`Fecha: ${formatDate(invoice.issueDate)}`, 330, 620, { size: 8, color: "#334155" });
}

function drawInvoiceTableHeader(doc: PdfDoc, y: number) {
  doc.fillRect(40, y, 532, 24, "#047857");
  doc.text("Codigo", 48, y + 8, { size: 8, bold: true, color: "#FFFFFF" });
  doc.text("Descripcion", 100, y + 8, { size: 8, bold: true, color: "#FFFFFF" });
  doc.text("Cant.", 360, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("Precio", 430, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("ISV", 492, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
  doc.text("Total", 562, y + 8, { size: 8, bold: true, align: "right", color: "#FFFFFF" });
}

function drawPrescriptionPatientBox(doc: PdfDoc, prescription: any) {
  doc.fillRect(40, 608, 532, 96, "#F0FDF4");
  doc.strokeRect(40, 608, 532, 96, "#86EFAC");
  doc.fillRect(40, 690, 532, 14, "#D1FAE5");
  doc.text("Datos del paciente y emisor", 55, 694, { size: 9, bold: true, color: "#064E3B" });
  doc.text("Paciente", 55, 670, { size: 8, bold: true, color: "#047857" });
  doc.text(truncate(`${prescription.patient.firstName} ${prescription.patient.lastName}`, 34), 55, 654, { size: 11, color: "#0F172A" });
  doc.text("Codigo", 280, 670, { size: 8, bold: true, color: "#047857" });
  doc.text(truncate(prescription.patient.patientCode || "-", 18), 280, 654, { size: 11, color: "#0F172A" });
  doc.text("Documento", 405, 670, { size: 8, bold: true, color: "#047857" });
  doc.text(truncate(prescription.patient.documentNumber || "-", 22), 405, 654, { size: 11, color: "#0F172A" });
  doc.text("Doctor", 55, 632, { size: 8, bold: true, color: "#047857" });
  doc.text(truncate(`Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`, 42), 55, 616, { size: 11, color: "#0F172A" });
  doc.text("Fecha", 405, 632, { size: 8, bold: true, color: "#047857" });
  doc.text(formatDate(prescription.date), 405, 616, { size: 11, color: "#0F172A" });
}

function drawDocumentTitle(doc: PdfDoc, title: string, number: string) {
  doc.fillRect(0, 735, pageWidth, 57, "#064E3B");
  doc.fillRect(0, 735, pageWidth, 6, "#34D399");
  doc.fillRect(40, 751, 30, 28, "#10B981");
  doc.text("DC", 48, 759, { size: 11, bold: true, color: "#FFFFFF" });
  doc.text("DentalCare Pro", 80, 765, { size: 18, bold: true, color: "#FFFFFF" });
  doc.text("Clinica odontologica integral", 80, 748, { size: 9, color: "#D1FAE5" });
  doc.text(title, 572, 765, { size: 16, bold: true, align: "right", color: "#FFFFFF" });
  doc.text(number, 572, 748, { size: 10, align: "right", color: "#A7F3D0" });
}

function drawInvoiceTotals(doc: PdfDoc, invoice: any, paid: number, balance: number) {
  const x = 360;
  let y = 125;
  doc.fillRect(340, 26, 232, 118, "#F0FDF4");
  doc.strokeRect(340, 26, 232, 118, "#86EFAC");
  doc.line(40, 145, 572, 145, "#86EFAC", 1);
  [
    ["Importe exento", invoice.exemptAmount],
    ["Importe gravado 15%", invoice.taxable15],
    ["ISV 15%", invoice.isv15 || invoice.tax],
    ["Subtotal", invoice.subtotal],
    ["Impuesto", invoice.tax],
    ["Total", invoice.total],
    ["Pagado", paid],
    ["Saldo", balance],
  ].forEach(([label, value]) => {
    const isTotal = label === "Total";
    doc.text(String(label), x, y, { size: isTotal ? 10 : 8, bold: isTotal, color: isTotal ? "#064E3B" : "#334155" });
    doc.text(money(Number(value || 0)), 562, y, { size: isTotal ? 10 : 8, bold: isTotal, align: "right", color: isTotal ? "#064E3B" : "#334155" });
    y -= 15;
  });
  doc.text(`Total en letras: ${invoice.totalInWords || "-"}`, 40, 110, { size: 8, color: "#334155" });
  doc.text(`Estado: ${invoice.status}`, 40, 94, { size: 8, bold: true, color: "#047857" });
  doc.text("Gracias por su preferencia.", 40, 55, { size: 9, color: "#64748B" });
}

function escapePdf(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function sanitize(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrapLines(value: string, width: number, size: number) {
  const words = sanitize(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

function truncate(value: string, maxLength: number) {
  const text = sanitize(value);
  return text.length > maxLength ? `${text.slice(0, Math.max(maxLength - 3, 1))}...` : text;
}

function textWidth(value: string, size: number) {
  return sanitize(value).length * size * 0.48;
}

function rgb(hex: string) {
  const value = hex.replace("#", "");
  const bigint = parseInt(value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value, 16);
  const red = ((bigint >> 16) & 255) / 255;
  const green = ((bigint >> 8) & 255) / 255;
  const blue = (bigint & 255) / 255;
  return [red.toFixed(3), green.toFixed(3), blue.toFixed(3)];
}

function money(value: number) {
  return `L ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value: string | Date) {
  return value ? new Date(value).toLocaleDateString("es-HN") : "-";
}
