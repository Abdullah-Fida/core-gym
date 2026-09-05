
/**
 * Branded PDF reports.
 *
 * Deliberately monochrome plus one accent: these get printed, and a dark-themed
 * screen palette on paper wastes toner and reads badly. Colours here are fixed
 * rather than read from the live theme for the same reason.
 *
 * jsPDF is imported dynamically — it pulls in html2canvas and a font subset,
 * about 400 kB, which should not load for users who never export a PDF.
 */

const INK = [17, 24, 39];
const MUTED = [107, 114, 128];
const ACCENT = [2, 132, 199];
const LINE = [229, 231, 235];

const A4_WIDTH = 210;
const MARGIN = 14;

function header(doc, { gymName, title, subtitle }) {
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, A4_WIDTH, 3, 'F');

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(gymName || 'Gym', MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(title, MARGIN, 25);

  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, MARGIN, 30);
  }

  doc.setFontSize(8);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    A4_WIDTH - MARGIN,
    18,
    { align: 'right' }
  );

  doc.setDrawColor(...LINE);
  doc.line(MARGIN, subtitle ? 34 : 29, A4_WIDTH - MARGIN, subtitle ? 34 : 29);

  return subtitle ? 40 : 35;
}

function footer(doc) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Page ${i} of ${pages}`,
      A4_WIDTH / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }
}

/** A row of headline figures above the table. */
function summaryRow(doc, y, stats) {
  if (!stats?.length) return y;

  const boxWidth = (A4_WIDTH - MARGIN * 2 - (stats.length - 1) * 4) / stats.length;

  stats.forEach((s, i) => {
    const x = MARGIN + i * (boxWidth + 4);
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'FD');

    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(String(s.label).toUpperCase(), x + 3, y + 6);

    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s.value), x + 3, y + 14);
  });

  return y + 26;
}

/**
 * Build and save a report.
 *
 * `columns` is [{ label, key, format?, align? }] — the same shape the CSV
 * export uses, so a list view can offer both from one definition.
 */
export async function generateReport({
  gymName,
  title,
  subtitle,
  stats,
  columns,
  rows,
  filename,
  orientation = 'portrait',
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

  let y = header(doc, { gymName, title, subtitle });
  y = summaryRow(doc, y, stats);

  if (rows.length) {
    autoTable(doc, {
      startY: y,
      head: [columns.map((c) => c.label)],
      body: rows.map((row) => columns.map((c) => (c.format ? c.format(row) : String(row[c.key] ?? '')))),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: columns.reduce(
        (acc, c, i) => (c.align ? { ...acc, [i]: { halign: c.align } } : acc),
        {}
      ),
      margin: { left: MARGIN, right: MARGIN },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text('No records for this period.', MARGIN, y + 6);
  }

  footer(doc);
  doc.save(`${filename}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
