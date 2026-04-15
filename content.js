(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const RULER_SIZE = 20;       // px — width of left ruler / height of top ruler
  const NS = '__al__';         // CSS id/class namespace

  // ─── State ────────────────────────────────────────────────────────────────
  let overlay       = null;
  let topCanvas     = null;
  let leftCanvas    = null;
  let linesLayer    = null;
  let isEnabled     = false;
  let dragging      = false;
  let dragKind      = null;    // 'h' | 'v'
  let activeColor   = null;
  let activeLine    = null;

  // ─── Colour helper ────────────────────────────────────────────────────────
  function brightColor() {
    const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    const h = hues[Math.floor(Math.random() * hues.length)];
    // high saturation, mid-high lightness → always vivid and visible
    return `hsl(${h}, 100%, 55%)`;
  }

  // ─── Build DOM ────────────────────────────────────────────────────────────
  function buildOverlay() {
    overlay = el('div', {
      id: NS + '_overlay',
      style: css({
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        2147483647,
        overflow:      'hidden',
      }),
    });

    // Corner square where the two rulers meet
    overlay.appendChild(el('div', {
      style: css({
        position:      'fixed',
        top:           0,
        left:          0,
        width:         px(RULER_SIZE),
        height:        px(RULER_SIZE),
        background:    '#111122',
        borderRight:   '1px solid #383858',
        borderBottom:  '1px solid #383858',
        pointerEvents: 'none',
        zIndex:        3,
      }),
    }));

    // Top ruler canvas (horizontal measurements)
    topCanvas = el('canvas', {
      style: css({
        position:      'fixed',
        top:           0,
        left:          px(RULER_SIZE),
        height:        px(RULER_SIZE),
        display:       'block',
        pointerEvents: 'all',
        cursor:        'crosshair',
        zIndex:        2,
      }),
    });
    topCanvas.addEventListener('mousedown', onTopMouseDown);
    overlay.appendChild(topCanvas);

    // Left ruler canvas (vertical measurements)
    leftCanvas = el('canvas', {
      style: css({
        position:      'fixed',
        top:           px(RULER_SIZE),
        left:          0,
        width:         px(RULER_SIZE),
        display:       'block',
        pointerEvents: 'all',
        cursor:        'crosshair',
        zIndex:        2,
      }),
    });
    leftCanvas.addEventListener('mousedown', onLeftMouseDown);
    overlay.appendChild(leftCanvas);

    // Layer that holds all placed guide lines
    linesLayer = el('div', {
      style: css({
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
        zIndex:        1,
      }),
    });
    overlay.appendChild(linesLayer);

    document.documentElement.appendChild(overlay);
    fitRulers();
    window.addEventListener('resize', fitRulers);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ─── Ruler sizing & drawing ───────────────────────────────────────────────
  function fitRulers() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    topCanvas.width  = vw - RULER_SIZE;
    topCanvas.height = RULER_SIZE;
    topCanvas.style.width = px(vw - RULER_SIZE);

    leftCanvas.width  = RULER_SIZE;
    leftCanvas.height = vh - RULER_SIZE;
    leftCanvas.style.height = px(vh - RULER_SIZE);

    drawTopRuler();
    drawLeftRuler();
  }

  function drawTopRuler() {
    const ctx = topCanvas.getContext('2d');
    const W = topCanvas.width;
    const H = RULER_SIZE;
    const scrollX = Math.round(window.scrollX);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, W, H);

    // Bottom border
    ctx.strokeStyle = '#383858';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();

    // Scale everything to ruler height
    const fontSize   = Math.max(9, Math.floor(H * 0.24));
    const tickLong   = Math.floor(H * 0.55);
    const tickMed    = Math.floor(H * 0.35);
    const tickShort  = Math.floor(H * 0.18);

    ctx.strokeStyle  = '#666688';
    ctx.fillStyle    = '#9999bb';
    ctx.font         = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    ctx.lineWidth    = 1;

    for (let x = 0; x < W; x++) {
      const doc = x + scrollX + RULER_SIZE;  // document X coordinate

      if (doc % 100 === 0) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, H - tickLong);
        ctx.lineTo(x + 0.5, H - 1);
        ctx.stroke();
        ctx.fillText(String(doc), x + 2, 2);
      } else if (doc % 50 === 0) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, H - tickMed);
        ctx.lineTo(x + 0.5, H - 1);
        ctx.stroke();
      } else if (doc % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, H - tickShort);
        ctx.lineTo(x + 0.5, H - 1);
        ctx.stroke();
      }
    }
  }

  function drawLeftRuler() {
    const ctx = leftCanvas.getContext('2d');
    const W = RULER_SIZE;
    const H = leftCanvas.height;
    const scrollY = Math.round(window.scrollY);

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, W, H);

    // Right border
    ctx.strokeStyle = '#383858';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W - 0.5, 0);
    ctx.lineTo(W - 0.5, H);
    ctx.stroke();

    // Scale everything to ruler width
    const fontSize   = Math.max(9, Math.floor(W * 0.24));
    const tickLong   = Math.floor(W * 0.55);
    const tickMed    = Math.floor(W * 0.35);
    const tickShort  = Math.floor(W * 0.18);
    // Center labels in the space left of the longest tick
    const labelCX    = Math.floor((W - tickLong) / 2);

    ctx.strokeStyle  = '#666688';
    ctx.fillStyle    = '#9999bb';
    ctx.font         = `${fontSize}px monospace`;
    ctx.lineWidth    = 1;

    for (let y = 0; y < H; y++) {
      const doc = y + scrollY + RULER_SIZE;  // document Y coordinate

      if (doc % 100 === 0) {
        ctx.beginPath();
        ctx.moveTo(W - tickLong, y + 0.5);
        ctx.lineTo(W - 1, y + 0.5);
        ctx.stroke();

        // Rotated label — translate to the label centre, rotate, draw centred
        ctx.save();
        ctx.translate(labelCX, y);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(doc), 0, 0);
        ctx.restore();
      } else if (doc % 50 === 0) {
        ctx.beginPath();
        ctx.moveTo(W - tickMed, y + 0.5);
        ctx.lineTo(W - 1, y + 0.5);
        ctx.stroke();
      } else if (doc % 10 === 0) {
        ctx.beginPath();
        ctx.moveTo(W - tickShort, y + 0.5);
        ctx.lineTo(W - 1, y + 0.5);
        ctx.stroke();
      }
    }
  }

  function onScroll() {
    drawTopRuler();
    drawLeftRuler();
  }

  // ─── Drag to place lines ──────────────────────────────────────────────────
  function onTopMouseDown(e) {
    e.preventDefault();
    startDrag('h', e.clientY);
  }

  function onLeftMouseDown(e) {
    e.preventDefault();
    startDrag('v', e.clientX);
  }

  function startDrag(kind, pos) {
    dragging   = true;
    dragKind   = kind;
    activeColor = brightColor();
    activeLine  = makeLine(kind, pos, activeColor);
    linesLayer.appendChild(activeLine);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  function onMove(e) {
    if (!dragging || !activeLine) return;
    if (dragKind === 'h') {
      activeLine.style.top  = px(e.clientY);
    } else {
      activeLine.style.left = px(e.clientX);
    }
  }

  function onUp() {
    dragging   = false;
    activeLine = null;
    dragKind   = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }

  function makeLine(kind, pos, color) {
    const d = el('div');
    if (kind === 'h') {
      d.style.cssText = css({
        position:      'fixed',
        left:          0,
        top:           px(pos),
        width:         '100%',
        height:        '1px',
        background:    color,
        boxShadow:     `0 0 3px ${color}`,
        pointerEvents: 'none',
      });
    } else {
      d.style.cssText = css({
        position:      'fixed',
        top:           0,
        left:          px(pos),
        width:         '1px',
        height:        '100%',
        background:    color,
        boxShadow:     `0 0 3px ${color}`,
        pointerEvents: 'none',
      });
    }
    return d;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  function enable() {
    if (!overlay) buildOverlay();
    overlay.style.display = 'block';
    isEnabled = true;
  }

  function disable() {
    if (overlay) overlay.style.display = 'none';
    isEnabled = false;
  }

  function clearLines() {
    if (linesLayer) linesLayer.innerHTML = '';
  }

  // ─── Message bridge ───────────────────────────────────────────────────────
  browser.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'toggle':
        isEnabled ? disable() : enable();
        return Promise.resolve({ enabled: isEnabled });

      case 'clear':
        clearLines();
        return Promise.resolve({ ok: true });

      case 'getState':
        return Promise.resolve({ enabled: isEnabled });
    }
  });

  // ─── Tiny DOM helpers ─────────────────────────────────────────────────────
  function el(tag, props = {}) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style') node.style.cssText = v;
      else node[k] = v;
    }
    return node;
  }

  // Converts a plain object to an inline-style string.
  // Numeric values are left as-is (already px strings) or converted.
  function css(obj) {
    return Object.entries(obj)
      .map(([k, v]) => {
        const prop = k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
        return `${prop}:${v}`;
      })
      .join(';');
  }

  function px(n) { return typeof n === 'number' ? n + 'px' : n; }

})();
