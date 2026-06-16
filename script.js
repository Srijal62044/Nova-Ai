/* ═══════════════════════════════════════════════════════════
   BIRTHDAY TRIBUTE — built_with_amaan
   Ultra-premium birthday website — JavaScript
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Helpers ─────────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max));

/* ═══════════════════════════════════════════════════════════
   LOADING SCREEN
   ═══════════════════════════════════════════════════════════ */
(function initLoader() {
  const loader = $('#loader');
  const progressBar = $('#progressBar');
  const loaderPct = $('#loaderPct');

  const lines = [
    { id: 'cmd1', lineId: null,  text: 'initializing birthday experience...', delay: 300 },
    { id: 'cmd2', lineId: 'line2', text: 'loading memories...',               delay: 1200 },
    { id: 'cmd3', lineId: 'line3', text: 'preparing celebration...',           delay: 2100 },
    { id: 'cmd4', lineId: 'line4', text: 'birthday experience ready! 🎉',      delay: 3000 },
  ];

  let progress = 0;
  const progressInterval = setInterval(() => {
    progress = Math.min(progress + rand(0.5, 2.5), 100);
    progressBar.style.width = progress + '%';
    loaderPct.textContent = Math.floor(progress) + '%';
    if (progress >= 100) clearInterval(progressInterval);
  }, 50);

  function typeText(el, text, speed = 40) {
    return new Promise(resolve => {
      let i = 0;
      const interval = setInterval(() => {
        el.textContent += text[i];
        i++;
        if (i >= text.length) { clearInterval(interval); resolve(); }
      }, speed);
    });
  }

  async function runLines() {
    for (const line of lines) {
      await new Promise(r => setTimeout(r, line.delay === lines[0].delay ? 300 : 200));
      if (line.lineId) {
        const lineEl = $('#' + line.lineId);
        if (lineEl) lineEl.classList.remove('hidden');
      }
      const el = $('#' + line.id);
      if (el) await typeText(el, line.text);
    }
    // Hide loader after short pause
    setTimeout(() => {
      loader.classList.add('hidden');
      document.body.style.cursor = 'none';
    }, 600);
  }

  runLines();
})();

/* ═══════════════════════════════════════════════════════════
   CURSOR GLOW
   ═══════════════════════════════════════════════════════════ */
(function initCursor() {
  const glow = $('#cursorGlow');
  if (!glow) return;
  let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  let tx = cx, ty = cy;

  document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });

  function animate() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    glow.style.left = cx + 'px';
    glow.style.top  = cy + 'px';
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ═══════════════════════════════════════════════════════════
   BACKGROUND STAR CANVAS
   ═══════════════════════════════════════════════════════════ */
(function initBgCanvas() {
  const canvas = $('#bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars();
  }

  function initStars() {
    stars = Array.from({ length: 180 }, () => ({
      x:    rand(0, canvas.width),
      y:    rand(0, canvas.height),
      r:    rand(0.4, 2.2),
      a:    rand(0.1, 0.8),
      da:   rand(0.002, 0.008) * (Math.random() < 0.5 ? 1 : -1),
      dx:   rand(-0.05, 0.05),
      dy:   rand(-0.05, 0.05),
    }));
  }

  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => {
      s.a += s.da;
      if (s.a > 0.9 || s.a < 0.05) s.da *= -1;
      s.x = (s.x + s.dx + canvas.width) % canvas.width;
      s.y = (s.y + s.dy + canvas.height) % canvas.height;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    });
    requestAnimationFrame(drawStars);
  }

  window.addEventListener('resize', resize);
  resize();
  drawStars();
})();

/* ═══════════════════════════════════════════════════════════
   FLOATING CODE SYMBOLS
   ═══════════════════════════════════════════════════════════ */
(function initFloatingSymbols() {
  const container = $('#floatingSymbols');
  if (!container) return;

  const symbols = [
    '<div>', '</div>', 'const', 'let', 'fn()', '=>', '{}', '[]',
    'if()', '&&', '||', '===', 'async', 'await', 'import', 'return',
    '.py', '.js', '.html', '#ai', 'git push', 'npm i', '</>',
    'print()', 'for i in', 'def', 'class', 'API', '0x1F', '✓',
    '#!/usr', 'ctrl+', 'alt+', 'create', '404', '200 OK'
  ];

  function createSymbol() {
    const sym = document.createElement('div');
    sym.className = 'float-sym';
    sym.textContent = symbols[randInt(0, symbols.length)];
    sym.style.left = rand(0, 100) + 'vw';
    sym.style.animationDuration = rand(12, 28) + 's';
    sym.style.animationDelay = rand(0, 6) + 's';
    sym.style.fontSize = rand(10, 16) + 'px';
    sym.style.opacity = rand(0.1, 0.35);
    container.appendChild(sym);
    setTimeout(() => sym.remove(), 30000);
  }

  for (let i = 0; i < 20; i++) setTimeout(createSymbol, i * 400);
  setInterval(createSymbol, 1800);
})();

/* ═══════════════════════════════════════════════════════════
   NAV SCROLL EFFECT
   ═══════════════════════════════════════════════════════════ */
(function initNav() {
  const nav = $('#siteNav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ═══════════════════════════════════════════════════════════
   HERO BALLOONS
   ═══════════════════════════════════════════════════════════ */
(function initBalloons() {
  const container = $('#balloons');
  if (!container) return;
  const emojis = ['🎈', '🎉', '🎊', '🎂', '🥳', '✨', '💜', '💙', '🩵'];

  function spawnBalloon() {
    const b = document.createElement('div');
    b.className = 'balloon';
    b.textContent = emojis[randInt(0, emojis.length)];
    b.style.left = rand(5, 95) + 'vw';
    b.style.animationDuration = rand(8, 16) + 's';
    b.style.animationDelay = '0s';
    b.style.fontSize = rand(1.2, 2.8) + 'rem';
    container.appendChild(b);
    setTimeout(() => b.remove(), 17000);
  }

  for (let i = 0; i < 8; i++) setTimeout(spawnBalloon, i * 600);
  setInterval(spawnBalloon, 2200);
})();

/* ═══════════════════════════════════════════════════════════
   HERO TYPING EFFECT
   ═══════════════════════════════════════════════════════════ */
(function initHeroTyping() {
  const el = $('#heroTyping');
  if (!el) return;
  const words = ['Developer', 'Creator', 'Innovator', 'Problem Solver', 'Inspiration'];
  let wi = 0, ci = 0, deleting = false;

  function tick() {
    const word = words[wi];
    if (!deleting) {
      el.textContent = word.slice(0, ci + 1);
      ci++;
      if (ci === word.length) { deleting = true; setTimeout(tick, 1800); return; }
    } else {
      el.textContent = word.slice(0, ci - 1);
      ci--;
      if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
    }
    setTimeout(tick, deleting ? 60 : 90);
  }
  setTimeout(tick, 2000);
})();

/* ═══════════════════════════════════════════════════════════
   HERO CONFETTI
   ═══════════════════════════════════════════════════════════ */
(function initConfetti() {
  const canvas = $('#confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let pieces = [];
  const colors = ['#8b5cf6','#3b82f6','#22d3ee','#f59e0b','#ec4899','#a78bfa','#67e8f9','#fbbf24'];

  function resize() {
    canvas.width  = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawnPiece() {
    pieces.push({
      x:   rand(0, canvas.width),
      y:   rand(-20, -5),
      w:   rand(6, 14),
      h:   rand(6, 14),
      rot: rand(0, 360),
      dRot: rand(-4, 4),
      vy:  rand(1.5, 3.5),
      vx:  rand(-1, 1),
      color: colors[randInt(0, colors.length)],
      alpha: 1,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter(p => p.alpha > 0.05);
    pieces.forEach(p => {
      p.y  += p.vy;
      p.x  += p.vx;
      p.rot += p.dRot;
      if (p.y > canvas.height * 0.7) p.alpha -= 0.02;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    requestAnimationFrame(animate);
  }

  // Spawn confetti in bursts on load and periodically
  function burst(count) {
    for (let i = 0; i < count; i++) setTimeout(spawnPiece, i * 30);
  }

  setTimeout(() => burst(80), 3800);
  setInterval(() => burst(20), 5000);
  animate();
})();

/* ═══════════════════════════════════════════════════════════
   ABOUT PARTICLES
   ═══════════════════════════════════════════════════════════ */
(function initAboutParticles() {
  const container = $('#aboutParticles');
  if (!container) return;

  function spawnParticle() {
    const p = document.createElement('div');
    p.className = 'about-particle';
    p.style.left = rand(10, 90) + '%';
    p.style.bottom = '0';
    p.style.width = rand(2, 5) + 'px';
    p.style.height = p.style.width;
    p.style.animationDuration = rand(4, 9) + 's';
    p.style.animationDelay = rand(0, 3) + 's';
    const hue = randInt(220, 290);
    p.style.background = `hsl(${hue}, 80%, 65%)`;
    container.appendChild(p);
    setTimeout(() => p.remove(), 10000);
  }

  for (let i = 0; i < 10; i++) setTimeout(spawnParticle, i * 300);
  setInterval(spawnParticle, 1200);
})();

/* ═══════════════════════════════════════════════════════════
   SCROLL REVEAL
   ═══════════════════════════════════════════════════════════ */
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
          // Animate skill bars when visible
          $$('.skill-bar', entry.target).forEach(bar => {
            const w = bar.dataset.width;
            setTimeout(() => { bar.style.width = w + '%'; }, 100);
          });
          // Trigger stat counters
          $$('.stat-num', entry.target).forEach(num => {
            animateCounter(num);
          });
        }, i * 80);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  $$('.reveal').forEach(el => observer.observe(el));

  // Also observe skill cards for bar animation
  const skillObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        $$('.skill-bar', entry.target).forEach(bar => {
          bar.style.width = (bar.dataset.width || 0) + '%';
        });
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.3 });
  $$('.skill-card').forEach(el => skillObs.observe(el));
})();

/* ═══════════════════════════════════════════════════════════
   STAT COUNTER ANIMATION
   ═══════════════════════════════════════════════════════════ */
function animateCounter(el) {
  if (el.dataset.animated) return;
  el.dataset.animated = '1';
  const target = parseInt(el.dataset.target, 10) || 0;
  const duration = 1600;
  const startTime = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.floor(easeOut(progress) * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

// Trigger counters on Instagram section scroll
(function initStatObserver() {
  const statNums = $$('.stat-num');
  if (!statNums.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) animateCounter(e.target); });
  }, { threshold: 0.5 });
  statNums.forEach(n => obs.observe(n));
})();

/* ═══════════════════════════════════════════════════════════
   FIREWORKS CANVAS (Celebration Section)
   ═══════════════════════════════════════════════════════════ */
(function initFireworks() {
  const canvas = $('#fireworksCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let fireworks = [];
  let particles = [];
  let active = false;

  function resize() {
    canvas.width  = canvas.parentElement.offsetWidth  || window.innerWidth;
    canvas.height = canvas.parentElement.offsetHeight || window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const colors = [
    '#8b5cf6','#a78bfa','#3b82f6','#60a5fa',
    '#22d3ee','#67e8f9','#f59e0b','#fbbf24',
    '#ec4899','#f472b6','#ffffff'
  ];

  class Firework {
    constructor() {
      this.x = rand(canvas.width * 0.1, canvas.width * 0.9);
      this.y = canvas.height;
      this.tx = rand(canvas.width * 0.1, canvas.width * 0.9);
      this.ty = rand(canvas.height * 0.1, canvas.height * 0.5);
      this.color = colors[randInt(0, colors.length)];
      this.speed = rand(4, 8);
      const dx = this.tx - this.x;
      const dy = this.ty - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
      this.trail = [];
      this.dead = false;
    }
    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 12) this.trail.shift();
      this.x += this.vx;
      this.y += this.vy;
      const dx = this.tx - this.x;
      const dy = this.ty - this.y;
      if (Math.sqrt(dx*dx + dy*dy) < 8) {
        this.explode();
        this.dead = true;
      }
    }
    explode() {
      const count = randInt(60, 100);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = rand(1.5, 5);
        particles.push({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: this.color,
          alpha: 1,
          r: rand(1.5, 3.5),
          decay: rand(0.012, 0.025),
          gravity: 0.07,
        });
      }
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.shadowBlur = 0;
      this.trail.forEach((p, i) => {
        const alpha = (i / this.trail.length) * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace(')', `,${alpha})`).replace('rgb', 'rgba');
        ctx.fill();
      });
    }
  }

  function launchFirework() {
    fireworks.push(new Firework());
  }

  function animate() {
    ctx.fillStyle = 'rgba(5,5,5,0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    fireworks = fireworks.filter(f => { f.update(); f.draw(); return !f.dead; });
    particles = particles.filter(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.98;
      p.alpha -= p.decay;
      if (p.alpha <= 0) return false;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${hexToRgb(p.color)},${p.alpha})`;
      ctx.fill();
      return true;
    });

    if (active) requestAnimationFrame(animate);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  // Observe celebration section
  const celSection = $('#celebration');
  if (celSection) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !active) {
          active = true;
          animate();
          // Launch fireworks in waves
          for (let i = 0; i < 8; i++) setTimeout(launchFirework, i * 400);
          setInterval(launchFirework, 1200);
        }
      });
    }, { threshold: 0.2 });
    obs.observe(celSection);
  }
})();

/* ═══════════════════════════════════════════════════════════
   CELEBRATION SPARKLES
   ═══════════════════════════════════════════════════════════ */
(function initSparkles() {
  const container = $('#celSparks');
  if (!container) return;
  const colors = ['#8b5cf6','#22d3ee','#f59e0b','#ec4899','#3b82f6','#a78bfa'];

  for (let i = 0; i < 30; i++) {
    const sp = document.createElement('div');
    sp.className = 'spark';
    sp.style.cssText = `
      left:${rand(5, 95)}%;
      top:${rand(5, 95)}%;
      width:${rand(3, 8)}px;
      height:${rand(3, 8)}px;
      background:${colors[randInt(0, colors.length)]};
      box-shadow:0 0 ${rand(4,12)}px ${colors[randInt(0, colors.length)]};
      animation-duration:${rand(2, 4)}s;
      animation-delay:${rand(0, 3)}s;
      position:absolute;
      border-radius:50%;
    `;
    container.appendChild(sp);
  }
})();

/* ═══════════════════════════════════════════════════════════
   SMOOTH SCROLL for CTA and nav links
   ═══════════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   SKILL BARS — observe and animate
   ═══════════════════════════════════════════════════════════ */
(function initSkillBars() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target.querySelector('.skill-bar');
        if (bar) {
          setTimeout(() => {
            bar.style.width = (bar.dataset.width || 0) + '%';
          }, 200);
        }
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });

  document.querySelectorAll('.skill-card').forEach(card => obs.observe(card));
})();

/* ═══════════════════════════════════════════════════════════
   TIMELINE STAGGER REVEAL
   ═══════════════════════════════════════════════════════════ */
(function initTimelineReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 120);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.timeline-item').forEach(el => obs.observe(el));
})();

/* ═══════════════════════════════════════════════════════════
   WISH CARDS — stagger on scroll
   ═══════════════════════════════════════════════════════════ */
(function initWishCards() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 100);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.wish-card').forEach(el => obs.observe(el));
})();

/* ═══════════════════════════════════════════════════════════
   GLOWING HOVER ON GLASS CARDS
   ═══════════════════════════════════════════════════════════ */
document.querySelectorAll('.glass-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top)  / rect.height) * 100;
    card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(139,92,246,0.07), rgba(255,255,255,0.03) 60%)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.background = '';
  });
});

/* ═══════════════════════════════════════════════════════════
   PAGE ENTRANCE ANIMATION — fade in body
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.6s ease';
  setTimeout(() => { document.body.style.opacity = '1'; }, 100);
});
