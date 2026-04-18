/**
 * app.js
 * Main application controller.
 *
 * New in this version:
 *   - Per-line LED colour selection
 *   - Text outline toggle per line
 *   - LED routing guide in PDF (tube paths, start arrows, adhesive dots, strip lengths)
 */

class NeonSignApp {

  constructor() {
    this.canvasMgr   = null;
    this.pdfExporter = new PDFExporter();
    this.suggestions = null;

    // Active line being edited in the colour panel
    this.activeLineIdx = 0;

    this.state = {
      text:          'OPEN',
      fontId:        'pacifico',
      fontSize:      80,
      width:         500,
      height:        200,
      backingStyle:  'none',
      backingShape:  'rect',
      padding:       20,
      radius:        15,
      strokeWidth:   2,
      backingColor:  '#ffffff',
      tubeWidth:     3,
      includeRouting: true
    };
  }

  // ── Bootstrap ─────────────────────────────────────────

  async init() {
    this._populateFontPicker();
    this._populateColorGrid();

    await document.fonts.ready;

    this.canvasMgr = new CanvasManager('main-canvas');

    this.suggestions = new SuggestionEngine(
      document.getElementById('suggestions-list'),
      (fontId, colorId) => this._applySuggestion(fontId, colorId)
    );

    this._applyStateToCanvas();
    this.suggestions.render(this.state.text);
    this._updateLineColorUI();
    this._updateStripEstimates();
    this._bindEvents();

    requestAnimationFrame(() => this.canvasMgr.fitToFrame());
    this._updateTileInfo();
  }

  // ── Populate controls ─────────────────────────────────

  _populateFontPicker() {
    const list = document.getElementById('font-picker-list');
    const btn  = document.getElementById('font-picker-btn');
    const picker = document.getElementById('font-picker');

    NEON_FONTS.forEach(f => {
      const item = document.createElement('div');
      item.className   = 'font-picker-item' + (f.id === this.state.fontId ? ' active' : '');
      item.dataset.fontId = f.id;

      const nameEl = document.createElement('span');
      nameEl.className   = 'font-picker-item-name';
      nameEl.textContent = f.name;
      nameEl.style.fontFamily = `'${f.family}', cursive`;

      const check = document.createElement('span');
      check.className   = 'font-picker-check';
      check.textContent = '✓';

      item.appendChild(nameEl);
      item.appendChild(check);
      item.addEventListener('click', () => this._setFont(f.id));
      list.appendChild(item);
    });

    btn.addEventListener('click', e => {
      e.stopPropagation();
      picker.classList.toggle('open');
    });
    document.addEventListener('click', () => picker.classList.remove('open'));

    // Set initial label font
    const init = NEON_FONTS.find(f => f.id === this.state.fontId) || NEON_FONTS[0];
    const lbl  = document.getElementById('font-picker-current');
    lbl.textContent = init.name;
    lbl.style.fontFamily = `'${init.family}', cursive`;

    this._updateFontPreview();
  }

  /** Central font-change handler — updates state, picker UI, canvas, previews. */
  _setFont(fontId) {
    const font = NEON_FONTS.find(f => f.id === fontId);
    if (!font) return;
    this.state.fontId = fontId;

    // Update trigger button label
    const lbl = document.getElementById('font-picker-current');
    if (lbl) {
      lbl.textContent = font.name;
      lbl.style.fontFamily = `'${font.family}', cursive`;
    }
    // Mark selected item
    document.querySelectorAll('.font-picker-item').forEach(el =>
      el.classList.toggle('active', el.dataset.fontId === fontId)
    );
    // Close picker
    document.getElementById('font-picker').classList.remove('open');

    if (this.canvasMgr) {
      this.canvasMgr.setFont(font.family);
      this._updateFontPreview();
      this._updateStripEstimates();
    }
  }

  _populateColorGrid() {
    const grid = document.getElementById('color-grid');
    NEON_COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className       = 'color-swatch';
      sw.style.background = swatchBackground(c);
      sw.title           = c.name;
      sw.dataset.colorId = c.id;
      sw.addEventListener('click', () => this._onColorSelect(c.id));
      grid.appendChild(sw);
    });
  }

  // ── Per-line colour UI ────────────────────────────────

  /**
   * Rebuild the line-selector chips to match the current number of text lines.
   * Called whenever text changes or a colour/outline changes.
   */
  _updateLineColorUI() {
    const container = document.getElementById('line-selector');
    const lineCount = this.canvasMgr ? this.canvasMgr.getLineCount() : 1;
    const colors    = this.canvasMgr ? this.canvasMgr.lineColors   : this.state.lineColors;
    const outlines  = this.canvasMgr ? this.canvasMgr.lineOutlines : [];

    container.innerHTML = '';

    for (let i = 0; i < lineCount; i++) {
      const col = colors[i] || colors[0];
      const out = outlines[i] || { enabled: false };
      const hex = col && col.hex !== 'linear' ? col.hex : '#FF1493';

      const chip = document.createElement('button');
      chip.className         = 'line-chip' + (i === this.activeLineIdx ? ' active' : '');
      chip.dataset.lineIndex = i;

      chip.innerHTML = `
        <span class="line-chip-dot" style="background:${hex}; box-shadow:0 0 6px ${hex}88"></span>
        <div class="line-chip-info">
          <div class="line-chip-num">Line ${i + 1}</div>
          <div class="line-chip-color-name">${col ? (col.name || hex) : hex}</div>
        </div>
        <div class="line-chip-badges">
          <span class="badge-outline${out.enabled ? ' on' : ''}" data-line="${i}" title="Toggle outline for line ${i+1}">
            ${out.enabled ? '◉ Outline ON' : '○ Outline'}
          </span>
        </div>
      `;

      // Click chip body → set active line
      chip.addEventListener('click', e => {
        if (e.target.closest('.badge-outline')) return; // handled separately
        this._setActiveLine(i);
      });

      // Click outline badge → toggle outline for this line
      chip.querySelector('.badge-outline').addEventListener('click', e => {
        e.stopPropagation();
        this._toggleLineOutline(i);
      });

      container.appendChild(chip);
    }

    // Sync the outline sub-controls to the active line
    this._syncOutlineControls();

    // Sync color swatch highlights to active line's color
    this._highlightActiveLineColor();
  }

  /** Set which line is currently being edited. */
  _setActiveLine(idx) {
    this.activeLineIdx = idx;
    document.querySelectorAll('.line-chip').forEach((chip, i) => {
      chip.classList.toggle('active', i === idx);
    });
    this._syncOutlineControls();
    this._highlightActiveLineColor();
  }

  /** Reflect the active line's current colour in the colour grid. */
  _highlightActiveLineColor() {
    const colors = this.canvasMgr ? this.canvasMgr.lineColors : [];
    const col    = colors[this.activeLineIdx] || colors[0];

    document.querySelectorAll('.color-swatch').forEach(sw => {
      const swCol = NEON_COLORS.find(c => c.id === sw.dataset.colorId);
      sw.classList.toggle('active', !!swCol && col && swCol.hex === col.hex);
    });

    if (col) {
      const desc = NEON_COLORS.find(c => c.hex === col.hex);
      document.getElementById('color-desc').textContent =
        desc ? desc.description : (col.name || col.hex);
    }
  }

  /** Push the active line's outline settings into the outline sub-controls. */
  _syncOutlineControls() {
    const outlines = this.canvasMgr ? this.canvasMgr.lineOutlines : [];
    const out      = outlines[this.activeLineIdx] || { enabled: false, widthMM: 2, color: '#ffffff' };

    const toggle   = document.getElementById('inp-outline-toggle');
    const sub      = document.getElementById('outline-sub-controls');
    const widthSlider = document.getElementById('inp-outline-width');
    const colorPicker = document.getElementById('inp-outline-color');
    const colorLabel  = document.getElementById('outline-color-label');
    const widthLabel  = document.getElementById('val-outline-width');

    toggle.checked       = out.enabled;
    sub.classList.toggle('hidden', !out.enabled);
    widthSlider.value    = out.widthMM;
    colorPicker.value    = out.color || '#ffffff';
    colorLabel.textContent = out.color || '#ffffff';
    widthLabel.textContent  = (out.widthMM || 2) + ' mm';
  }

  /** Toggle the outline for line i (from the badge button). */
  _toggleLineOutline(lineIdx) {
    if (!this.canvasMgr) return;
    const out = this.canvasMgr.lineOutlines[lineIdx] || { enabled: false, widthMM: 2, color: '#ffffff' };
    const newEnabled = !out.enabled;
    this.canvasMgr.setLineOutline(lineIdx, newEnabled, out.widthMM, out.color);
    this._updateLineColorUI();
    if (lineIdx === this.activeLineIdx) this._syncOutlineControls();
    this._updateStripEstimates();
  }

  // ── Strip length estimates ─────────────────────────────

  /** Rebuild the strip estimate rows in the Layout tab. */
  _updateStripEstimates() {
    const el = document.getElementById('strip-estimates');
    if (!el || !this.canvasMgr) return;

    const font   = NEON_FONTS.find(f => f.id === this.state.fontId) || NEON_FONTS[0];
    const factor = font.stripFactor || 1.7;
    const geo    = this.canvasMgr.getLineGeometry();

    el.innerHTML = '';
    geo.forEach((line, i) => {
      const col    = this.canvasMgr.lineColors[i] || this.canvasMgr.lineColors[0];
      const hex    = col && col.hex !== 'linear' ? col.hex : '#FF1493';
      const estMM  = Math.round(line.widthMM * factor / 10) * 10;

      const row = document.createElement('div');
      row.className = 'strip-row';
      row.innerHTML = `
        <span class="strip-dot" style="background:${hex}; box-shadow:0 0 5px ${hex}77"></span>
        <span class="strip-label">Line ${i + 1} · ${col ? (col.name || hex) : hex}</span>
        <span class="strip-length">~${estMM} mm</span>
      `;
      el.appendChild(row);
    });
  }

  // ── Event binding ─────────────────────────────────────

  _bindEvents() {
    // Text
    document.getElementById('inp-text').addEventListener('input', e => {
      this.state.text = e.target.value;
      this.canvasMgr.setText(e.target.value);
      this.suggestions.render(e.target.value);
      this._updateLineColorUI();
      this._updateStripEstimates();
    });

    // Font — handled via _setFont() called from the custom font-picker items

    // Font size
    document.getElementById('inp-font-size').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      this.state.fontSize = v;
      document.getElementById('val-font-size').textContent = v + ' mm';
      this.canvasMgr.setFontSize(v);
      this._updateStripEstimates();
    });

    // Dimensions
    ['inp-width', 'inp-height'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this._onDimChange());
      document.getElementById(id).addEventListener('input',  () => this._updateTileInfo());
    });

    // Backing style
    document.getElementById('backing-style-group').addEventListener('click', e => {
      const btn = e.target.closest('.btn-opt');
      if (!btn) return;
      document.querySelectorAll('#backing-style-group .btn-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.state.backingStyle = btn.dataset.val;
      this.canvasMgr.setBackingStyle(btn.dataset.val);
    });

    // Backing shape type (rect / ellipse)
    document.getElementById('backing-shape-group').addEventListener('click', e => {
      const btn = e.target.closest('.btn-opt');
      if (!btn) return;
      document.querySelectorAll('#backing-shape-group .btn-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const shape = btn.dataset.val;
      this.state.backingShape = shape;
      this.canvasMgr.setBackingShape(shape);
      // Corner radius is only meaningful for rect
      document.getElementById('corner-radius-row').style.display = shape === 'circle' ? 'none' : '';
    });

    document.getElementById('inp-padding').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('val-padding').textContent = v + ' mm';
      this.canvasMgr.setBackingPadding(v);
    });
    document.getElementById('inp-radius').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('val-radius').textContent = v + ' mm';
      this.canvasMgr.setCornerRadius(v);
    });
    document.getElementById('inp-stroke').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('val-stroke').textContent = v + ' mm';
      this.canvasMgr.setStrokeWidth(v);
    });
    document.getElementById('inp-backing-color').addEventListener('input', e => {
      this.state.backingColor = e.target.value;
      document.getElementById('backing-color-label').textContent = e.target.value;
      this.canvasMgr.setBackingColor(e.target.value);
    });

    // ── Outline controls (active line) ──
    document.getElementById('inp-outline-toggle').addEventListener('change', e => {
      const out = this.canvasMgr.lineOutlines[this.activeLineIdx] || { widthMM: 2, color: '#ffffff' };
      this.canvasMgr.setLineOutline(this.activeLineIdx, e.target.checked, out.widthMM, out.color);
      document.getElementById('outline-sub-controls').classList.toggle('hidden', !e.target.checked);
      this._updateLineColorUI();
    });

    document.getElementById('inp-outline-width').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      document.getElementById('val-outline-width').textContent = v + ' mm';
      const out = this.canvasMgr.lineOutlines[this.activeLineIdx] || {};
      this.canvasMgr.setLineOutline(this.activeLineIdx, out.enabled, v, out.color);
    });

    document.getElementById('inp-outline-color').addEventListener('input', e => {
      document.getElementById('outline-color-label').textContent = e.target.value;
      const out = this.canvasMgr.lineOutlines[this.activeLineIdx] || {};
      this.canvasMgr.setLineOutline(this.activeLineIdx, out.enabled, out.widthMM, e.target.value);
    });

    // Canvas background swatches
    const BG_COLORS = { dark: '#0c0c18', grass: '#2d5e17' };
    document.getElementById('bg-swatches').addEventListener('click', e => {
      const btn = e.target.closest('.bg-swatch');
      if (!btn) return;
      document.querySelectorAll('.bg-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const bgId = btn.dataset.bg;
      this.canvasMgr.setCanvasBackground(BG_COLORS[bgId]);
      const scroll = document.getElementById('canvas-scroll');
      scroll.classList.toggle('bg-grass', bgId === 'grass');
    });

    // Routing guide toggle + tube width
    document.getElementById('inp-routing-toggle').addEventListener('change', e => {
      this.state.includeRouting = e.target.checked;
    });
    document.getElementById('inp-tube-width').addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      this.state.tubeWidth = v;
      document.getElementById('val-tube-width').textContent = v + ' mm';
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        // Refresh estimates when layout tab opened
        if (btn.dataset.tab === 'layout') this._updateStripEstimates();
      });
    });

    // Zoom
    document.getElementById('btn-zoom-in').addEventListener('click',  () => this.canvasMgr.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.canvasMgr.zoomOut());
    document.getElementById('btn-zoom-fit').addEventListener('click', () => this.canvasMgr.fitToFrame());

    // Export + Reset
    document.getElementById('btn-export').addEventListener('click', () => this._onExport());
    document.getElementById('btn-reset').addEventListener('click',  () => this._onReset());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === '=') { e.preventDefault(); this.canvasMgr.zoomIn(); }
      if (e.ctrlKey && e.key === '-') { e.preventDefault(); this.canvasMgr.zoomOut(); }
      if (e.ctrlKey && e.key === '0') { e.preventDefault(); this.canvasMgr.fitToFrame(); }
      if (e.ctrlKey && e.key === 'p') { e.preventDefault(); this._onExport(); }
    });

    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.canvasMgr.fitToFrame(), 200);
    });
  }

  // ── Event handlers ────────────────────────────────────

  _onColorSelect(colorId) {
    const color = NEON_COLORS.find(c => c.id === colorId);
    if (!color || !this.canvasMgr) return;

    // Apply to the active line
    this.canvasMgr.setLineColor(
      this.activeLineIdx,
      color.hex,
      color.glow,
      color.glowOpacity,
      color.name
    );

    document.getElementById('color-desc').textContent = color.description;
    this._updateLineColorUI();
    this._updateStripEstimates();
  }

  _onDimChange() {
    const w = Math.max(20, parseInt(document.getElementById('inp-width').value,  10) || 500);
    const h = Math.max(20, parseInt(document.getElementById('inp-height').value, 10) || 200);
    this.state.width  = w;
    this.state.height = h;
    this.canvasMgr.setSignDimensions(w, h);
    this._updateTileInfo();
  }

  async _onExport() {
    const overlay = document.getElementById('export-overlay');
    const msg     = document.getElementById('overlay-msg');
    overlay.classList.add('active');

    try {
      msg.textContent = 'Rendering design…';
      const designSvg = await this.canvasMgr.getBWExportSVG();

      let routingSvg = null;
      if (this.state.includeRouting) {
        msg.textContent = 'Rendering routing guide…';
        routingSvg = await this.canvasMgr.getRoutingGuideSVG(this.state.tubeWidth);
      }

      const grid  = this.pdfExporter.getTileGrid(this.state.width, this.state.height);
      const total = grid.total * (this.state.includeRouting ? 2 : 1);
      msg.textContent = `Tiling ${total} page(s) into PDF…`;

      const label = (this.state.text || 'sign').trim().split('\n')[0].slice(0, 30);
      const result = await this.pdfExporter.export({
        designSvg,
        routingSvg,
        signW:          this.state.width,
        signH:          this.state.height,
        lineGeometry:   this.canvasMgr.getLineGeometry(),
        lineColors:     this.canvasMgr.lineColors,
        fontId:         this.state.fontId,
        signLabel:      label,
        includeRouting: this.state.includeRouting
      });

      overlay.classList.remove('active');
      this._toast(
        `PDF saved — ${result.total} design + ${this.state.includeRouting ? result.total : 0} routing pages`,
        'success'
      );

    } catch (err) {
      overlay.classList.remove('active');
      console.error('PDF export failed:', err);
      this._toast('Export failed — see browser console', 'error');
    }
  }

  _applySuggestion(fontId, colorId) {
    const font  = NEON_FONTS.find(f => f.id  === fontId);
    const color = NEON_COLORS.find(c => c.id === colorId);
    if (!font || !color) return;

    // Apply the chosen colour to all lines
    this.canvasMgr.lineColors.forEach((_, i) => {
      this.canvasMgr.setLineColor(i, color.hex, color.glow, color.glowOpacity, color.name);
    });
    this._setFont(fontId);   // updates state, picker label, canvas font, preview

    this._updateLineColorUI();
    this._updateStripEstimates();
    this._toast(`Applied: ${font.name} + ${color.name}`);
  }

  _onReset() {
    document.getElementById('inp-text').value      = 'OPEN';
    document.getElementById('inp-font-size').value = '80';
    document.getElementById('inp-width').value     = '500';
    document.getElementById('inp-height').value    = '200';
    document.getElementById('inp-padding').value   = '20';
    document.getElementById('inp-radius').value    = '15';
    document.getElementById('inp-stroke').value    = '2';
    document.getElementById('inp-backing-color').value = '#ffffff';
    document.getElementById('inp-routing-toggle').checked = true;
    document.getElementById('inp-tube-width').value = '3';

    document.getElementById('val-font-size').textContent  = '80 mm';
    document.getElementById('val-padding').textContent    = '20 mm';
    document.getElementById('val-radius').textContent     = '15 mm';
    document.getElementById('val-stroke').textContent     = '2 mm';
    document.getElementById('val-tube-width').textContent = '3 mm';
    document.getElementById('backing-color-label').textContent = '#ffffff';

    document.querySelectorAll('#backing-style-group .btn-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.val === 'none');
    });
    document.querySelectorAll('#backing-shape-group .btn-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.val === 'rect');
    });
    document.getElementById('corner-radius-row').style.display = '';

    this.state = {
      text: 'OPEN', fontId: 'pacifico', fontSize: 80,
      width: 500, height: 200,
      backingStyle: 'none', backingShape: 'rect', padding: 20, radius: 15, strokeWidth: 2, backingColor: '#ffffff',
      tubeWidth: 3, includeRouting: true
    };
    this.activeLineIdx = 0;

    this._applyStateToCanvas();
    this._setFont('pacifico');   // resets picker label + selected item
    this.suggestions.render('OPEN');
    this._updateFontPreview();
    this._updateTileInfo();
    this._toast('Reset to defaults');
  }

  // ── Helpers ───────────────────────────────────────────

  _applyStateToCanvas() {
    const font  = NEON_FONTS.find(f => f.id  === this.state.fontId)  || NEON_FONTS[0];
    const color = NEON_COLORS.find(c => c.id === 'hot-pink') || NEON_COLORS[0];

    this.canvasMgr.setFont(font.family);
    this.canvasMgr.setFontSize(this.state.fontSize);
    this.canvasMgr.setText(this.state.text);
    // Set all existing line colours to the default
    this.canvasMgr.lineColors.forEach((_, i) => {
      this.canvasMgr.setLineColor(i, color.hex, color.glow, color.glowOpacity, color.name);
    });
    this.canvasMgr.setSignDimensions(this.state.width, this.state.height);
    this.canvasMgr.setBackingStyle(this.state.backingStyle);
    this.canvasMgr.setBackingShape(this.state.backingShape);
    this.canvasMgr.setBackingPadding(this.state.padding);
    this.canvasMgr.setCornerRadius(this.state.radius);
    this.canvasMgr.setStrokeWidth(this.state.strokeWidth);
    this.canvasMgr.setBackingColor(this.state.backingColor);

    this._updateLineColorUI();
    this._updateStripEstimates();
  }

  _updateFontPreview() {
    const font = NEON_FONTS.find(f => f.id === this.state.fontId);
    if (!font) return;
    const box  = document.getElementById('font-preview-box');
    const col  = this.canvasMgr ? this.canvasMgr.lineColors[0] : null;
    const hex  = col && col.hex !== 'linear' ? col.hex : '#FF1493';
    box.style.fontFamily = `'${font.family}', cursive`;
    box.textContent      = (this.state.text || 'Preview').split('\n')[0];
    box.style.color      = hex;
    box.style.textShadow = `0 0 10px ${hex}99, 0 0 28px ${hex}55`;
    document.getElementById('font-meta').textContent = font.description;
  }

  _updateTileInfo() {
    const w = parseInt(document.getElementById('inp-width').value,  10) || 500;
    const h = parseInt(document.getElementById('inp-height').value, 10) || 200;
    const { cols, rows, total } = this.pdfExporter.getTileGrid(w, h);

    document.getElementById('tile-badge-text').textContent =
      total === 1 ? '1 A4 sheet needed' : `${cols} × ${rows} grid = ${total} A4 sheets`;
    document.getElementById('tile-display').textContent =
      total === 1 ? '1×1 tile (1 A4)' : `${cols}×${rows} tiles (${total} A4)`;
    document.getElementById('sign-dims-display').textContent = `${w} × ${h} mm`;
  }

  _toast(message, type = '') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className   = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
  }
}

// ── Bootstrap ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new NeonSignApp();
  app.init().catch(console.error);
});
