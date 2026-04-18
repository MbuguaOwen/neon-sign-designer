/**
 * canvas-manager.js
 * Manages the Fabric.js canvas:
 *   - Multi-line text, each line with its own LED colour and optional outline
 *   - Acrylic backing shape
 *   - CSS-transform zoom for display
 *   - getRoutingGuideSVG() for the production mounting guide
 *
 * Coordinate system: 1 canvas pixel = 1/PX_PER_MM mm
 * PX_PER_MM = 3, so 500 mm sign → 1500 px canvas width.
 */

class CanvasManager {

  constructor(canvasId) {
    this.PX_PER_MM = 3;

    // Sign physical dimensions (mm)
    this.signWidth  = 500;
    this.signHeight = 200;

    // Global text style
    this.fontFamily = 'Pacifico';
    this.fontSize   = 80;   // mm

    // Per-line state (arrays, parallel to text lines)
    this.lineColors  = [{ hex: '#FF1493', glow: '#FF1493', glowOp: 0.75, name: 'Hot Pink' }];
    this.lineOutlines= [{ enabled: false, widthMM: 2, color: '#ffffff' }];
    this.lineObjs    = [];   // fabric.Text per line

    // Backing
    this.backingStyle  = 'none';
    this.backingShape  = 'rect';   // 'rect' | 'circle'
    this.backingPad    = 20;
    this.cornerRadius  = 15;
    this.strokeWidthMM = 2;
    this.backingColor  = '#ffffff';
    this.backingObj    = null;

    this.rawText   = 'OPEN';
    this.zoomLevel = 1.0;

    this.canvas = new fabric.Canvas(canvasId, {
      width:             this._px(this.signWidth),
      height:            this._px(this.signHeight),
      backgroundColor:   '#0c0c18',
      selection:         false,
      renderOnAddRemove: false
    });

    this._initBacking();
    this._rebuildLines();
  }

  // ── Unit helpers ──────────────────────────────────────

  _px(mm)  { return mm * this.PX_PER_MM; }
  _mm(px)  { return px / this.PX_PER_MM; }

  // ── Backing ───────────────────────────────────────────

  _initBacking() {
    // backing object is created on demand in _updateBacking()
  }

  _updateBacking() {
    // Remove existing backing object (type may change between rect/ellipse)
    if (this.backingObj) {
      this.canvas.remove(this.backingObj);
      this.backingObj = null;
    }

    if (this.backingStyle === 'none' || this.lineObjs.length === 0) {
      this.canvas.requestRenderAll();
      return;
    }

    // Combined bounding box of all lines
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.lineObjs.forEach(obj => {
      const b = obj.getBoundingRect(true);
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });

    const pad    = this._px(this.backingPad);
    const fill   = this.backingStyle === 'filled' ? this.backingColor : 'transparent';
    const stroke = this.backingColor;
    const sw     = this._px(this.strokeWidthMM);
    const shared = { fill, stroke, strokeWidth: sw, selectable: false, evented: false, id: 'backing' };

    if (this.backingShape === 'circle') {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const r  = Math.max((maxX - minX) / 2, (maxY - minY) / 2) + pad;
      this.backingObj = new fabric.Circle({
        left: cx - r,
        top:  cy - r,
        radius: r,
        ...shared
      });
    } else {
      this.backingObj = new fabric.Rect({
        left:   minX - pad,
        top:    minY - pad,
        width:  (maxX - minX) + 2 * pad,
        height: (maxY - minY) + 2 * pad,
        rx:     this._px(this.cornerRadius),
        ry:     this._px(this.cornerRadius),
        ...shared
      });
    }

    this.canvas.add(this.backingObj);
    this.canvas.sendToBack(this.backingObj);
    this.canvas.requestRenderAll();
  }

  // ── Line text objects ─────────────────────────────────

  /**
   * Rebuild all per-line Fabric.js text objects from rawText.
   * Syncs lineColors / lineOutlines arrays to the current line count.
   */
  _rebuildLines() {
    // Remove old text objects
    this.lineObjs.forEach(obj => this.canvas.remove(obj));
    this.lineObjs = [];

    const textLines = (this.rawText || ' ').split('\n');

    // Ensure lineColors/lineOutlines arrays are long enough
    while (this.lineColors.length < textLines.length) {
      const last = this.lineColors[this.lineColors.length - 1];
      this.lineColors.push({ ...last });
      this.lineOutlines.push({ ...this.lineOutlines[this.lineOutlines.length - 1] });
    }

    const cw = this.canvas.getWidth();
    const ch = this.canvas.getHeight();
    const fsPx = this._px(this.fontSize);
    const lineGapPx = fsPx * 0.18;  // spacing between lines

    // First pass: create objects to measure heights
    const tempObjs = textLines.map((t, i) => {
      const col = this.lineColors[i];
      const out = this.lineOutlines[i];
      const obj = new fabric.Text(t || ' ', {
        fontFamily:  this.fontFamily,
        fontSize:    fsPx,
        fill:        col.hex !== 'linear' ? col.hex : '#FF1493',
        textAlign:   'center',
        selectable:  false,
        evented:     false,
        originX:     'center',
        originY:     'top'
      });
      if (out && out.enabled) {
        obj.set({ stroke: out.color, strokeWidth: this._px(out.widthMM), paintFirst: 'stroke' });
      }
      obj.set('shadow', new fabric.Shadow({
        color:   col.glow || col.hex,
        blur:    this._px(10),
        offsetX: 0, offsetY: 0
      }));
      return obj;
    });

    // Calculate total block height to center vertically
    const totalH = tempObjs.reduce((s, o) => s + o.height, 0)
                 + lineGapPx * Math.max(0, tempObjs.length - 1);
    let curY = (ch - totalH) / 2;

    tempObjs.forEach((obj, i) => {
      obj.set({ left: cw / 2, top: curY });
      this.canvas.add(obj);
      this.lineObjs.push(obj);
      curY += obj.height + lineGapPx;
    });

    this._updateBacking();
    this.canvas.requestRenderAll();
  }

  _applyColorToLine(idx) {
    const obj = this.lineObjs[idx];
    const col = this.lineColors[idx];
    if (!obj || !col) return;
    const hex = col.hex !== 'linear' ? col.hex : '#FF1493';
    obj.set({
      fill:   hex,
      shadow: new fabric.Shadow({ color: col.glow || hex, blur: this._px(10), offsetX: 0, offsetY: 0 })
    });
    this.canvas.requestRenderAll();
  }

  _applyOutlineToLine(idx) {
    const obj = this.lineObjs[idx];
    const out = this.lineOutlines[idx];
    if (!obj || !out) return;
    if (out.enabled) {
      obj.set({ stroke: out.color, strokeWidth: this._px(out.widthMM), paintFirst: 'stroke' });
    } else {
      obj.set({ stroke: null, strokeWidth: 0 });
    }
    this.canvas.requestRenderAll();
  }

  // ── Public API ────────────────────────────────────────

  setText(text) {
    this.rawText = text || ' ';
    this._rebuildLines();
  }

  setFont(family) {
    this.fontFamily = family;
    this.lineObjs.forEach(obj => obj.set('fontFamily', family));
    this._updateBacking();
    this.canvas.requestRenderAll();
  }

  setFontSize(mm) {
    this.fontSize = mm;
    this._rebuildLines();
  }

  /** Set colour for a specific line index. */
  setLineColor(lineIdx, hex, glow, glowOp, name) {
    if (lineIdx >= this.lineColors.length) return;
    this.lineColors[lineIdx] = { hex, glow: glow || hex, glowOp: glowOp ?? 0.7, name: name || '' };
    this._applyColorToLine(lineIdx);
    this._updateBacking();
  }

  /** Toggle or configure text outline for a specific line. */
  setLineOutline(lineIdx, enabled, widthMM, color) {
    if (lineIdx >= this.lineOutlines.length) return;
    this.lineOutlines[lineIdx] = {
      enabled,
      widthMM: widthMM ?? this.lineOutlines[lineIdx].widthMM ?? 2,
      color:   color   ?? this.lineOutlines[lineIdx].color   ?? '#ffffff'
    };
    this._applyOutlineToLine(lineIdx);
  }

  setSignDimensions(widthMM, heightMM) {
    this.signWidth  = widthMM;
    this.signHeight = heightMM;
    this.canvas.setDimensions({ width: this._px(widthMM), height: this._px(heightMM) });
    this._rebuildLines();
    this.fitToFrame();
  }

  setCanvasBackground(color) {
    this.canvas.setBackgroundColor(color, () => this.canvas.requestRenderAll());
  }

  setBackingStyle(style)    { this.backingStyle   = style; this._updateBacking(); }
  setBackingShape(shape)    { this.backingShape   = shape; this._updateBacking(); }
  setBackingPadding(mm)     { this.backingPad      = mm;   this._updateBacking(); }
  setCornerRadius(mm)       { this.cornerRadius    = mm;   this._updateBacking(); }
  setStrokeWidth(mm)        { this.strokeWidthMM   = mm;   this._updateBacking(); }
  setBackingColor(hex)      { this.backingColor    = hex;  this._updateBacking(); }

  getLineCount() {
    return (this.rawText || '').split('\n').length;
  }

  /**
   * Return per-line geometry in mm (for PDF annotation positioning).
   * Coordinates are relative to the sign origin (0,0 = top-left of canvas).
   */
  getLineGeometry() {
    return this.lineObjs.map((obj, i) => {
      const b = obj.getBoundingRect(true);
      return {
        index:    i,
        text:     obj.text,
        leftMM:   this._mm(b.left),
        topMM:    this._mm(b.top),
        widthMM:  this._mm(b.width),
        heightMM: this._mm(b.height),
        midYMM:   this._mm(obj.top + obj.height / 2), // center Y
        color:    this.lineColors[i] || this.lineColors[0]
      };
    });
  }

  // ── Routing guide SVG ─────────────────────────────────

  /**
   * Generate a production mounting guide SVG:
   *   - White background with light grid
   *   - Acrylic backing outline in black
   *   - Text as LED "tubes" (thick colored stroke, no fill)
   *   - Start arrows at each line's left edge
   *   - Adhesive dot markers every 50mm along each line
   *   - Numbered circles labelling each line
   *
   * @param {number} tubeWidthMM - visual width of LED tube on guide (default 3mm)
   */
  async getRoutingGuideSVG(tubeWidthMM = 3) {
    const PX  = this.PX_PER_MM;
    const w   = this.canvas.getWidth();
    const h   = this.canvas.getHeight();
    const DOT_INTERVAL_PX = PX * 50;   // adhesive dot every 50mm
    const ARROW_SIZE_PX   = PX * 4.5;

    // Use fabric.StaticCanvas (no interaction, faster render)
    const tempEl     = document.createElement('canvas');
    const tempCanvas = new fabric.StaticCanvas(tempEl, {
      width: w, height: h, backgroundColor: '#ffffff',
      renderOnAddRemove: false
    });

    // Light grid lines every 50mm
    const gridColor = '#ebebeb';
    for (let x = 0; x <= w; x += PX * 50) {
      tempCanvas.add(new fabric.Line([x, 0, x, h], { stroke: gridColor, strokeWidth: 0.5, selectable: false, evented: false }));
    }
    for (let y = 0; y <= h; y += PX * 50) {
      tempCanvas.add(new fabric.Line([0, y, w, y], { stroke: gridColor, strokeWidth: 0.5, selectable: false, evented: false }));
    }

    // Backing outline (black, no fill — acrylic cut guide)
    if (this.backingStyle !== 'none' && this.backingObj) {
      const b = this.backingObj;
      const guideProps = {
        fill: 'transparent', stroke: '#1a1a1a', strokeWidth: PX * 1.5,
        selectable: false, evented: false
      };
      if (this.backingShape === 'circle') {
        tempCanvas.add(new fabric.Circle({
          left: b.left, top: b.top, radius: b.radius,
          ...guideProps
        }));
      } else {
        tempCanvas.add(new fabric.Rect({
          left: b.left, top: b.top, width: b.width, height: b.height,
          rx: b.rx, ry: b.ry,
          ...guideProps
        }));
      }
    }

    // LED tube paths + annotations per line
    this.lineObjs.forEach((textObj, i) => {
      const col    = this.lineColors[i] || this.lineColors[0];
      const hex    = col.hex !== 'linear' ? col.hex : '#FF1493';
      const bounds = textObj.getBoundingRect(true);

      // ── LED tube: thick stroke, no fill ──
      const tube = new fabric.Text(textObj.text, {
        left:        textObj.left,
        top:         textObj.top + textObj.height / 2,
        originX:     'center',
        originY:     'center',
        fontFamily:  textObj.fontFamily,
        fontSize:    textObj.fontSize,
        fill:        'transparent',
        stroke:      hex,
        strokeWidth: PX * tubeWidthMM,
        paintFirst:  'fill',
        selectable:  false, evented: false
      });
      tempCanvas.add(tube);

      // ── Line number circle (top-left of line) ──
      const circX = bounds.left + PX * 6;
      const circY = bounds.top  - PX * 8;
      tempCanvas.add(new fabric.Circle({
        left: circX, top: circY, originX: 'center', originY: 'center',
        radius: PX * 5, fill: hex, stroke: '#ffffff', strokeWidth: PX * 0.8,
        selectable: false, evented: false
      }));
      tempCanvas.add(new fabric.Text(String(i + 1), {
        left: circX, top: circY, originX: 'center', originY: 'center',
        fontFamily: 'Arial', fontSize: PX * 5.5, fontWeight: 'bold',
        fill: '#ffffff', selectable: false, evented: false
      }));

      // ── START arrow (triangle pointing right) ──
      const arrowX  = bounds.left - PX * 10;
      const arrowMY = textObj.top + textObj.height / 2;  // vertical midpoint
      const as      = ARROW_SIZE_PX;
      const arrowPts = [
        { x: arrowX - as, y: arrowMY - as * 0.7 },
        { x: arrowX + as, y: arrowMY },
        { x: arrowX - as, y: arrowMY + as * 0.7 }
      ];
      tempCanvas.add(new fabric.Polygon(arrowPts, {
        fill: hex, stroke: 'none', selectable: false, evented: false
      }));

      // ── START label ──
      tempCanvas.add(new fabric.Text('START', {
        left: arrowX - PX * 2, top: arrowMY - PX * 10,
        originX: 'center',
        fontFamily: 'Arial', fontSize: PX * 4, fill: '#444444',
        selectable: false, evented: false
      }));

      // ── Adhesive dot markers every 50mm along text ──
      const dotY     = textObj.top + textObj.height / 2;
      const lineLeft = bounds.left;
      const lineRight= bounds.left + bounds.width;
      let   dotX     = lineLeft + DOT_INTERVAL_PX / 2;
      let   dotCount = 0;
      while (dotX <= lineRight) {
        tempCanvas.add(new fabric.Circle({
          left: dotX, top: dotY,
          originX: 'center', originY: 'center',
          radius: PX * 1.8,
          fill: '#333333', stroke: 'none',
          selectable: false, evented: false
        }));
        dotCount++;
        dotX += DOT_INTERVAL_PX;
      }
    });

    // ── Legend labels for each line (bottom margin area) ──
    const legendY = h - PX * 5;
    const legendSpacing = w / (this.lineObjs.length + 1);
    this.lineObjs.forEach((obj, i) => {
      const col = this.lineColors[i] || this.lineColors[0];
      const hex = col.hex !== 'linear' ? col.hex : '#FF1493';
      const lx  = legendSpacing * (i + 1);

      tempCanvas.add(new fabric.Rect({
        left: lx, top: legendY, originX: 'center', originY: 'center',
        width: PX * 18, height: PX * 5, rx: PX * 1, ry: PX * 1,
        fill: hex, stroke: 'none', selectable: false, evented: false
      }));
      tempCanvas.add(new fabric.Text(`L${i + 1}: ${col.name || hex}`, {
        left: lx, top: legendY + PX * 5,
        originX: 'center', originY: 'top',
        fontFamily: 'Arial', fontSize: PX * 3.5, fill: '#333333',
        selectable: false, evented: false
      }));
    });

    tempCanvas.renderAll();
    const svg = tempCanvas.toSVG();
    tempCanvas.dispose();
    return svg;
  }

  // ── SVG export — black-and-white, no glow, high contrast ─

  async getBWExportSVG() {
    const w = this.canvas.getWidth();
    const h = this.canvas.getHeight();

    const tempEl     = document.createElement('canvas');
    const tempCanvas = new fabric.StaticCanvas(tempEl, {
      width: w, height: h, backgroundColor: '#ffffff',
      renderOnAddRemove: false
    });

    // Backing first (goes behind text)
    if (this.backingObj && this.backingStyle !== 'none') {
      const b    = this.backingObj;
      const fill = this.backingStyle === 'filled' ? '#eeeeee' : 'transparent';
      const bp   = { fill, stroke: '#000000', strokeWidth: this._px(this.strokeWidthMM), selectable: false, evented: false };
      let clone;
      if (this.backingShape === 'circle') {
        clone = new fabric.Circle({ left: b.left, top: b.top, radius: b.radius, ...bp });
      } else {
        clone = new fabric.Rect({ left: b.left, top: b.top, width: b.width, height: b.height, rx: b.rx, ry: b.ry, ...bp });
      }
      tempCanvas.add(clone);
    }

    // Text: solid black, no shadow, no glow
    this.lineObjs.forEach(obj => {
      tempCanvas.add(new fabric.Text(obj.text, {
        left:       obj.left,
        top:        obj.top,
        originX:    'center',
        originY:    'top',
        fontFamily: obj.fontFamily,
        fontSize:   obj.fontSize,
        fill:       '#000000',
        shadow:     null,
        stroke:     null,
        strokeWidth: 0,
        selectable: false,
        evented:    false
      }));
    });

    tempCanvas.renderAll();
    const svg = tempCanvas.toSVG();
    tempCanvas.dispose();
    return svg;
  }

  // ── SVG export (design, white bg for print) ───────────

  getSVGforExport() {
    return new Promise(resolve => {
      this.canvas.setBackgroundColor('#ffffff', () => {
        this.canvas.renderAll();
        const svg = this.canvas.toSVG();
        this.canvas.setBackgroundColor('#0c0c18', () => {
          this.canvas.renderAll();
        });
        resolve(svg);
      });
    });
  }

  // ── Zoom / viewport ───────────────────────────────────

  setZoom(level) {
    this.zoomLevel = Math.max(0.05, Math.min(4, level));
    const wrapper = this.canvas.wrapperEl;
    wrapper.style.transform       = `scale(${this.zoomLevel})`;
    wrapper.style.transformOrigin = 'top left';

    const frame = document.getElementById('canvas-frame');
    if (frame) {
      frame.style.width  = (this.canvas.getWidth()  * this.zoomLevel) + 'px';
      frame.style.height = (this.canvas.getHeight() * this.zoomLevel) + 'px';
    }
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = Math.round(this.zoomLevel * 100) + '%';
  }

  zoomIn()  { this.setZoom(this.zoomLevel * 1.25); }
  zoomOut() { this.setZoom(this.zoomLevel / 1.25); }

  fitToFrame() {
    const scroll = document.getElementById('canvas-scroll');
    if (!scroll) return;
    const availW = scroll.clientWidth  - 48;
    const availH = scroll.clientHeight - 48;
    const scale  = Math.min(availW / this.canvas.getWidth(), availH / this.canvas.getHeight(), 1);
    this.setZoom(scale);
  }
}
