import maplibregl, { Map } from 'maplibre-gl';

// Starfield canvas animation
(function () {
  const canvas = document.getElementById('sky') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;

  let width = 0;
  let height = 0;
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  let particles: Array<any> = [];
  let lastTime = performance.now();

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    initParticles();
  }

  function initParticles() {
    const area = width * height;
    const densityPerK = prefersReduced ? 0.05 : 0.12;
    const count = Math.min(1000, Math.floor((area / 1000) * densityPerK));
    particles = new Array(count).fill(0).map(createParticle);
  }

  function createParticle() {
    const depth = 0.2 + Math.random() * 0.8;
    const colorPick = Math.random();
    const color = colorPick < 0.06 ? '125, 211, 252' : colorPick < 0.12 ? '248, 250, 252' : '148, 163, 184';
    const baseSpeed = prefersReduced ? 0.01 : 0.024;
    const direction = Math.random() * Math.PI * 2;
    const speed = baseSpeed * (1 - depth);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      z: depth,
      vx: Math.cos(direction) * speed * width,
      vy: Math.sin(direction) * speed * height,
      r: Math.max(0.6, (1 - depth) * 1.8 + Math.random() * 0.6),
      a: 0.4 + Math.random() * 0.6,
      twinkleAmp: prefersReduced ? 0 : 0.4 * (1 - depth),
      twinkleFreq: (0.5 + Math.random() * 1.5) * 0.6,
      phase: Math.random() * Math.PI * 2,
      color: color
    };
  }

  function drawGlow(x: number, y: number, r: number, a: number, rgb: string) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    gradient.addColorStop(0, `rgba(${rgb}, ${a})`);
    gradient.addColorStop(0.5, `rgba(${rgb}, ${a * 0.6})`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function step(now: number) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);
    parallax.x += (parallax.tx - parallax.x) * 0.06;
    parallax.y += (parallax.ty - parallax.y) * 0.06;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx * dt * (1 - p.z) * 1.2;
      p.y += p.vy * dt * (1 - p.z) * 1.2;
      const margin = 12;
      if (p.x < -margin) p.x = width + margin;
      if (p.x > width + margin) p.x = -margin;
      if (p.y < -margin) p.y = height + margin;
      if (p.y > height + margin) p.y = -margin;
      const twinkle = p.twinkleAmp * Math.sin(now * 0.001 * p.twinkleFreq + p.phase);
      const alpha = Math.max(0, Math.min(1, p.a + twinkle));
      const ox = parallax.x * (1 - p.z);
      const oy = parallax.y * (1 - p.z);
      drawGlow(p.x + ox, p.y + oy, p.r, alpha, p.color);
    }
    requestAnimationFrame(step);
  }

  function onPointerMove(e: MouseEvent) {
    if (prefersReduced) return;
    const cx = (e.clientX / width - 0.5) * 40;
    const cy = (e.clientY / height - 0.5) * 40;
    parallax.tx = cx; parallax.ty = cy;
  }

  function onDeviceTilt(e: DeviceOrientationEvent) {
    if (prefersReduced) return;
    const gamma = e.gamma || 0; const beta = e.beta || 0;
    parallax.tx = Math.max(-40, Math.min(40, gamma));
    parallax.ty = Math.max(-40, Math.min(40, beta));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onPointerMove, { passive: true } as any);
  window.addEventListener('deviceorientation', onDeviceTilt as any, { passive: true } as any);
  resize();
  requestAnimationFrame(step);
})();

// MapLibre initialization (interactive, dark style) with first-visit animation
export function initMapIfPresent(): void {
  const el = document.getElementById('map');
  if (!el) return;
  const sofia: [number, number] = [23.3219, 42.6977];
  const map: Map = new maplibregl.Map({
    container: el as HTMLElement,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: sofia,
    zoom: 0.5,
    attributionControl: false,
    interactive: true
  });
  // Ensure all interactive handlers are on
  map.scrollZoom.enable();
  map.boxZoom.enable();
  map.dragPan.enable();
  map.keyboard.enable();
  map.doubleClickZoom.enable();
  map.on('load', () => {
    // Start fully zoomed out and slowly zoom to Sofia every load
    map.jumpTo({ center: sofia, zoom: 0.5 });
    map.easeTo({
      center: sofia,
      zoom: 11,
      duration: 9000,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true
    });
    new maplibregl.Marker({ color: '#38bdf8' }).setLngLat(sofia).addTo(map);
    const elTime = document.querySelector('.time-badge');
    if (elTime) {
      const formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Sofia' });
      const parts = formatter.format(new Date());
      (elTime as HTMLElement).textContent = parts + ' EET';
    }
  });
}

// Call once DOM is parsed
initMapIfPresent();


