"use client";

import { useEffect, useRef, useCallback } from "react";
import "./StoreVisual.css";

/* ═══════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════ */

const TILE = 40;
const HALF = TILE / 2;
const S = 11;

const GLOW_RADIUS = 100;
const GLOW_FADE = 0.93;
const DRAG_THRESHOLD = 6;
const TARGET_COMPS = 22;
const BRIDGE_MAX = 6;

/* ═══════════════════════════════════
   TYPES
   ═══════════════════════════════════ */

type CType = "power" | "ac" | "wire" | "resistor" | "capacitor" | "led" | "motor" | "buzzer" | "switch";
type Side = "top" | "bottom" | "left" | "right";

interface Comp {
  id: number;
  type: CType;
  col: number;
  row: number;
  on: boolean;          // switch state
  powered: boolean;
  prevPowered: boolean;
  powerLevel: number;   // 0–1, reduced by resistors
  acPowered: boolean;   // true if powered by AC source
  fadeIn: number;        // 0→1 spawn
  fadeOut: number;       // -1 = alive, 1→0 = dying
  glowPulse: number;    // LED/motor/buzzer power-on flash
  animTime: number;      // seconds continuously powered
  spinAngle: number;     // motor rotor angle
}

interface VWire {
  col: number;
  row: number;
  h: boolean;
  v: boolean;
  vSide: "left" | "right";  // which cell edge vertical segments use
  powered: boolean;
  powerLevel: number;
  acPowered: boolean;
}

/* ═══════════════════════════════════
   CONNECTION LOGIC
   ═══════════════════════════════════ */

const OPP: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const DX: Record<Side, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

const IS_SOURCE: Record<string, boolean> = { power: true, ac: true };
const IS_OUTPUT: Record<string, boolean> = { led: true, motor: true, buzzer: true };

/* ═══════════════════════════════════
   SPAWN
   ═══════════════════════════════════ */

const WEIGHTS: [CType, number][] = [
  ["resistor", 14], ["capacitor", 8],
  ["power", 9], ["ac", 6],
  ["led", 12], ["motor", 7], ["buzzer", 5],
  ["switch", 9],
];
const WTOTAL = WEIGHTS.reduce((s, [, w]) => s + w, 0);

function rndType(): CType {
  let r = Math.random() * WTOTAL;
  for (const [t, w] of WEIGHTS) { r -= w; if (r <= 0) return t; }
  return "resistor";
}

let _nid = 0;
function spawn(col: number, row: number, type?: CType): Comp {
  return {
    id: _nid++, type: type ?? rndType(), col, row,
    on: true, powered: false, prevPowered: false,
    powerLevel: 0, acPowered: false,
    fadeIn: 0, fadeOut: -1, glowPulse: 0,
    animTime: 0, spinAngle: 0,
  };
}

function rndEmpty(comps: Comp[], maxCol: number, maxRow: number): [number, number] | null {
  const occ = new Set(comps.filter(c => c.fadeOut < 0).map(c => `${c.col},${c.row}`));
  for (let i = 0; i < 80; i++) {
    const c = Math.floor(Math.random() * maxCol);
    const r = Math.floor(Math.random() * maxRow);
    if (!occ.has(`${c},${r}`)) return [c, r];
  }
  return null;
}

/* ═══════════════════════════════════
   AUTO-WIRE BRIDGING
   ═══════════════════════════════════ */

function computeAutoWires(comps: Comp[]): {
  wires: VWire[];
  stubs: Map<number, { top?: "left" | "right"; bottom?: "left" | "right" }>;
} {
  const alive = comps.filter(c => c.fadeOut < 0);
  const occupied = new Map<string, Comp>();
  alive.forEach(c => occupied.set(`${c.col},${c.row}`, c));
  const wireMap = new Map<string, VWire>();
  const stubs = new Map<number, { top?: "left" | "right"; bottom?: "left" | "right" }>();

  // Track which components have horizontal connections on each side
  const hConnRight = new Set<number>();
  const hConnLeft = new Set<number>();

  // Pass 1: horizontal connections — create bridge wires and record sides
  for (const c of alive) {
    for (let d = 1; d <= BRIDGE_MAX; d++) {
      const key = `${c.col + d},${c.row}`;
      const neighbor = occupied.get(key);
      if (neighbor) {
        hConnRight.add(c.id);
        hConnLeft.add(neighbor.id);
        for (let i = 1; i < d; i++) {
          const wk = `${c.col + i},${c.row}`;
          if (!occupied.has(wk)) {
            const existing = wireMap.get(wk);
            if (existing) existing.h = true;
            else wireMap.set(wk, { col: c.col + i, row: c.row, h: true, v: false, vSide: "right", powered: false, powerLevel: 0, acPowered: false });
          }
        }
        break;
      }
    }
  }

  // Pass 2: vertical connections — pick left/right side to avoid overlapping
  // horizontal leads, then create bridge wires + endpoint stubs
  for (const c of alive) {
    for (let d = 1; d <= BRIDGE_MAX; d++) {
      const key = `${c.col},${c.row + d}`;
      const neighbor = occupied.get(key);
      if (neighbor) {
        // Vote: if an endpoint has a horizontal wire going right, prefer
        // routing the vertical on the left (and vice-versa).
        let preferLeft = 0, preferRight = 0;
        if (hConnRight.has(c.id)) preferLeft++;
        if (hConnRight.has(neighbor.id)) preferLeft++;
        if (hConnLeft.has(c.id)) preferRight++;
        if (hConnLeft.has(neighbor.id)) preferRight++;
        const side: "left" | "right" = preferLeft > preferRight ? "left" : "right";

        // Stubs on endpoint components
        const cs = stubs.get(c.id) ?? {};
        cs.bottom = side;
        stubs.set(c.id, cs);

        const ns = stubs.get(neighbor.id) ?? {};
        ns.top = side;
        stubs.set(neighbor.id, ns);

        // Bridge wire cells between the two components
        for (let i = 1; i < d; i++) {
          const wk = `${c.col},${c.row + i}`;
          if (!occupied.has(wk)) {
            const existing = wireMap.get(wk);
            if (existing) { existing.v = true; existing.vSide = side; }
            else wireMap.set(wk, { col: c.col, row: c.row + i, h: false, v: true, vSide: side, powered: false, powerLevel: 0, acPowered: false });
          }
        }
        break;
      }
    }
  }

  return { wires: [...wireMap.values()], stubs };
}

/* ═══════════════════════════════════
   CIRCUIT DETECTION
   ═══════════════════════════════════ */

function detect(comps: Comp[], autoWires: VWire[], dt: number) {
  const alive = comps.filter(c => c.fadeOut < 0);

  // Build combined grid: real components + auto-wires
  const grid = new Map<string, { comp?: Comp; wire?: VWire }>();
  alive.forEach(c => grid.set(`${c.col},${c.row}`, { comp: c }));
  autoWires.forEach(w => {
    const k = `${w.col},${w.row}`;
    if (!grid.has(k)) grid.set(k, { wire: w });
  });

  function getSides(entry: { comp?: Comp; wire?: VWire }): Side[] {
    if (entry.comp) {
      if (entry.comp.type === "switch" && !entry.comp.on) return [];
      return ["top", "bottom", "left", "right"];
    }
    if (entry.wire) {
      const s: Side[] = [];
      if (entry.wire.h) { s.push("left", "right"); }
      if (entry.wire.v) { s.push("top", "bottom"); }
      return s;
    }
    return [];
  }

  // Save prev, reset
  alive.forEach(c => {
    c.prevPowered = c.powered;
    c.powered = false;
    c.powerLevel = 0;
    c.acPowered = false;
  });
  autoWires.forEach(w => {
    w.powered = false;
    w.powerLevel = 0;
    w.acPowered = false;
  });

  // For each power source, find circuit loops
  for (const ps of alive) {
    if (!IS_SOURCE[ps.type]) continue;
    const isAC = ps.type === "ac";
    const psKey = `${ps.col},${ps.row}`;

    // Collect connected neighbors
    const nbrs: string[] = [];
    for (const side of (["top", "bottom", "left", "right"] as Side[])) {
      const [dc, dr] = DX[side];
      const nk = `${ps.col + dc},${ps.row + dr}`;
      const entry = grid.get(nk);
      if (entry && getSides(entry).includes(OPP[side])) nbrs.push(nk);
    }
    if (nbrs.length < 2) continue;

    // BFS from nbrs[0] to nbrs[1], excluding source
    const visited = new Set([psKey, nbrs[0]]);
    const parent = new Map<string, string | null>();
    parent.set(nbrs[0], null);
    const q = [nbrs[0]];
    let found = false;

    while (q.length > 0) {
      const curKey = q.shift()!;
      if (curKey === nbrs[1]) { found = true; break; }
      const curEntry = grid.get(curKey);
      if (!curEntry) continue;
      for (const side of getSides(curEntry)) {
        const [dc, dr] = DX[side];
        const [cc, cr] = curKey.split(",").map(Number);
        const nk = `${cc + dc},${cr + dr}`;
        if (visited.has(nk)) continue;
        const nEntry = grid.get(nk);
        if (!nEntry || !getSides(nEntry).includes(OPP[side])) continue;
        visited.add(nk);
        parent.set(nk, curKey);
        q.push(nk);
      }
    }

    if (found) {
      // Trace path, count resistors
      let resistors = 0;
      let k: string | null = nbrs[1];
      const path: string[] = [];
      while (k) {
        path.push(k);
        const entry = grid.get(k);
        if (entry?.comp?.type === "resistor") resistors++;
        k = parent.get(k) ?? null;
      }

      // Power level: each resistor drops 0.2
      const lvl = Math.max(0.08, 1.0 - resistors * 0.2);

      ps.powered = true;
      ps.powerLevel = 1;
      ps.acPowered = isAC;

      for (const pk of path) {
        const entry = grid.get(pk);
        if (entry?.comp) {
          entry.comp.powered = true;
          entry.comp.powerLevel = lvl;
          entry.comp.acPowered = isAC;
        }
        if (entry?.wire) {
          entry.wire.powered = true;
          entry.wire.powerLevel = lvl;
          entry.wire.acPowered = isAC;
        }
      }
    }
  }

  // Update animation timers
  alive.forEach(c => {
    if (c.powered) {
      if (!c.prevPowered && IS_OUTPUT[c.type]) c.glowPulse = 1;
      c.animTime += dt;
      if (c.type === "motor") c.spinAngle += dt * c.powerLevel * 8;
    } else {
      c.animTime = 0;
      if (c.type === "motor" && c.spinAngle > 0) c.spinAngle += dt * 0.5;
    }
  });
}

/* ═══════════════════════════════════
   DRAW FUNCTIONS
   Each draws centered at (0,0)
   Leads extend to ±HALF (cell edges)
   ═══════════════════════════════════ */

// ── DC Power (battery) ──
function drawPower(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-5, 0);
  ctx.moveTo(5, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  ctx.save(); ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-4, 9); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(4, 6); ctx.stroke();
  ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("+", 11, -7); ctx.fillText("−", -11, -7);
}

// ── AC Power (sine wave in circle) ──
function drawAC(ctx: CanvasRenderingContext2D, t: number) {
  // Leads
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-10, 0);
  ctx.moveTo(10, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  // Circle
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  // Sine wave inside
  ctx.beginPath();
  const phase = t * 6; // animate the wave
  for (let i = -7; i <= 7; i++) {
    const x = i;
    const y = Math.sin((i / 7) * Math.PI * 2 + phase) * 4;
    if (i === -7) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ── Resistor (zigzag) ──
function drawResistor(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-S, 0);
  ctx.moveTo(S, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-S, 0);
  const segs = 6, sw = (S * 2) / segs, amp = 5;
  for (let i = 0; i < segs; i++) ctx.lineTo(-S + (i + 0.5) * sw, i % 2 === 0 ? -amp : amp);
  ctx.lineTo(S, 0); ctx.stroke();
}

// ── Capacitor (two plates) ──
function drawCapacitor(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-3, 0);
  ctx.moveTo(3, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  ctx.save(); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(-3, 8); ctx.stroke();
  ctx.restore();
  // Curved plate (electrolytic style)
  ctx.beginPath();
  ctx.arc(7, 0, 10, Math.PI * 0.6, Math.PI * 1.4);
  ctx.stroke();
}

// ── LED (triangle + bar + glow) ──
function drawLED(ctx: CanvasRenderingContext2D, powered: boolean, pwr: number, pulse: number, ac: boolean, t: number) {
  // Effective brightness: AC causes flicker
  let brightness = pwr;
  if (powered && ac) {
    brightness = pwr * (0.4 + 0.6 * Math.abs(Math.sin(t * 8)));
  }

  // Glow (behind)
  if (powered) {
    const p = 1 + (pulse > 0 ? pulse * 0.5 : 0);
    const rad = 28 * p;
    const a = brightness * 0.45 * (1 + pulse * 0.4);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
    g.addColorStop(0, `rgba(217,184,52,${a})`);
    g.addColorStop(1, "rgba(217,184,52,0)");
    ctx.save(); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Leads
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-7, 0);
  ctx.moveTo(6, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  // Triangle
  ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-7, 7); ctx.lineTo(5, 0); ctx.closePath();
  if (powered) { ctx.save(); ctx.globalAlpha = brightness * 0.4; ctx.fill(); ctx.restore(); }
  ctx.stroke();
  // Bar
  ctx.beginPath(); ctx.moveTo(6, -7); ctx.lineTo(6, 7); ctx.stroke();
  // Light arrows
  ctx.beginPath();
  ctx.moveTo(5, -9); ctx.lineTo(9, -13);
  ctx.moveTo(8, -6); ctx.lineTo(12, -10);
  ctx.stroke();
}

// ── Motor (circle with spinning rotor) ──
function drawMotor(ctx: CanvasRenderingContext2D, powered: boolean, pwr: number, spin: number, pulse: number) {
  // Glow when powered
  if (powered) {
    const p = 1 + (pulse > 0 ? pulse * 0.3 : 0);
    const a = pwr * 0.2 * (1 + pulse * 0.3);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * p);
    g.addColorStop(0, `rgba(217,184,52,${a})`);
    g.addColorStop(1, "rgba(217,184,52,0)");
    ctx.save(); ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 22 * p, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Leads
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-9, 0);
  ctx.moveTo(9, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  // Circle
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
  // Spinning rotor (cross)
  ctx.save();
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
  ctx.moveTo(0, -5); ctx.lineTo(0, 5);
  ctx.stroke();
  ctx.restore();
  // "M" label
  ctx.save();
  ctx.font = "bold 7px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.5;
  ctx.fillText("M", 0, 0.5);
  ctx.restore();
}

// ── Buzzer (speaker with sound waves) ──
function drawBuzzer(ctx: CanvasRenderingContext2D, powered: boolean, pwr: number, t: number, pulse: number) {
  // Leads
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-8, 0);
  ctx.moveTo(5, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  // Speaker body (small rectangle + flare)
  ctx.beginPath();
  ctx.moveTo(-8, -4); ctx.lineTo(-8, 4); ctx.lineTo(-3, 4); ctx.lineTo(3, 8); ctx.lineTo(3, -8); ctx.lineTo(-3, -4);
  ctx.closePath();
  ctx.stroke();
  if (powered) { ctx.save(); ctx.globalAlpha = pwr * 0.2; ctx.fill(); ctx.restore(); }
  // Sound waves when powered
  if (powered) {
    const wavePulse = pulse > 0 ? 1 + pulse * 0.3 : 1;
    const baseAlpha = pwr * 0.5;
    for (let i = 0; i < 3; i++) {
      const phase = (t * 4 + i * 0.7) % 2;
      const r = 6 + phase * 8;
      const a = baseAlpha * Math.max(0, 1 - phase * 0.5) * wavePulse;
      if (a < 0.02) continue;
      ctx.save(); ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(5, 0, r, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Switch ──
function drawSwitch(ctx: CanvasRenderingContext2D, on: boolean) {
  ctx.beginPath();
  ctx.moveTo(-HALF, 0); ctx.lineTo(-7, 0);
  ctx.moveTo(7, 0); ctx.lineTo(HALF, 0);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(-7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(7, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-7, 0);
  if (on) ctx.lineTo(7, 0); else ctx.lineTo(1, -11);
  ctx.stroke();
}

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

interface StoreVisualProps { itemCount?: number; }

export function StoreVisual({ itemCount }: StoreVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999, inside: false });
  const glowCells = useRef<Map<string, number>>(new Map());
  const comps = useRef<Comp[]>([]);
  const globalTime = useRef(0);

  // Interaction state
  const downAt = useRef<{ x: number; y: number; time: number } | null>(null);
  const downComp = useRef<Comp | null>(null);
  const dragging = useRef(false);
  const dragOrigPos = useRef({ col: 0, row: 0 });
  const lastToggleId = useRef(-1);

  const lightUpCells = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cols = Math.ceil(rect.width / TILE) + 1;
    const rows = Math.ceil(rect.height / TILE) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = c * TILE + HALF;
        const cy = r * TILE + HALF;
        const d = Math.max(Math.abs(cx - mouse.current.x), Math.abs(cy - mouse.current.y));
        if (d < GLOW_RADIUS) {
          const k = `${c},${r}`;
          const ex = glowCells.current.get(k) || 0;
          glowCells.current.set(k, Math.max(ex, 1 - d / GLOW_RADIUS));
        }
      }
    }
  }, []);

  const findComp = useCallback((mx: number, my: number): Comp | null => {
    const col = Math.floor(mx / TILE);
    const row = Math.floor(my / TILE);
    return comps.current.find(c => c.col === col && c.row === row && c.fadeOut < 0) ?? null;
  }, []);

  /* ── Pointer handlers ── */

  const onPointerDown = useCallback((x: number, y: number) => {
    downAt.current = { x, y, time: performance.now() };
    downComp.current = findComp(x, y);
    dragging.current = false;
    if (downComp.current) {
      dragOrigPos.current = { col: downComp.current.col, row: downComp.current.row };
    }
  }, [findComp]);

  const onPointerMove = useCallback((x: number, y: number) => {
    mouse.current.x = x;
    mouse.current.y = y;
    mouse.current.inside = true;
    lightUpCells();

    // Switch hover toggle (only when not dragging and no button held)
    if (!dragging.current && !downAt.current) {
      const comp = findComp(x, y);
      if (comp && comp.type === "switch" && comp.id !== lastToggleId.current) {
        comp.on = !comp.on;
        lastToggleId.current = comp.id;
      } else if (!comp || comp.type !== "switch") {
        lastToggleId.current = -1;
      }
    }

    // Drag detection
    if (downAt.current && downComp.current) {
      const dx = x - downAt.current.x;
      const dy = y - downAt.current.y;
      if (!dragging.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragging.current = true;
      }
    }
  }, [lightUpCells, findComp]);

  const onPointerUp = useCallback((x: number, y: number, maxCol: number, maxRow: number) => {
    const comp = downComp.current;
    const wasDown = downAt.current;

    if (comp && wasDown) {
      if (dragging.current) {
        // Drop: snap to grid
        const nc = Math.max(0, Math.min(maxCol - 1, Math.floor(x / TILE)));
        const nr = Math.max(0, Math.min(maxRow - 1, Math.floor(y / TILE)));
        const occupied = comps.current.some(c => c !== comp && c.col === nc && c.row === nr && c.fadeOut < 0);
        if (occupied) {
          comp.col = dragOrigPos.current.col;
          comp.row = dragOrigPos.current.row;
        } else {
          comp.col = nc;
          comp.row = nr;
        }
      } else {
        // Quick click: destroy + spawn new
        comp.fadeOut = 1;
        const pos = rndEmpty(comps.current, maxCol, maxRow);
        if (pos) comps.current.push(spawn(pos[0], pos[1]));
      }
    }

    downAt.current = null;
    downComp.current = null;
    dragging.current = false;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    onPointerDown(e.clientX - r.left, e.clientY - r.top);
  }, [onPointerDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    onPointerMove(e.clientX - r.left, e.clientY - r.top);
  }, [onPointerMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const maxCol = Math.floor(r.width / TILE);
    const maxRow = Math.floor(r.height / TILE);
    onPointerUp(e.clientX - r.left, e.clientY - r.top, maxCol, maxRow);
  }, [onPointerUp]);

  const handleMouseLeave = useCallback(() => {
    mouse.current.inside = false;
    mouse.current.x = -999; mouse.current.y = -999;
    lastToggleId.current = -1;
    if (downComp.current && dragging.current) {
      downComp.current.col = dragOrigPos.current.col;
      downComp.current.row = dragOrigPos.current.row;
    }
    downAt.current = null; downComp.current = null; dragging.current = false;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]; const r = containerRef.current?.getBoundingClientRect();
    if (!t || !r) return;
    onPointerDown(t.clientX - r.left, t.clientY - r.top);
  }, [onPointerDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]; const r = containerRef.current?.getBoundingClientRect();
    if (!t || !r) return;
    onPointerMove(t.clientX - r.left, t.clientY - r.top);
  }, [onPointerMove]);

  const handleTouchEnd = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    const maxCol = Math.floor(r.width / TILE);
    const maxRow = Math.floor(r.height / TILE);
    onPointerUp(mouse.current.x, mouse.current.y, maxCol, maxRow);
    mouse.current.inside = false;
  }, [onPointerUp]);

  /* ── Animation loop ── */

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animId: number;
    let w = 0, h = 0;
    let lastTime = performance.now();

    const resize = () => {
      const r = container.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w; canvas.height = h;

      if (comps.current.length === 0 && w > 0 && h > 0) {
        const maxCol = Math.floor(w / TILE);
        const maxRow = Math.floor(h / TILE);
        const seed: Comp[] = [];
        const occ = new Set<string>();
        const place = (type: CType) => {
          for (let i = 0; i < 80; i++) {
            const c = Math.floor(Math.random() * maxCol);
            const r2 = Math.floor(Math.random() * maxRow);
            if (!occ.has(`${c},${r2}`)) {
              occ.add(`${c},${r2}`);
              seed.push(spawn(c, r2, type));
              return;
            }
          }
        };
        // Guarantee sources + outputs exist
        place("power"); place("power"); place("ac");
        place("led"); place("led"); place("motor"); place("buzzer");
        place("switch"); place("switch");
        place("resistor"); place("resistor");
        place("capacitor");
        for (let i = seed.length; i < TARGET_COMPS; i++) place(rndType());
        comps.current = seed;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      globalTime.current += dt;
      const t = globalTime.current;

      const ctx = canvas!.getContext("2d");
      if (!ctx) { animId = requestAnimationFrame(tick); return; }

      ctx.clearRect(0, 0, w, h);

      // ── Glow cells ──
      const del: string[] = [];
      glowCells.current.forEach((val, key) => {
        const [cs, rs] = key.split(",");
        ctx.fillStyle = `rgba(217,184,52,${val * 0.35})`;
        ctx.fillRect(+cs * TILE + 1, +rs * TILE + 1, TILE - 2, TILE - 2);
        const nv = val * GLOW_FADE;
        if (nv < 0.01) del.push(key); else glowCells.current.set(key, nv);
      });
      del.forEach(k => glowCells.current.delete(k));

      // ── Grid lines ──
      const cols = Math.ceil(w / TILE) + 1;
      const rows = Math.ceil(h / TILE) + 1;
      ctx.beginPath();
      for (let r = 0; r <= rows; r++) { ctx.moveTo(0, r * TILE); ctx.lineTo(w, r * TILE); }
      for (let c = 0; c <= cols; c++) { ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, h); }
      ctx.strokeStyle = "rgba(217,184,52,0.07)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // ── Update animations ──
      comps.current.forEach(c => {
        if (c.fadeIn < 1) c.fadeIn = Math.min(1, c.fadeIn + dt * 2.5);
        if (c.fadeOut >= 0) c.fadeOut = Math.max(0, c.fadeOut - dt * 4);
        if (c.glowPulse > 0) c.glowPulse = Math.max(0, c.glowPulse - dt * 2);
      });
      comps.current = comps.current.filter(c => c.fadeOut !== 0);

      // ── Auto-wire bridging + circuit detection ──
      const { wires: autoWires, stubs: compStubs } = computeAutoWires(comps.current);
      detect(comps.current, autoWires, dt);

      // ── Draw auto-wires ──
      // Horizontal segments run through cell center (matching component leads).
      // Vertical segments run along the right cell edge so they never
      // cut through a component body — they meet horizontal leads at ±HALF.
      for (const wire of autoWires) {
        const wcx = wire.col * TILE + HALF;
        const wcy = wire.row * TILE + HALF;
        const wcol = wire.powered
          ? `rgba(217,184,52,${0.5 + wire.powerLevel * 0.5})`
          : "rgba(250,247,238,0.16)";
        ctx.strokeStyle = wcol;
        ctx.lineWidth = 1.2;
        ctx.lineCap = "round";
        ctx.beginPath();
        if (wire.h) { ctx.moveTo(wcx - HALF, wcy); ctx.lineTo(wcx + HALF, wcy); }
        if (wire.v) {
          const vx = wire.vSide === "left" ? wcx - HALF : wcx + HALF;
          ctx.moveTo(vx, wcy - HALF); ctx.lineTo(vx, wcy + HALF);
        }
        ctx.stroke();
        if (wire.h && wire.v) {
          const vx = wire.vSide === "left" ? wcx - HALF : wcx + HALF;
          ctx.fillStyle = wcol;
          ctx.beginPath(); ctx.arc(vx, wcy, 2, 0, Math.PI * 2); ctx.fill();
        }
      }

      // ── Hover highlight ──
      const mx = mouse.current.x, my = mouse.current.y;
      if (mouse.current.inside && !dragging.current) {
        const hc = Math.floor(mx / TILE);
        const hr = Math.floor(my / TILE);
        const hovered = comps.current.find(c => c.col === hc && c.row === hr && c.fadeOut < 0);
        if (hovered) {
          ctx.fillStyle = "rgba(217,184,52,0.06)";
          ctx.fillRect(hc * TILE + 1, hr * TILE + 1, TILE - 2, TILE - 2);
        }
      }

      // ── Draw components ──
      const dragC = dragging.current ? downComp.current : null;

      for (const c of comps.current) {
        if (c === dragC) continue;
        const cx = c.col * TILE + HALF;
        const cy = c.row * TILE + HALF;
        const alpha = c.fadeOut >= 0 ? c.fadeOut * c.fadeIn : c.fadeIn;
        const scale = c.fadeOut >= 0 ? 1 + (1 - c.fadeOut) * 0.3 : 1;

        ctx.save();
        ctx.translate(cx, cy);
        if (scale !== 1) ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;

        const col = c.powered
          ? `rgba(217,184,52,${0.5 + c.powerLevel * 0.5})`
          : "rgba(250,247,238,0.16)";
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 1.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // Draw vertical connection stubs at the cell edge where leads terminate.
        // Side is chosen to avoid overlapping horizontal auto-wire connections.
        const cStubInfo = compStubs.get(c.id);
        if (cStubInfo) {
          ctx.beginPath();
          if (cStubInfo.top) {
            const sx = cStubInfo.top === "left" ? -HALF : HALF;
            ctx.moveTo(sx, 0); ctx.lineTo(sx, -HALF);
          }
          if (cStubInfo.bottom) {
            const sx = cStubInfo.bottom === "left" ? -HALF : HALF;
            ctx.moveTo(sx, 0); ctx.lineTo(sx, HALF);
          }
          ctx.stroke();
        }

        switch (c.type) {
          case "power":    drawPower(ctx); break;
          case "ac":       drawAC(ctx, t); break;
          case "resistor": drawResistor(ctx); break;
          case "capacitor": drawCapacitor(ctx); break;
          case "led":      drawLED(ctx, c.powered, c.powerLevel, c.glowPulse, c.acPowered, t); break;
          case "motor":    drawMotor(ctx, c.powered, c.powerLevel, c.spinAngle, c.glowPulse); break;
          case "buzzer":   drawBuzzer(ctx, c.powered, c.powerLevel, t, c.glowPulse); break;
          case "switch":   drawSwitch(ctx, c.on); break;
        }

        ctx.restore();
      }

      // ── Drag ghost ──
      if (dragC) {
        const tc = Math.max(0, Math.min(Math.floor(w / TILE) - 1, Math.floor(mx / TILE)));
        const tr = Math.max(0, Math.min(Math.floor(h / TILE) - 1, Math.floor(my / TILE)));
        ctx.strokeStyle = "rgba(217,184,52,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(tc * TILE + 1, tr * TILE + 1, TILE - 2, TILE - 2);

        ctx.save();
        ctx.translate(mx, my);
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "rgba(217,184,52,0.8)";
        ctx.fillStyle = "rgba(217,184,52,0.8)";
        ctx.lineWidth = 1.2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        switch (dragC.type) {
          case "power":    drawPower(ctx); break;
          case "ac":       drawAC(ctx, t); break;
          case "resistor": drawResistor(ctx); break;
          case "capacitor": drawCapacitor(ctx); break;
          case "led":      drawLED(ctx, false, 0, 0, false, t); break;
          case "motor":    drawMotor(ctx, false, 0, dragC.spinAngle, 0); break;
          case "buzzer":   drawBuzzer(ctx, false, 0, t, 0); break;
          case "switch":   drawSwitch(ctx, dragC.on); break;
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(tick);
    }

    animId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <div
      className="store-visual"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="store-visual-canvas" />
      <span className="store-visual-label sv-tl">Browse · Search · Find</span>
      <span className="store-visual-label sv-br">{itemCount ?? "—"} items</span>
    </div>
  );
}
