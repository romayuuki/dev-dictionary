/**
 * SPEC-003 §5/§7 (تحديث) — لوحة رسم تفاعلية على طراز Obsidian Canvas:
 * أشكال (مربع/دائرة/مثلث) قابلة للسحب، كل شكل له لون حشو/حدود/نص مستقل ويمكن أن
 * يحوي نصاً أو كوداً، وأسهم بينها بلون مستقل. لا مكتبة خارجية — SVG + DOM عاديّان.
 *
 * البيانات تُخزَّن كـ JSON داخل كتلة كود ```canvas``` في `def` (نفس فكرة Mermaid) —
 * فتبقى نصّاً عادياً قابلاً للتصدير والبحث (مبدأ P4)، ويُعاد رسمها من الصفر عند العرض.
 */

export type ShapeType = 'rect' | 'ellipse' | 'triangle';

export interface CanvasShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  border: string;
  textColor: string;
  mono?: boolean; // كود بدل نص عادي
}

export interface CanvasArrow {
  id: string;
  fromId: string;
  toId: string;
  color: string;
}

export interface CanvasModel {
  width: number;
  height: number;
  shapes: CanvasShape[];
  arrows: CanvasArrow[];
}

const uid = (): string => 'c' + Math.random().toString(36).slice(2, 9);

export function emptyCanvasModel(): CanvasModel {
  const a: CanvasShape = {
    id: uid(), type: 'rect', x: 30, y: 40, w: 150, h: 70,
    text: 'الفكرة الأولى', fill: '#6366f11a', border: '#6366f1', textColor: 'var(--fg)',
  };
  const b: CanvasShape = {
    id: uid(), type: 'rect', x: 320, y: 40, w: 150, h: 70,
    text: 'الفكرة الثانية', fill: '#10b9811a', border: '#10b981', textColor: 'var(--fg)',
  };
  return {
    width: 560, height: 220,
    shapes: [a, b],
    arrows: [{ id: uid(), fromId: a.id, toId: b.id, color: '#6b7280' }],
  };
}

export function parseCanvasModel(json: string): CanvasModel | null {
  try {
    const m = JSON.parse(json) as Partial<CanvasModel>;
    if (!Array.isArray(m.shapes)) return null;
    return {
      width: m.width ?? 560,
      height: m.height ?? 220,
      shapes: m.shapes,
      arrows: Array.isArray(m.arrows) ? m.arrows : [],
    };
  } catch {
    return null;
  }
}

export function serializeCanvasModel(m: CanvasModel): string {
  return JSON.stringify(m);
}

// ---------- هندسة بسيطة: نقطة اتصال السهم عند حافة الشكل باتجاه الشكل الآخر ----------

function edgePoint(from: CanvasShape, to: CanvasShape): { x: number; y: number } {
  const cx1 = from.x + from.w / 2;
  const cy1 = from.y + from.h / 2;
  const cx2 = to.x + to.w / 2;
  const cy2 = to.y + to.h / 2;
  const dx = cx2 - cx1;
  const dy = cy2 - cy1;
  if (dx === 0 && dy === 0) return { x: cx1, y: cy1 };
  const halfW = from.w / 2;
  const halfH = from.h / 2;
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return { x: cx1 + dx * scale, y: cy1 + dy * scale };
}

function shapePath(s: CanvasShape): { tag: string; attrs: Record<string, string> } {
  if (s.type === 'ellipse') {
    return {
      tag: 'ellipse',
      attrs: {
        cx: String(s.x + s.w / 2), cy: String(s.y + s.h / 2),
        rx: String(s.w / 2), ry: String(s.h / 2),
      },
    };
  }
  if (s.type === 'triangle') {
    const p1 = `${s.x + s.w / 2},${s.y}`;
    const p2 = `${s.x},${s.y + s.h}`;
    const p3 = `${s.x + s.w},${s.y + s.h}`;
    return { tag: 'polygon', attrs: { points: `${p1} ${p2} ${p3}` } };
  }
  return { tag: 'rect', attrs: { x: String(s.x), y: String(s.y), width: String(s.w), height: String(s.h), rx: '10' } };
}

const esc = (s: string): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** رسم ثابت للعرض فقط (بلا تفاعل) — تُستخدَم في formatDefinition / dict-node */
export function renderCanvasSvg(m: CanvasModel): string {
  const defs = m.arrows
    .map(
      (a) =>
        `<marker id="arrow-${a.id}" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">` +
        `<path d="M0,0 L8,4 L0,8 Z" fill="${esc(a.color)}" /></marker>`,
    )
    .join('');

  const arrowEls = m.arrows
    .map((a) => {
      const from = m.shapes.find((s) => s.id === a.fromId);
      const to = m.shapes.find((s) => s.id === a.toId);
      if (!from || !to) return '';
      const p1 = edgePoint(from, to);
      const p2 = edgePoint(to, from);
      return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${esc(a.color)}" stroke-width="2" marker-end="url(#arrow-${a.id})" />`;
    })
    .join('');

  const shapeEls = m.shapes
    .map((s) => {
      const { tag, attrs } = shapePath(s);
      const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
      const fontFamily = s.mono ? 'var(--mono)' : 'inherit';
      const label =
        `<foreignObject x="${s.x + 6}" y="${s.y + 6}" width="${s.w - 12}" height="${s.h - 12}">` +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;` +
        `text-align:center;font-size:12.5px;line-height:1.4;color:${esc(s.textColor)};font-family:${fontFamily};` +
        `overflow:hidden;word-break:break-word;white-space:pre-wrap">${esc(s.text)}</div></foreignObject>`;
      return `<${tag} ${attrStr} fill="${esc(s.fill)}" stroke="${esc(s.border)}" stroke-width="2" />${label}`;
    })
    .join('');

  return (
    `<svg class="canvas-svg" viewBox="0 0 ${m.width} ${m.height}" xmlns="http://www.w3.org/2000/svg" ` +
    `style="width:100%;height:auto;max-height:420px"><defs>${defs}</defs>${arrowEls}${shapeEls}</svg>`
  );
}

// ============================================================
// المحرر التفاعلي: سحب أشكال، ربط أسهم، ألوان — DOM عاديّ بلا مكتبة
// ============================================================

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * يبني واجهة لوحة رسم تفاعلية كاملة (شريط أدوات + SVG قابل للسحب) داخل wrapper معطى.
 * onChange تُستدعى بعد أي تعديل بالنموذج الحالي — المستدعي مسؤول عن حفظه (مثلاً في data-canvas).
 */
export function buildEditableCanvas(
  wrapper: HTMLElement,
  initial: CanvasModel,
  onChange: (m: CanvasModel) => void,
): () => void {
  const controller = new AbortController();
  let model: CanvasModel = structuredClone(initial);
  let selectedShapeId: string | null = null;
  let selectedArrowId: string | null = null;
  let connectMode = false;
  let connectFromId: string | null = null;
  let drag: { id: string; startX: number; startY: number; shapeX: number; shapeY: number } | null = null;

  wrapper.innerHTML = '';
  wrapper.classList.add('canvas-editor-host');

  const toolbar = document.createElement('div');
  toolbar.className = 'canvas-toolbar';
  wrapper.appendChild(toolbar);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'canvas-svg canvas-svg-editable');
  svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);
  wrapper.appendChild(svg);

  const inspector = document.createElement('div');
  inspector.className = 'canvas-inspector';
  wrapper.appendChild(inspector);

  const emit = () => onChange(structuredClone(model));

  // ---------- شريط الأدوات العلوي ----------
  const addShapeBtn = (label: string, type: ShapeType) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm ghost';
    btn.textContent = label;
    btn.onmousedown = (e) => e.preventDefault();
    btn.onclick = () => {
      const s: CanvasShape = {
        id: uid(), type, x: 40, y: 40, w: 140, h: 70,
        text: 'نص', fill: '#6366f11a', border: '#6366f1', textColor: 'var(--fg)',
      };
      model.shapes.push(s);
      selectedShapeId = s.id;
      selectedArrowId = null;
      redraw();
      emit();
    };
    toolbar.appendChild(btn);
  };
  addShapeBtn('▭ مربع', 'rect');
  addShapeBtn('◯ دائرة', 'ellipse');
  addShapeBtn('△ مثلث', 'triangle');

  const connectBtn = document.createElement('button');
  connectBtn.type = 'button';
  connectBtn.className = 'btn sm ghost';
  connectBtn.textContent = '🔗 ربط بسهم';
  connectBtn.onmousedown = (e) => e.preventDefault();
  connectBtn.onclick = () => {
    connectMode = !connectMode;
    connectFromId = null;
    connectBtn.classList.toggle('primary', connectMode);
    svg.classList.toggle('connect-mode', connectMode);
  };
  toolbar.appendChild(connectBtn);

  // ---------- رسم كل شيء من جديد ----------
  function redraw(): void {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${model.width} ${model.height}`);

    const defs = document.createElementNS(SVG_NS, 'defs');
    svg.appendChild(defs);

    for (const a of model.arrows) {
      const marker = document.createElementNS(SVG_NS, 'marker');
      marker.setAttribute('id', 'em-' + a.id);
      marker.setAttribute('markerWidth', '9');
      marker.setAttribute('markerHeight', '9');
      marker.setAttribute('refX', '7');
      marker.setAttribute('refY', '4');
      marker.setAttribute('orient', 'auto');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
      path.setAttribute('fill', a.color);
      marker.appendChild(path);
      defs.appendChild(marker);

      const from = model.shapes.find((s) => s.id === a.fromId);
      const to = model.shapes.find((s) => s.id === a.toId);
      if (!from || !to) continue;
      const p1 = edgePoint(from, to);
      const p2 = edgePoint(to, from);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(p1.x));
      line.setAttribute('y1', String(p1.y));
      line.setAttribute('x2', String(p2.x));
      line.setAttribute('y2', String(p2.y));
      line.setAttribute('stroke', a.color);
      line.setAttribute('stroke-width', a.id === selectedArrowId ? '4' : '2');
      line.setAttribute('marker-end', `url(#em-${a.id})`);
      line.style.cursor = 'pointer';
      line.onclick = (e) => {
        e.stopPropagation();
        selectedArrowId = a.id;
        selectedShapeId = null;
        redraw();
        showArrowInspector(a);
      };
      svg.appendChild(line);
    }

    for (const s of model.shapes) {
      const g = document.createElementNS(SVG_NS, 'g');
      g.style.cursor = connectMode ? 'crosshair' : 'move';

      const { tag, attrs } = shapePath(s);
      const bg = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) bg.setAttribute(k, v);
      bg.setAttribute('fill', s.fill);
      bg.setAttribute('stroke', s.border);
      bg.setAttribute('stroke-width', s.id === selectedShapeId ? '3' : '2');
      if (s.id === selectedShapeId) bg.setAttribute('stroke-dasharray', '5,3');
      g.appendChild(bg);

      const fo = document.createElementNS(SVG_NS, 'foreignObject');
      fo.setAttribute('x', String(s.x + 6));
      fo.setAttribute('y', String(s.y + 6));
      fo.setAttribute('width', String(Math.max(s.w - 12, 1)));
      fo.setAttribute('height', String(Math.max(s.h - 12, 1)));
      const div = document.createElementNS(XHTML_NS, 'div') as HTMLDivElement;
      div.className = 'canvas-shape-text';
      div.setAttribute('contenteditable', 'true');
      div.setAttribute('spellcheck', 'false');
      div.style.color = s.textColor;
      div.style.fontFamily = s.mono ? 'var(--mono)' : 'inherit';
      div.textContent = s.text;
      div.onclick = (e) => e.stopPropagation();
      div.onmousedown = (e) => e.stopPropagation();
      div.oninput = () => {
        s.text = div.textContent ?? '';
        emit();
      };
      fo.appendChild(div);
      g.appendChild(fo);

      bg.onmousedown = (e) => {
        e.stopPropagation();
        if (connectMode) {
          if (!connectFromId) {
            connectFromId = s.id;
          } else if (connectFromId !== s.id) {
            model.arrows.push({ id: uid(), fromId: connectFromId, toId: s.id, color: '#6b7280' });
            connectFromId = null;
            connectMode = false;
            connectBtn.classList.remove('primary');
            svg.classList.remove('connect-mode');
            redraw();
            emit();
          }
          return;
        }
        selectedShapeId = s.id;
        selectedArrowId = null;
        const pt = clientToSvgPoint(e.clientX, e.clientY);
        drag = { id: s.id, startX: pt.x, startY: pt.y, shapeX: s.x, shapeY: s.y };
        redraw();
        showShapeInspector(s);
      };

      svg.appendChild(g);
    }
  }

  function clientToSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    const scaleX = model.width / rect.width;
    const scaleY = model.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  window.addEventListener(
    'mousemove',
    (e) => {
      if (!drag) return;
      const pt = clientToSvgPoint(e.clientX, e.clientY);
      const s = model.shapes.find((sh) => sh.id === drag!.id);
      if (!s) return;
      s.x = Math.max(0, drag.shapeX + (pt.x - drag.startX));
      s.y = Math.max(0, drag.shapeY + (pt.y - drag.startY));
      redraw();
    },
    { signal: controller.signal },
  );
  window.addEventListener(
    'mouseup',
    () => {
      if (drag) emit();
      drag = null;
    },
    { signal: controller.signal },
  );

  svg.addEventListener('click', () => {
    if (connectMode) return;
    selectedShapeId = null;
    selectedArrowId = null;
    redraw();
    inspector.innerHTML = '';
  });

  // ---------- لوحة الخصائص (ألوان + كود + حذف) ----------
  function colorRow(label: string, value: string, onSet: (v: string) => void): HTMLElement {
    const row = document.createElement('label');
    row.className = 'canvas-inspector-row';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#6366f1';
    input.oninput = () => onSet(input.value);
    row.append(span, input);
    return row;
  }

  function showShapeInspector(s: CanvasShape): void {
    inspector.innerHTML = '';
    inspector.appendChild(colorRow('الحشو', s.fill, (v) => { s.fill = v; redraw(); emit(); }));
    inspector.appendChild(colorRow('الحدود', s.border, (v) => { s.border = v; redraw(); emit(); }));
    inspector.appendChild(colorRow('لون النص', s.textColor, (v) => { s.textColor = v; redraw(); emit(); }));

    const monoBtn = document.createElement('button');
    monoBtn.type = 'button';
    monoBtn.className = 'btn sm ghost';
    monoBtn.textContent = s.mono ? '</> كود ✓' : '</> اجعله كوداً';
    monoBtn.onclick = () => { s.mono = !s.mono; redraw(); emit(); };
    inspector.appendChild(monoBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn sm danger';
    delBtn.textContent = '🗑 حذف الشكل';
    delBtn.onclick = () => {
      model.shapes = model.shapes.filter((x) => x.id !== s.id);
      model.arrows = model.arrows.filter((a) => a.fromId !== s.id && a.toId !== s.id);
      selectedShapeId = null;
      redraw();
      inspector.innerHTML = '';
      emit();
    };
    inspector.appendChild(delBtn);
  }

  function showArrowInspector(a: CanvasArrow): void {
    inspector.innerHTML = '';
    inspector.appendChild(colorRow('لون السهم', a.color, (v) => { a.color = v; redraw(); emit(); }));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn sm danger';
    delBtn.textContent = '🗑 حذف السهم';
    delBtn.onclick = () => {
      model.arrows = model.arrows.filter((x) => x.id !== a.id);
      selectedArrowId = null;
      redraw();
      inspector.innerHTML = '';
      emit();
    };
    inspector.appendChild(delBtn);
  }

  redraw();
  return () => controller.abort();
}
