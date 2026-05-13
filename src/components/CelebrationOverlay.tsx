import { useEffect, useRef, useState } from 'react';

type Kind = 'confetti' | 'fireworks' | 'racecar' | 'warp' | 'lightning' | 'pixels';
const KINDS: Kind[] = ['confetti', 'fireworks', 'racecar', 'warp', 'lightning', 'pixels'];

function r(a: number, b: number) { return Math.random() * (b - a) + a; }
function pick<T>(arr: T[]): T { return arr[Math.floor(r(0, arr.length))]; }

// ── Confetti ──────────────────────────────────────────────────────────────────

function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return; const c = ref.current;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const COLORS = ['#22C55E','#3B82F6','#F59E0B','#EF4444','#A855F7','#EC4899','#F97316','#06B6D4'];
    const ps = Array.from({ length: 130 }, () => ({
      x: r(0, c.width), y: r(-220, 0),
      vx: r(-2.5, 2.5), vy: r(1.5, 5),
      w: r(6, 16), h: r(3, 9),
      col: pick(COLORS), rot: r(0, Math.PI * 2), spin: r(-0.2, 0.2), a: 1,
    }));
    let raf: number; let t = 0;
    function loop() {
      t++; ctx.clearRect(0, 0, c.width, c.height);
      let live = false;
      for (const p of ps) {
        p.x += p.vx + Math.sin(t * 0.04 + p.y * 0.03) * 0.4;
        p.y += p.vy; p.vy += 0.07; p.rot += p.spin;
        if (t > 85) p.a = Math.max(0, p.a - 0.012);
        if (p.a > 0) live = true;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (live) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Fireworks ─────────────────────────────────────────────────────────────────

function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return; const c = ref.current;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth; c.height = window.innerHeight;
    type P = { x: number; y: number; vx: number; vy: number; col: string; life: number; ml: number; sz: number };
    const ps: P[] = [];
    const COLORS = ['#22C55E','#3B82F6','#F59E0B','#EF4444','#A855F7','#06B6D4','#FFFFFF','#F97316'];

    function burst(x: number, y: number) {
      const col = pick(COLORS);
      const n = 55;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + r(-0.05, 0.05);
        const spd = r(2.5, 9);
        ps.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, col, life: 65, ml: 65, sz: r(1.5, 4) });
      }
      const col2 = pick(COLORS.filter(k => k !== col));
      for (let i = 0; i < 20; i++) {
        const angle = r(0, Math.PI * 2);
        const spd = r(1, 5);
        ps.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, col: col2, life: 50, ml: 50, sz: r(1, 2.5) });
      }
    }

    const spots: [number, number][] = [[0.2,0.25],[0.75,0.2],[0.5,0.3],[0.15,0.55],[0.82,0.45],[0.5,0.15]];
    const ts = spots.map(([px, py], i) => setTimeout(() => burst(c.width * px, c.height * py), i * 430));

    let raf: number;
    function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.vx *= 0.97; p.life--;
        ctx.save();
        ctx.globalAlpha = p.life / p.ml;
        ctx.fillStyle = p.col; ctx.shadowColor = p.col; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (p.life <= 0) ps.splice(i, 1);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ts.forEach(clearTimeout); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Racecar ───────────────────────────────────────────────────────────────────
// Three 🏎️s zoom across with speed streaks and a golden glow.

function Racecar() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes nut-car{from{transform:translateX(0)}to{transform:translateX(130vw)}}
        @keyframes nut-streak{from{opacity:.55;transform:scaleX(0);transform-origin:left}to{opacity:0;transform:scaleX(1);transform-origin:left}}
      `}</style>

      {/* Horizontal speed streaks */}
      {Array.from({ length: 14 }, (_, i) => (
        <div key={i} className="absolute h-px left-0"
          style={{
            top: `${4 + i * 6.5}%`,
            width: `${r(30, 70)}%`,
            background: 'linear-gradient(to right, rgba(255,220,80,0.6), rgba(255,255,255,0.3), transparent)',
            animationName: 'nut-streak',
            animationDuration: `${r(0.3, 0.6)}s`,
            animationDelay: `${r(0, 0.45)}s`,
            animationTimingFunction: 'ease-out',
            animationFillMode: 'forwards',
          }}
        />
      ))}

      {/* Cars */}
      {[
        { top: '28%', dur: '0.88s', delay: '0ms',   size: '3rem'  },
        { top: '52%', dur: '0.68s', delay: '160ms',  size: '2.4rem'},
        { top: '72%', dur: '1.05s', delay: '55ms',   size: '2rem'  },
      ].map((car, i) => (
        <div key={i} style={{
          position: 'absolute', top: car.top, left: '-12%',
          fontSize: car.size,
          animationName: 'nut-car',
          animationDuration: car.dur,
          animationDelay: car.delay,
          animationTimingFunction: 'ease-in',
          animationFillMode: 'forwards',
          filter: 'drop-shadow(0 0 14px rgba(255,180,0,0.95))',
        }}>
          🏎️
        </div>
      ))}
    </div>
  );
}

// ── Warp Speed ────────────────────────────────────────────────────────────────
// Stars radiate outward from the center and stretch into streaks — hyperspace.

function Warp() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return; const c = ref.current;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const cx = c.width / 2, cy = c.height / 2;

    const stars = Array.from({ length: 200 }, () => ({
      angle: r(0, Math.PI * 2),
      dist: r(2, 10),
      spd: r(3, 12),
    }));

    let raf: number; let t = 0;
    function loop() {
      ctx.clearRect(0, 0, c.width, c.height);
      t++;
      for (const s of stars) {
        const prev = s.dist;
        s.dist += s.spd * (1 + t * 0.022);
        const x1 = cx + Math.cos(s.angle) * prev;
        const y1 = cy + Math.sin(s.angle) * prev;
        const x2 = cx + Math.cos(s.angle) * s.dist;
        const y2 = cy + Math.sin(s.angle) * s.dist;
        const bright = Math.min(1, s.dist / 280);
        const b = Math.floor(bright * 100 + 155);
        ctx.strokeStyle = `rgba(${b},${b},255,${bright * 0.9})`;
        ctx.lineWidth = Math.min(2.5, s.dist / 110);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      if (t < 130) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Lightning ─────────────────────────────────────────────────────────────────
// Jagged bolts crackle down the screen with a blinding flash.

function Lightning() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return; const c = ref.current;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth; c.height = window.innerHeight;

    function zigzag(x1: number, y1: number, x2: number, y2: number, rough: number): [number, number][] {
      if (rough < 6) return [[x2, y2]];
      const mx = (x1 + x2) / 2 + r(-rough, rough);
      const my = (y1 + y2) / 2 + r(-rough / 4, rough / 4);
      return [...zigzag(x1, y1, mx, my, rough / 2), ...zigzag(mx, my, x2, y2, rough / 2)];
    }

    function drawBolt(x1: number, y1: number, x2: number, y2: number, alpha: number) {
      const pts = zigzag(x1, y1, x2, y2, 90);
      for (const [width, color, blur] of [[4, '#88CCFF', 25], [1.5, '#FFFFFF', 6]] as [number, string, number][]) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.shadowColor = '#44AAFF'; ctx.shadowBlur = blur;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        for (const [px, py] of pts) ctx.lineTo(px, py);
        ctx.stroke();
        ctx.restore();
      }
    }

    const bolts: [number, number, number, number][] = [
      [c.width * 0.25, 0, c.width * 0.28, c.height * 0.92],
      [c.width * 0.70, 0, c.width * 0.65, c.height * 0.88],
      [c.width * 0.50, 0, c.width * 0.53, c.height * 0.75],
    ];

    let raf: number; let t = 0;
    function loop() {
      ctx.clearRect(0, 0, c.width, c.height); t++;
      if (t < 5) {
        ctx.fillStyle = `rgba(180,210,255,${0.55 - t * 0.1})`;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      for (const bolt of bolts) {
        const alpha = Math.max(0, Math.sin(t * 0.38) * 0.9);
        if (alpha > 0) drawBolt(...bolt, alpha);
      }
      if (t < 85) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Pixel Explosion ───────────────────────────────────────────────────────────
// Retro game: chunky squares burst outward from the center.

function Pixels() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return; const c = ref.current;
    const ctx = c.getContext('2d')!;
    c.width = window.innerWidth; c.height = window.innerHeight;
    const cx = c.width / 2, cy = c.height / 2;
    const COLORS = ['#22C55E','#F59E0B','#EF4444','#3B82F6','#A855F7','#FFFFFF','#EC4899','#06B6D4','#F97316'];

    const ps = Array.from({ length: 90 }, () => {
      const angle = r(0, Math.PI * 2);
      const spd = r(4, 14);
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - r(1, 4),
        sz: r(9, 24), col: pick(COLORS),
        rot: r(0, Math.PI * 2), spin: r(-0.13, 0.13), a: 1,
      };
    });

    let raf: number; let t = 0;
    function loop() {
      ctx.clearRect(0, 0, c.width, c.height); t++;
      let live = false;
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.38; p.vx *= 0.98; p.rot += p.spin;
        if (t > 28) p.a = Math.max(0, p.a - 0.016);
        if (p.a > 0) live = true;
        ctx.save();
        ctx.globalAlpha = p.a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz / 2, p.sz / 2);
        ctx.restore();
      }
      if (live) raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Nutrons logos — zero-gravity bounce with red/white glow lights ────────────

export function NutronsBounce() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const W = canvas.width, H = canvas.height;

    const SZ  = 96;           // rendered logo size
    const RAD = SZ / 2 + 4;  // collision radius
    const N   = 10;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Drifting glow orbs — red and white
    const orbs = Array.from({ length: 12 }, () => ({
      x: r(0, W), y: r(0, H),
      vx: r(-0.7, 0.7), vy: r(-0.7, 0.7),
      radius: r(90, 220),
      isRed: Math.random() > 0.45,
      phase: r(0, Math.PI * 2),
    }));

    type Logo = { x: number; y: number; vx: number; vy: number; rot: number; spin: number };
    const logos: Logo[] = Array.from({ length: N }, () => ({
      x: r(RAD, W - RAD),
      y: r(RAD, H - RAD),
      vx: (Math.random() > 0.5 ? 1 : -1) * r(1.6, 3.8),
      vy: (Math.random() > 0.5 ? 1 : -1) * r(1.6, 3.8),
      rot: r(0, Math.PI * 2),
      spin: r(-0.025, 0.025),
    }));

    const img = new Image();
    img.src = `${import.meta.env.BASE_URL}NUTRONs.png`;

    let raf: number;
    let t = 0;

    function step() {
      t++;
      ctx.clearRect(0, 0, W, H);

      // Glow orbs (background lights)
      for (const orb of orbs) {
        orb.x += orb.vx; orb.y += orb.vy;
        if (orb.x < -orb.radius) orb.x = W + orb.radius;
        if (orb.x > W + orb.radius) orb.x = -orb.radius;
        if (orb.y < -orb.radius) orb.y = H + orb.radius;
        if (orb.y > H + orb.radius) orb.y = -orb.radius;
        const pulse = 0.06 + Math.sin(t * 0.035 + orb.phase) * 0.03;
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        if (orb.isRed) {
          g.addColorStop(0, `rgba(220,38,38,${pulse})`);
          g.addColorStop(1, 'rgba(220,38,38,0)');
        } else {
          g.addColorStop(0, `rgba(255,255,255,${pulse * 0.55})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2); ctx.fill();
      }

      // Move logos — zero gravity (no vy += gravity)
      for (const p of logos) {
        p.x += p.vx; p.y += p.vy; p.rot += p.spin;
        if (p.x - RAD < 0)  { p.x = RAD;     p.vx =  Math.abs(p.vx); }
        if (p.x + RAD > W)  { p.x = W - RAD; p.vx = -Math.abs(p.vx); }
        if (p.y - RAD < 0)  { p.y = RAD;     p.vy =  Math.abs(p.vy); }
        if (p.y + RAD > H)  { p.y = H - RAD; p.vy = -Math.abs(p.vy); }
      }

      // Elastic collisions between logos
      for (let i = 0; i < logos.length; i++) {
        for (let j = i + 1; j < logos.length; j++) {
          const a = logos[i], b = logos[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const minD = RAD * 2;
          if (d < minD && d > 0) {
            const nx = dx / d, ny = dy / d;
            const rv = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rv > 0) {
              a.vx -= rv * nx; a.vy -= rv * ny;
              b.vx += rv * nx; b.vy += rv * ny;
            }
            const ov = (minD - d) / 2;
            a.x -= nx * ov; a.y -= ny * ov;
            b.x += nx * ov; b.y += ny * ov;
          }
        }
      }

      // Draw logos with red glow
      for (const p of logos) {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.shadowColor = 'rgba(220,38,38,0.85)';
        ctx.shadowBlur = 20;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -SZ / 2, -SZ / 2, SZ, SZ);
        } else {
          ctx.fillStyle = '#DC2626';
          ctx.beginPath(); ctx.arc(0, 0, RAD - 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(step);
    }

    function start() { raf = requestAnimationFrame(step); }
    if (img.complete && img.naturalWidth > 0) start(); else img.onload = start;

    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function NutronsCelebrationOverlay() {
  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
      <NutronsBounce />
    </div>
  );
}

export function CelebrationOverlay() {
  const [kind] = useState<Kind>(() => pick(KINDS));
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), 3200);
    const t2 = setTimeout(() => setGone(true), 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity 700ms ease' }}
    >
      {kind === 'confetti'  && <Confetti />}
      {kind === 'fireworks' && <Fireworks />}
      {kind === 'racecar'   && <Racecar />}
      {kind === 'warp'      && <Warp />}
      {kind === 'lightning' && <Lightning />}
      {kind === 'pixels'    && <Pixels />}
    </div>
  );
}
