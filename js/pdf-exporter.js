/**
 * pdf-exporter.js
 * Generates a production-ready, 1:1 scale, tiled A4 PDF.
 *
 * ══ PDF STRUCTURE ══════════════════════════════════════════════
 *
 *  Section 1 — Design pages
 *    Tiled 1:1 vector design pages with registration marks,
 *    overlap zones, and 30mm calibration rule.
 *
 *  Section 2 — LED Routing Guide pages  (optional)
 *    Same tile grid, white background. Shows:
 *      • Acrylic cut outline (black)
 *      • LED tube paths per line (thick coloured strokes)
 *      • ▶ START arrows at each line's left edge
 *      • ● Adhesive dot markers every 50 mm
 *      • Numbered circles ① ② … per line
 *      • Light 50-mm grid overlay
 *
 *  Section 3 — Production Summary  (1 page, always at the end)
 *    • Strip length estimates per line
 *    • Numbered assembly instructions
 *    • Colour legend
 *    • Scale verification bar
 *
 * ══ TILING MATHS ═══════════════════════════════════════════════
 *
 *  A4 page:     210 × 297 mm
 *  Page margin: 12 mm (all sides)
 *  Printable:   186 × 273 mm
 *  Overlap:      10 mm between adjacent tiles
 *  Tile step:   176 × 263 mm
 *
 *  cols = 1                         if signW ≤ 186
 *  cols = ⌈(signW − 10) / 176⌉     otherwise
 *  (same logic for rows)
 */

class PDFExporter {

  constructor() {
    this.PX_PER_MM = 3;
    this.A4_W      = 210;
    this.A4_H      = 297;
    this.MARGIN    = 12;
    this.OVERLAP   = 10;
    this.PRINT_W   = this.A4_W - 2 * this.MARGIN;   // 186 mm
    this.PRINT_H   = this.A4_H - 2 * this.MARGIN;   // 273 mm
    this.STEP_W    = this.PRINT_W - this.OVERLAP;    // 176 mm
    this.STEP_H    = this.PRINT_H - this.OVERLAP;    // 263 mm
  }

  getTileGrid(signW, signH) {
    const cols = signW <= this.PRINT_W ? 1 : Math.ceil((signW - this.OVERLAP) / this.STEP_W);
    const rows = signH <= this.PRINT_H ? 1 : Math.ceil((signH - this.OVERLAP) / this.STEP_H);
    return { cols, rows, total: cols * rows };
  }

  /**
   * @param {string}   designSvg        Full-canvas SVG (white bg, from getSVGforExport)
   * @param {string}   routingSvg       Routing guide SVG (from getRoutingGuideSVG)
   * @param {number}   signW / signH    Physical sign size in mm
   * @param {Array}    lineGeometry     From canvasMgr.getLineGeometry()
   * @param {Array}    lineColors       From canvasMgr.lineColors
   * @param {string}   fontId           Current font id
   * @param {string}   signLabel        Label used in filenames & footers
   * @param {boolean}  includeRouting   Whether to append routing + summary pages
   */
  async export({
    designSvg, routingSvg,
    signW, signH,
    lineGeometry, lineColors,
    fontId, signLabel = 'Sign',
    includeRouting = true
  }) {
    const { jsPDF } = window.jspdf;
    const svgToPdf  = this._getSvg2PdfFn();
    const grid      = this.getTileGrid(signW, signH);
    const doc       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let   firstPage = true;

    // ══ SECTION 1: Design pages ════════════════════════════════
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        if (!firstPage) doc.addPage('a4', 'portrait');
        firstPage = false;

        const ext = this._tileExtents(col, row, signW, signH);
        await this._renderSvgTile(doc, svgToPdf, designSvg, ext);
        this._drawRegMarks(doc, col, row, grid, ext.tileW, ext.tileH);
        this._drawScaleRule(doc);
        this._drawFooter(doc, col, row, grid, signW, signH, signLabel, 'DESIGN');
      }
    }

    // ══ SECTION 2: LED Routing Guide pages ════════════════════
    if (includeRouting && routingSvg) {
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          doc.addPage('a4', 'portrait');

          // Off-white tint distinguishes routing pages from design pages
          doc.setFillColor(252, 252, 248);
          doc.rect(0, 0, this.A4_W, this.A4_H, 'F');

          const ext = this._tileExtents(col, row, signW, signH);
          await this._renderSvgTile(doc, svgToPdf, routingSvg, ext);
          this._drawRegMarks(doc, col, row, grid, ext.tileW, ext.tileH);
          this._drawScaleRule(doc);
          this._drawFooter(doc, col, row, grid, signW, signH, signLabel, 'LED ROUTING GUIDE');
        }
      }

      // ══ SECTION 3: Production Summary (always 1 page) ════════
      doc.addPage('a4', 'portrait');
      this._drawSummaryPage(doc, lineGeometry, lineColors, fontId, signLabel, signW, signH, grid);
    }

    const filename = `neonforge-${signLabel.replace(/\W+/g, '-').toLowerCase()}-${signW}x${signH}mm.pdf`;
    doc.save(filename);
    return { ...grid, filename };
  }

  // ── SVG tile rendering ────────────────────────────────────────

  _getSvg2PdfFn() {
    const s = window.svg2pdf;
    if (!s) throw new Error('svg2pdf.js not loaded');
    return (typeof s === 'function') ? s : (s.svg2pdf || s.default);
  }

  _tileExtents(col, row, signW, signH) {
    const startX = col === 0 ? 0 : col * this.STEP_W;
    const startY = row === 0 ? 0 : row * this.STEP_H;
    const tileW  = Math.min(this.PRINT_W, signW - startX);
    const tileH  = Math.min(this.PRINT_H, signH - startY);
    return { startX, startY, tileW, tileH };
  }

  async _renderSvgTile(doc, svgToPdf, svgString, { startX, startY, tileW, tileH }) {
    const vb  = `${startX * this.PX_PER_MM} ${startY * this.PX_PER_MM} ${tileW * this.PX_PER_MM} ${tileH * this.PX_PER_MM}`;
    let mod   = svgString.replace(/(<svg\b[^>]*?)\s+viewBox="[^"]*"/, `$1 viewBox="${vb}"`);
    if (!mod.includes('viewBox=')) mod = mod.replace('<svg ', `<svg viewBox="${vb}" `);

    const div = document.createElement('div');
    div.innerHTML = mod;
    const el  = div.querySelector('svg');
    if (!el) throw new Error('Could not parse SVG');
    el.removeAttribute('width');
    el.removeAttribute('height');
    el.style.cssText = 'position:absolute;top:-99999px;left:-99999px';
    document.body.appendChild(el);

    try {
      await svgToPdf(el, doc, { x: this.MARGIN, y: this.MARGIN, width: tileW, height: tileH });
    } finally {
      document.body.removeChild(el);
    }
  }

  // ── Registration marks ────────────────────────────────────────

  _drawRegMarks(doc, col, row, grid, tileW, tileH) {
    const M = this.MARGIN, OL = this.OVERLAP;

    doc.setDrawColor(0);
    doc.setLineWidth(0.25);

    // Crosshairs at tile corners
    [[M, M], [M + tileW, M], [M, M + tileH], [M + tileW, M + tileH]].forEach(([x, y]) => {
      doc.line(x - 5, y, x + 5, y);
      doc.line(x, y - 5, x, y + 5);
      doc.circle(x, y, 1.5, 'S');
    });

    // Dashed overlap-zone boundary lines
    doc.setDrawColor(170);
    doc.setLineWidth(0.18);

    if (col < grid.cols - 1 && tileW >= this.PRINT_W) {
      const x = M + this.PRINT_W - OL;
      this._dashed(doc, x, M, x, M + tileH);
      doc.setFontSize(5); doc.setTextColor(160);
      doc.text('◄ OVERLAP', x - 1, M + tileH - 4, { align: 'right' });
    }
    if (col > 0) {
      const x = M + OL;
      this._dashed(doc, x, M, x, M + tileH);
      doc.setFontSize(5); doc.setTextColor(160);
      doc.text('OVERLAP ►', x + 1, M + tileH - 4);
    }
    if (row < grid.rows - 1 && tileH >= this.PRINT_H) {
      this._dashed(doc, M, M + this.PRINT_H - OL, M + tileW, M + this.PRINT_H - OL);
    }
    if (row > 0) {
      this._dashed(doc, M, M + OL, M + tileW, M + OL);
    }

    doc.setDrawColor(0); doc.setTextColor(0);
  }

  _dashed(doc, x1, y1, x2, y2, dash = 1.5, gap = 1.5) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len, uy = dy / len;
    let d = 0;
    while (d < len) {
      const e = Math.min(d + dash, len);
      doc.line(x1 + ux * d, y1 + uy * d, x1 + ux * e, y1 + uy * e);
      d += dash + gap;
    }
  }

  // ── 30 mm calibration rule ────────────────────────────────────

  _drawScaleRule(doc) {
    const rx = this.MARGIN, ry = this.A4_H - 9, len = 30;
    doc.setLineWidth(0.4); doc.setDrawColor(80);
    doc.line(rx, ry, rx + len, ry);
    doc.line(rx, ry - 1.5, rx, ry + 1.5);
    doc.line(rx + len, ry - 1.5, rx + len, ry + 1.5);
    doc.line(rx + len / 2, ry - 0.8, rx + len / 2, ry + 0.8);
    doc.setFontSize(6); doc.setTextColor(80);
    doc.text('|← 30 mm verify 100% scale →|', rx + len / 2, ry - 2, { align: 'center' });
    doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.25);
  }

  // ── Page footer ───────────────────────────────────────────────

  _drawFooter(doc, col, row, grid, signW, signH, label, section) {
    const n = row * grid.cols + col + 1;
    doc.setFontSize(6); doc.setTextColor(120);
    doc.text(`NeonForge | ${section} | ${label} | ${signW}×${signH}mm`,
      this.MARGIN, this.A4_H - 4);
    doc.text(`Tile ${n}/${grid.total}  (col ${col + 1}/${grid.cols}, row ${row + 1}/${grid.rows})`,
      this.A4_W - this.MARGIN, this.A4_H - 4, { align: 'right' });
    doc.text('↑ Align crosshairs when joining tiles',
      this.A4_W / 2, this.A4_H - 4, { align: 'center' });
    doc.setTextColor(0);
  }

  // ══ SUMMARY PAGE ══════════════════════════════════════════════

  _drawSummaryPage(doc, lineGeometry, lineColors, fontId, label, signW, signH, grid) {
    const font   = NEON_FONTS.find(f => f.id === fontId) || NEON_FONTS[0];
    const factor = font.stripFactor || 1.7;
    const M      = this.MARGIN;
    const A4_W   = this.A4_W;
    let   y      = M;

    // ── Page header ──────────────────────────────────────
    doc.setFillColor(15, 15, 25);
    doc.rect(0, 0, A4_W, 22, 'F');
    doc.setFontSize(14); doc.setTextColor(233, 69, 96);
    doc.setFont(undefined, 'bold');
    doc.text('NeonForge', M, 10);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9); doc.setTextColor(180, 180, 200);
    doc.text('LED Production Summary', M, 17);
    doc.setFontSize(9); doc.setTextColor(255);
    doc.text(`${label}  ·  ${signW} × ${signH} mm  ·  ${font.name} font`, A4_W - M, 10, { align: 'right' });
    doc.text(`${grid.total} design tile(s)  +  ${grid.total} routing tile(s)  +  this summary`, A4_W - M, 17, { align: 'right' });

    y = 30;

    // ── Strip length table ───────────────────────────────
    doc.setTextColor(0); doc.setFont(undefined, 'normal');
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text('STRIP LENGTH ESTIMATES', M, y);
    y += 1;
    doc.setLineWidth(0.3); doc.setDrawColor(233, 69, 96);
    doc.line(M, y, M + 70, y);
    y += 4;
    doc.setFont(undefined, 'normal');

    const col0 = M, col1 = M + 10, col2 = M + 50, col3 = M + 100, col4 = M + 145;
    const rh   = 7;

    // Table header
    doc.setFillColor(25, 25, 40);
    doc.rect(M, y, A4_W - 2 * M, rh, 'F');
    doc.setTextColor(255); doc.setFontSize(7); doc.setFont(undefined, 'bold');
    [['', col0], ['Line', col1], ['LED Colour', col2], ['Est. Length', col3], ['Strip Type / Notes', col4]].forEach(
      ([t, x]) => doc.text(t, x + 2, y + 5)
    );
    doc.setFont(undefined, 'normal');

    let totalMM = 0;

    lineGeometry.forEach((line, i) => {
      const col    = lineColors[i] || lineColors[0];
      const hex    = col && col.hex !== 'linear' ? col.hex : '#FF1493';
      const estMM  = Math.round(line.widthMM * factor / 10) * 10;
      totalMM     += estMM;
      const ry     = y + rh + i * rh;

      if (i % 2 === 1) { doc.setFillColor(245, 245, 252); doc.rect(M, ry, A4_W - 2 * M, rh, 'F'); }

      // Colour swatch
      const rgb = this._hexRgb(hex);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(col0 + 2, ry + 2, 5, rh - 3, 'F');
      doc.setDrawColor(200); doc.setLineWidth(0.1);
      doc.rect(col0 + 2, ry + 2, 5, rh - 3, 'S');

      doc.setTextColor(30); doc.setFontSize(7);
      doc.text(`L${i + 1}`,                    col1 + 2, ry + 5);
      doc.text(col ? (col.name || hex) : hex,  col2 + 2, ry + 5);
      doc.text(`~${estMM} mm`,                 col3 + 2, ry + 5);
      doc.text(`${font.category} · ${font.ledNotes.split('—')[0].trim()}`, col4 + 2, ry + 5);

      doc.setDrawColor(220); doc.setLineWidth(0.1);
      doc.line(M, ry + rh, A4_W - M, ry + rh);
    });

    // Total row
    const totalRowY = y + rh + lineGeometry.length * rh;
    doc.setFillColor(15, 15, 25);
    doc.rect(M, totalRowY, A4_W - 2 * M, rh, 'F');
    doc.setTextColor(255); doc.setFont(undefined, 'bold'); doc.setFontSize(7);
    doc.text('TOTAL', col1 + 2, totalRowY + 5);
    doc.text(`~${totalMM} mm  (estimate ±20% — measure with tape before ordering)`, col2 + 2, totalRowY + 5);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.25);

    y = totalRowY + rh + 8;

    // ── Colour legend ────────────────────────────────────
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text('COLOUR LEGEND', M, y);
    y += 1;
    doc.setDrawColor(233, 69, 96); doc.setLineWidth(0.3);
    doc.line(M, y, M + 45, y);
    y += 5; doc.setFont(undefined, 'normal');

    const swatchSize = 8;
    const perRow     = 4;
    lineGeometry.forEach((line, i) => {
      const col = lineColors[i] || lineColors[0];
      const hex = col && col.hex !== 'linear' ? col.hex : '#FF1493';
      const rgb = this._hexRgb(hex);
      const cx  = M + (i % perRow) * 46;
      const cy  = y + Math.floor(i / perRow) * (swatchSize + 10);

      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(cx, cy, swatchSize * 2, swatchSize, 'F');
      doc.setDrawColor(180); doc.setLineWidth(0.15);
      doc.rect(cx, cy, swatchSize * 2, swatchSize, 'S');

      doc.setTextColor(0); doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(`L${i + 1}`, cx + swatchSize - 1, cy + swatchSize / 2 + 2, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.text(col ? (col.name || hex) : hex, cx, cy + swatchSize + 3.5);
    });
    doc.setDrawColor(0);

    const legendRows = Math.ceil(lineGeometry.length / perRow);
    y += legendRows * (swatchSize + 10) + 6;

    // ── Assembly instructions ────────────────────────────
    doc.setFontSize(9); doc.setFont(undefined, 'bold');
    doc.text('ASSEMBLY INSTRUCTIONS', M, y);
    y += 1;
    doc.setDrawColor(233, 69, 96); doc.setLineWidth(0.3);
    doc.line(M, y, M + 65, y);
    y += 5; doc.setFont(undefined, 'normal'); doc.setDrawColor(0); doc.setLineWidth(0.25);

    const steps = [
      ['1', 'VERIFY SCALE', 'Measure the 30 mm calibration bar at the bottom of every page. Must be exactly 30 mm. If not, reprint at 100% with "fit to page" disabled.'],
      ['2', 'ASSEMBLE TILES', 'Print all design pages. Align adjacent tiles at their registration crosshair marks. The dashed line indicates the 10 mm overlap zone — align and tape from behind.'],
      ['3', 'MARK ACRYLIC', 'Place the assembled design sheet under your perspex sheet. Trace the solid black backing outline onto the acrylic with a fine marker.'],
      ['4', 'ROUTE ACRYLIC', 'Cut the acrylic along the marked outline. Allow 1–2 mm for the router bit offset if using a CNC router.'],
      ['5', 'MOUNT ROUTING GUIDE', 'Print the LED routing guide pages (same tile assembly). Place under the cut acrylic. The LED tube paths are now visible through the clear acrylic.'],
      ['6', 'ROUTE EACH STRIP', 'Starting at each ▶ START arrow, bend and route your LED strip along the coloured tube path, one line at a time. Match the colour shown to your strip inventory.'],
      ['7', 'GLUE STRIP', 'Apply clear silicone adhesive or 5 mm double-sided foam tape at each ● dot marker (every 50 mm along the strip). Press firmly and hold for 30 seconds.'],
      ['8', 'MINIMUM BEND RADIUS', 'Standard LED strips: ~25 mm min bend radius. DO NOT force tighter curves — the strip PCB may crack. For tight script curves, use rope-style LED.'],
      ['9', 'WIRING', 'Connect each numbered strip segment ① ② … to your controller/driver. Check polarity before powering on.'],
    ];

    const stepColW  = A4_W - 2 * M;
    const numW      = 7;
    const labelW    = 32;
    const descW     = stepColW - numW - labelW - 4;
    const stepLineH = 5;

    steps.forEach(([num, head, desc]) => {
      if (y > 270) return; // guard against overflow on very long descriptions
      const lineCount = Math.ceil(desc.length / 80);
      const boxH = Math.max(8, lineCount * stepLineH + 2);

      doc.setFillColor(20, 20, 35);
      doc.rect(M, y, numW + 1, boxH, 'F');
      doc.setTextColor(233, 69, 96); doc.setFont(undefined, 'bold'); doc.setFontSize(8);
      doc.text(num, M + (numW + 1) / 2, y + boxH / 2 + 2.5, { align: 'center' });

      doc.setTextColor(0); doc.setFont(undefined, 'bold'); doc.setFontSize(7);
      doc.text(head, M + numW + 3, y + 5);

      doc.setFont(undefined, 'normal'); doc.setFontSize(6.5); doc.setTextColor(50);
      const lines = doc.splitTextToSize(desc, descW);
      doc.text(lines, M + numW + labelW + 3, y + 5);

      doc.setTextColor(0);
      doc.setDrawColor(235); doc.setLineWidth(0.1);
      doc.line(M, y + boxH, A4_W - M, y + boxH);

      y += boxH;
    });

    // ── Scale rule + footer ──────────────────────────────
    this._drawScaleRule(doc);
    doc.setFontSize(6); doc.setTextColor(120);
    doc.text(`NeonForge Production Summary  |  ${label}  |  ${signW}×${signH}mm  |  Font: ${font.name}`,
      A4_W / 2, this.A4_H - 4, { align: 'center' });
    doc.setTextColor(0);
  }

  // ── Utilities ─────────────────────────────────────────────────

  _hexRgb(hex) {
    const h = (hex || '#aaaaaa').replace('#', '');
    if (h.length < 6) return { r: 170, g: 170, b: 170 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
}
