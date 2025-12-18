(() => {
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));

  // Footer year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // =========================
  // Index: Water canvas system
  // =========================
  const waterCanvas = $('#waterCanvas');
  if (waterCanvas) {
    const ctx = waterCanvas.getContext('2d', { alpha: true });
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    let W = 0, H = 0;
    let gw = 0, gh = 0;
    const cell = 8;
    let a, b;
    let pointer = { x: 0, y: 0, active: false, down: false, shift: false };
    let scrollY = 0;
    let rippleCount = 0;

    // Falling streams
    const streams = Array.from({ length: 9 }, (_, i) => ({
      x: 0.08 + i * 0.105,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 0.8,
      width: 0.8 + Math.random() * 1.4,
      jitter: Math.random() * 0.25
    }));

    function resize() {
      const rect = waterCanvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      waterCanvas.width = Math.floor(W * dpr);
      waterCanvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      gw = Math.max(60, Math.floor(W / cell));
      gh = Math.max(40, Math.floor(H / cell));
      a = new Float32Array(gw * gh);
      b = new Float32Array(gw * gh);

      // initial soft mist from top
      for (let i = 0; i < 14; i++) {
        splash((0.08 + Math.random() * 0.84) * W, (0.03 + Math.random() * 0.12) * H, 110 + Math.random() * 40);
      }
    }

    function idx(x, y) { return x + y * gw; }

    function splash(px, py, power) {
      const gx = Math.floor((px / W) * gw);
      const gy = Math.floor((py / H) * gh);
      const rad = 2 + Math.floor(Math.min(9, Math.max(2, power * 0.06)));

      for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
          const xx = gx + x, yy = gy + y;
          if (xx < 1 || yy < 1 || xx >= gw - 1 || yy >= gh - 1) continue;
          const d = Math.hypot(x, y);
          if (d > rad) continue;
          const k = 1 - d / (rad + 0.0001);
          a[idx(xx, yy)] += k * power;
        }
      }
      rippleCount++;
    }

    function onPointer(e) {
      const rect = waterCanvas.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left);
      pointer.y = (e.clientY - rect.top);
      pointer.active = true;
      pointer.shift = e.shiftKey;
    }

    waterCanvas.addEventListener('pointerdown', (e) => {
      waterCanvas.setPointerCapture(e.pointerId);
      onPointer(e);
      pointer.down = true;
      splash(pointer.x, pointer.y, pointer.shift ? 190 : 140);
    });

    waterCanvas.addEventListener('pointermove', (e) => {
      onPointer(e);
      if (pointer.down) {
        splash(pointer.x, pointer.y, pointer.shift ? 40 : 26);
      }
    }, { passive: true });

    waterCanvas.addEventListener('pointerup', () => {
      pointer.down = false;
    });

    window.addEventListener('wheel', (e) => {
      scrollY += e.deltaY;
      scrollY = Math.max(-1200, Math.min(1200, scrollY));
    }, { passive: true });

    window.addEventListener('resize', resize, { passive: true });

    function step(t) {
      // Slowly relax scrollY toward 0 (for gentle current)
      scrollY *= 0.985;

      // Tide effect for foam strip on index
      const tide = (Math.sin(t * 0.00065) * 0.5 + 0.5);
      const tideEl = $('#tideFoam');
      const tideChip = $('#tideChip');
      const rippleChip = $('#rippleChip');
      if (tideEl) {
        const drift = (t * 0.004 + scrollY * 0.04) % 100;
        tideEl.style.transform = `translateX(${drift}%)`;
        tideEl.style.opacity = (0.55 + tide * 0.25).toFixed(2);
      }
      if (tideChip) tideChip.textContent = `Tide: ${(tide * 100).toFixed(0)}%`;
      if (rippleChip) rippleChip.textContent = `Ripples: ${rippleCount}`;

      // Update floral overlay with scroll (subtle)
      const floral = $('.floralOverlay');
      if (floral) {
        const y = Math.max(-30, Math.min(30, scrollY * 0.015));
        floral.style.transform = `translateY(${y}px)`;
        floral.style.opacity = (0.88 + tide * 0.10).toFixed(2);
      }

      // Wave propagation with slight advection (current)
      const damp = pointer.shift ? 0.975 : 0.982;
      const cx = (scrollY / 1200) * 0.7;
      const cy = Math.sin(t * 0.00028) * 0.06;

      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = idx(x, y);
          const lap =
            a[idx(x - 1, y)] + a[idx(x + 1, y)] +
            a[idx(x, y - 1)] + a[idx(x, y + 1)] -
            a[i] * 4;

          const sx = x - Math.sign(cx);
          const sy = y - Math.sign(cy);
          const adv = a[idx(
            Math.max(1, Math.min(gw - 2, sx)),
            Math.max(1, Math.min(gh - 2, sy))
          )] * 0.12;

          b[i] = (a[i] + lap * 0.52 + adv) * damp;
        }
      }

      // Falling streams: inject small disturbances from top
      for (const s of streams) {
        const x = (s.x + Math.sin(t * 0.0008 * s.speed + s.phase) * 0.012 + Math.sin(t * 0.0017 + s.phase) * s.jitter * 0.004) * W;
        const y = (0.02 + (t * 0.00006 * s.speed) % 0.25) * H;
        splash(x, y, 34 * s.width);
      }

      // Swap
      const tmp = a; a = b; b = tmp;

      render(t, tide, cx, cy);
      requestAnimationFrame(step);
    }

    function render(t, tide, cx, cy) {
      ctx.clearRect(0, 0, W, H);

      // Base gradient wash
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(14,165,167,0.08)');
      bg.addColorStop(0.5, 'rgba(45,212,191,0.05)');
      bg.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Waterfall sheen from top
      const curtain = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      curtain.addColorStop(0, `rgba(231,251,255,${0.14 + tide * 0.10})`);
      curtain.addColorStop(0.55, 'rgba(45,212,191,0.07)');
      curtain.addColorStop(1, 'rgba(231,251,255,0)');
      ctx.fillStyle = curtain;
      ctx.fillRect(0, 0, W, H * 0.62);

      // Foam tiles
      const px = W / gw;
      const py = H / gh;

      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = idx(x, y);
          const v = a[i];
          const slope =
            Math.abs(a[idx(x + 1, y)] - a[idx(x - 1, y)]) +
            Math.abs(a[idx(x, y + 1)] - a[idx(x, y - 1)]);

          const foam = Math.max(0, (slope * 0.45 + v * 0.10) - 0.45);
          if (foam <= 0) continue;

          const alpha = Math.min(0.20, foam * 0.075 + tide * 0.03);
          ctx.fillStyle = `rgba(234,246,244,${alpha})`;
          ctx.fillRect(x * px, y * py, px + 1, py + 1);
        }
      }

      // Ultra-subtle current hint
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.translate(W - 110, H - 80);
      ctx.rotate(Math.atan2(cy, cx || 0.001));
      ctx.strokeStyle = 'rgba(231,251,255,0.40)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(15, -8);
      ctx.lineTo(15, 8);
      ctx.closePath();
      ctx.fillStyle = 'rgba(231,251,255,0.18)';
      ctx.fill();
      ctx.restore();
    }

    resize();
    requestAnimationFrame(step);
  }

  // =========================
  // Resume interactions
  // =========================
  const toggleDensity = $('#toggleDensity');
  if (toggleDensity) {
    toggleDensity.addEventListener('click', () => {
      document.body.classList.toggle('compact');
    });
  }

  const toggleHighlights = $('#toggleHighlights');
  if (toggleHighlights) {
    toggleHighlights.addEventListener('click', () => {
      document.body.classList.toggle('highlightSkills');
      const on = document.body.classList.contains('highlightSkills');
      toggleHighlights.textContent = on ? 'Unhighlight skills' : 'Highlight skills';
    });
  }

  // Collapse controls for resume sections
  $$('.disclosure').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (!target) return;
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      btn.textContent = isOpen ? 'Expand' : 'Collapse';
      target.style.display = isOpen ? 'none' : 'block';
    });
  });

  // Skill emphasis
  const skillDetail = $('#skillDetail');
  const skillList = $('#skillList');
  const pills = $$('.pill');
  if (pills.length && skillDetail && skillList) {
    const descriptions = {
      html: 'Semantics, accessibility patterns, form structure, and clean document hierarchy.',
      css: 'Responsive layout with Flex/Grid, readable spacing, and calm motion.',
      js: 'DOM interactions, canvas effects, event handling, and performance-safe animation.',
      data: 'Embedding interactive visualizations and presenting data clearly.',
      ux: 'Information architecture, clarity-first writing, and scannable structure.',
      team: 'Collaboration workflows, version control habits, and stakeholder alignment.'
    };

    function setActive(skill) {
      pills.forEach(p => p.classList.toggle('active', p.dataset.skill === skill));

      // highlight matching list items
      $$('#skillList li').forEach(li => {
        const match = li.dataset.skill === skill;
        li.style.opacity = match ? '1' : '0.65';
        li.style.transform = match ? 'translateX(2px)' : 'translateX(0px)';
      });

      skillDetail.textContent = descriptions[skill] || 'Select a skill to emphasize related items.';
    }

    pills.forEach(p => p.addEventListener('click', () => setActive(p.dataset.skill)));
  }

  // =========================
  // Projects interactions
  // =========================

  // Project 1: Ripple card canvas
  $$('.rippleCard').forEach(card => {
    const c = $('.miniCanvas', card);
    if (!c) return;
    const ctx = c.getContext('2d', { alpha: true });

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width, H = rect.height;
    const gw = Math.max(70, Math.floor(W / 7));
    const gh = Math.max(30, Math.floor(H / 7));
    let a = new Float32Array(gw * gh);
    let b = new Float32Array(gw * gh);

    const idx = (x, y) => x + y * gw;

    function splash(xp, yp, pwr) {
      const gx = Math.floor((xp / W) * gw);
      const gy = Math.floor((yp / H) * gh);
      const rad = 3;
      for (let y = -rad; y <= rad; y++) {
        for (let x = -rad; x <= rad; x++) {
          const xx = gx + x, yy = gy + y;
          if (xx < 1 || yy < 1 || xx >= gw - 1 || yy >= gh - 1) continue;
          const d = Math.hypot(x, y);
          if (d > rad) continue;
          a[idx(xx, yy)] += (1 - d / (rad + 0.001)) * pwr;
        }
      }
    }

    function render(t) {
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, 'rgba(45,212,191,0.12)');
      bg.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const px = W / gw, py = H / gh;

      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = idx(x, y);
          const slope =
            Math.abs(a[idx(x + 1, y)] - a[idx(x - 1, y)]) +
            Math.abs(a[idx(x, y + 1)] - a[idx(x, y - 1)]);
          const foam = Math.max(0, (slope * 0.45 + a[i] * 0.08) - 0.40);
          if (foam <= 0) continue;
          const alpha = Math.min(0.22, foam * 0.08);
          ctx.fillStyle = `rgba(234,246,244,${alpha})`;
          ctx.fillRect(x * px, y * py, px + 1, py + 1);
        }
      }

      // subtle glint band
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = 'rgba(231,251,255,0.12)';
      const yy = (Math.sin(t * 0.0012) * 0.5 + 0.5) * H;
      ctx.fillRect(0, yy, W, 10);
      ctx.restore();
    }

    function step(t) {
      const damp = 0.982;
      for (let y = 1; y < gh - 1; y++) {
        for (let x = 1; x < gw - 1; x++) {
          const i = idx(x, y);
          const lap =
            a[idx(x - 1, y)] + a[idx(x + 1, y)] +
            a[idx(x, y - 1)] + a[idx(x, y + 1)] -
            a[i] * 4;
          b[i] = (a[i] + lap * 0.52) * damp;
        }
      }
      const tmp = a; a = b; b = tmp;
      render(t);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    // hover/touch ripple
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left);
      const y = (e.clientY - r.top);
      if (e.buttons) splash(x, y, e.shiftKey ? 120 : 75);
      else splash(x, y, 10);
    }, { passive: true });

    const btn = $('.projectBtn', card);
    if (btn) btn.addEventListener('click', () => splash(W * 0.5, H * 0.5, 140));
  });

  // Project 2: Waterfall curtain reveal driven by scroll proximity
  const curtain = $('#waterCurtain');
  const resetCurtain = $('#resetCurtain');
  if (curtain) {
    let state = 0; // 0..1
    function update() {
      // map state -> translateY
      const y = (-52 + state * 76); // from above to below
      curtain.style.transform = `translateY(${y}%)`;
    }
    update();

    function onScroll() {
      // find card position
      const box = curtain.parentElement;
      const rect = box.getBoundingClientRect();
      const mid = rect.top + rect.height * 0.5;
      const vh = window.innerHeight || 800;
      const dist = Math.abs(mid - vh * 0.52);
      const influence = Math.max(0, 1 - dist / (vh * 0.55));
      state = Math.max(state, influence * 0.95);
      state *= 0.992; // slow relax
      update();
      requestAnimationFrame(onScroll);
    }
    requestAnimationFrame(onScroll);

    if (resetCurtain) {
      resetCurtain.addEventListener('click', () => {
        state = 0;
        update();
      });
    }
  }

  // Project 3: Current pond floating tags (drag + click to change current)
  const pond = $('.currentPond');
  if (pond) {
    const tags = $$('.floatTag', pond);
    const chip = $('#currentChip');

    // seed positions
    const pr = pond.getBoundingClientRect();
    tags.forEach((t, i) => {
      t.style.left = `${18 + (i % 3) * 90}px`;
      t.style.top = `${18 + Math.floor(i / 3) * 46}px`;
      t.dataset.vx = String((Math.random() * 0.8 - 0.4) * 2);
      t.dataset.vy = String((Math.random() * 0.8 - 0.4) * 2);
    });

    let cur = { x: 0.45, y: 0.12 };
    let dragging = null;
    let offset = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let lastT = performance.now();

    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

    pond.addEventListener('pointerdown', (e) => {
      const target = e.target;
      if (target.classList.contains('floatTag')) {
        dragging = target;
        const r = target.getBoundingClientRect();
        offset.x = e.clientX - r.left;
        offset.y = e.clientY - r.top;
        last.x = e.clientX;
        last.y = e.clientY;
        lastT = performance.now();
        target.setPointerCapture(e.pointerId);
      } else {
        // click pond to rotate current direction
        const nx = -cur.y;
        const ny = cur.x;
        cur.x = nx;
        cur.y = ny;
      }
    });

    pond.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = pond.getBoundingClientRect();
      const x = clamp(e.clientX - r.left - offset.x, 8, r.width - 8 - dragging.offsetWidth);
      const y = clamp(e.clientY - r.top - offset.y, 8, r.height - 8 - dragging.offsetHeight);
      dragging.style.left = `${x}px`;
      dragging.style.top = `${y}px`;

      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const vx = (e.clientX - last.x) / dt;
      const vy = (e.clientY - last.y) / dt;
      dragging.dataset.vx = String(vx * 22);
      dragging.dataset.vy = String(vy * 22);
      last.x = e.clientX;
      last.y = e.clientY;
      lastT = now;
    }, { passive: true });

    pond.addEventListener('pointerup', () => { dragging = null; });

    function tick() {
      const r = pond.getBoundingClientRect();
      for (const t of tags) {
        if (t === dragging) continue;

        let x = parseFloat(t.style.left || '0');
        let y = parseFloat(t.style.top || '0');
        let vx = parseFloat(t.dataset.vx || '0');
        let vy = parseFloat(t.dataset.vy || '0');

        // apply current
        vx += cur.x * 0.06;
        vy += cur.y * 0.06;

        // friction
        vx *= 0.94;
        vy *= 0.94;

        x += vx;
        y += vy;

        // bounce
        const maxX = r.width - 8 - t.offsetWidth;
        const maxY = r.height - 8 - t.offsetHeight;
        if (x < 8) { x = 8; vx *= -0.6; }
        if (y < 8) { y = 8; vy *= -0.6; }
        if (x > maxX) { x = maxX; vx *= -0.6; }
        if (y > maxY) { y = maxY; vy *= -0.6; }

        t.style.left = `${x}px`;
        t.style.top = `${y}px`;
        t.dataset.vx = String(vx);
        t.dataset.vy = String(vy);
      }

      if (chip) {
        const dir = Math.abs(cur.x) > Math.abs(cur.y)
          ? (cur.x >= 0 ? '→' : '←')
          : (cur.y >= 0 ? '↓' : '↑');
        chip.textContent = `Current: ${dir}`;
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Project 4: Bloom particle canvas
  $$('.bloomCanvas').forEach((c) => {
    const ctx = c.getContext('2d', { alpha: true });
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function fit() {
      const r = c.getBoundingClientRect();
      c.width = Math.floor(r.width * dpr);
      c.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fit();
    window.addEventListener('resize', fit, { passive: true });

    const parts = [];
    function spawn(x, y, dense) {
      const n = dense ? 60 : 32;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = (dense ? 1.9 : 1.4) + Math.random() * 2.2;
        parts.push({
          x, y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp * 0.85 - 0.6,
          life: 1,
          r: 2 + Math.random() * 2.8,
          hue: 330 + Math.random() * 40, // pink-ish range (computed, not described)
          drift: (Math.random() * 0.8 - 0.4)
        });
      }
    }

    c.addEventListener('pointerdown', (e) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      spawn(x, y, e.shiftKey);
    });

    const btn = c.closest('.projectCard')?.querySelector('.bloomBtn');
    if (btn) btn.addEventListener('click', () => {
      const r = c.getBoundingClientRect();
      spawn(r.width * 0.5, r.height * 0.58, false);
    });

    function draw(t) {
      const r = c.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);

      // soft lagoon wash
      const bg = ctx.createLinearGradient(0, 0, 0, r.height);
      bg.addColorStop(0, 'rgba(45,212,191,0.10)');
      bg.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, r.width, r.height);

      // float petals
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vy += 0.012; // gentle gravity
        p.x += p.vx + Math.sin(t * 0.001 + p.drift) * 0.12;
        p.y += p.vy;

        p.life *= 0.986;

        // bounds soft wrap
        if (p.x < -20) p.x = r.width + 20;
        if (p.x > r.width + 20) p.x = -20;

        const alpha = Math.max(0, Math.min(0.22, p.life * 0.22));
        ctx.fillStyle = `rgba(255, 180, 210, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 1.25, p.r * 0.85, (t * 0.002 + i) % Math.PI, 0, Math.PI * 2);
        ctx.fill();

        if (p.life < 0.05 || p.y > r.height + 30) parts.splice(i, 1);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    // initial gentle bloom
    const rr = c.getBoundingClientRect();
    spawn(rr.width * 0.38, rr.height * 0.62, false);
  });

})();
