/* ============================================================
   hero-gimbal.js — Three.js wireframe gyroscope hero background
   ------------------------------------------------------------
   Drop-in module for the site's hero sections.

   Usage:
     1. Put  <div id="hero-gimbal" aria-hidden="true"></div>
        as the first child of the hero <section>.
     2. Load three.min.js, then this file, before </body>.

   Design:
     - three concentric gimbal rings (Y / X / Z axles) + a low-poly
       wireframe core + a sparse particle halo
     - transparent canvas, additive-blended thin lines for a subtle
       glow, no post-processing
     - reads the site's CSS colour variables (--acid/--signal/
       --paper/--dim) and follows the theme toggle via MutationObserver
     - deterministic, time-based rotation (smooth, seamless, no jitter)

   Performance / graceful degradation:
     - caps pixel ratio (1.5 on low-power, 2 otherwise)
     - fewer ring segments on low-power / touch devices
     - pauses rendering when the hero scrolls out of view
     - reduced-motion users get a static frame
   ============================================================ */
(function () {
  'use strict';

  var container = document.getElementById('hero-gimbal');
  if (!container || typeof THREE === 'undefined') return;

  /* WebGL availability gate — fail silently on devices without it */
  var hasWebGL = (function () {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('webgl2') || c.getContext('experimental-webgl'));
    } catch (e) { return false; }
  })();
  if (!hasWebGL) return;

  /* ---------- capability ladder ---------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;
  var cores = navigator.hardwareConcurrency || 0;
  var lowPower = isTouch || (cores > 0 && cores <= 4);
  var SEGMENTS = lowPower ? 48 : 80;
  var DPR = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);

  /* ---------- renderer / scene / camera ---------- */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);   /* fully transparent background */
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 15);

  /* ---------- theme colours (re-sampled when data-theme changes) ---------- */
  var theme = {
    acid: new THREE.Color('#00f0ff'),
    signal: new THREE.Color('#ff00a8'),
    paper: new THREE.Color('#d9f4ff'),
    dim: new THREE.Color('#7c94c9')
  };

  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    function grab(name) {
      var s = cs.getPropertyValue(name).trim();
      var m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s);
      if (!m) return null;
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h.slice(0, 6), 16);
      return new THREE.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }
    var acid = grab('--acid'), signal = grab('--signal'), paper = grab('--paper'), dim = grab('--dim');
    if (acid) theme.acid = acid;
    if (signal) theme.signal = signal;
    if (paper) theme.paper = paper;
    if (dim) theme.dim = dim;
  }

  /* ---------- small helpers ---------- */
  var animated = [];   /* { mat, base, factor(t) } → opacity = base * dim * factor(t) */

  function reg(mat, base, factor) {
    mat.opacity = base;
    animated.push({ mat: mat, base: base, factor: factor || null });
  }

  function lineMat(color, opacity) {
    return new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
  }

  function circleGeo(radius) {
    var pts = [];
    for (var i = 0; i < SEGMENTS; i++) {
      var a = (i / SEGMENTS) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  /* ---------- ring factory (thin circle + orbit dots + axle) ---------- */
  function makeRing(radius, colorKey, opacity, dotCount, dotPhase) {
    var g = new THREE.Group();

    var ringMat = lineMat(theme[colorKey], opacity);
    g.add(new THREE.LineLoop(circleGeo(radius), ringMat));

    var dotPos = new Float32Array(dotCount * 3);
    for (var d = 0; d < dotCount; d++) {
      var a = (d / dotCount) * Math.PI * 2 + dotPhase;
      dotPos[d * 3] = Math.cos(a) * radius;
      dotPos[d * 3 + 1] = Math.sin(a) * radius;
    }
    var dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
    var dotMat = new THREE.PointsMaterial({
      color: theme[colorKey], size: 0.09, sizeAttenuation: true,
      transparent: true, opacity: Math.min(1, opacity + 0.25),
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    g.add(new THREE.Points(dotGeo, dotMat));

    var axleMat = lineMat(theme.dim, opacity * 0.7);
    var axlePts = [new THREE.Vector3(0, 0, -radius * 0.5), new THREE.Vector3(0, 0, radius * 0.5)];
    var axleGeo = new THREE.BufferGeometry().setFromPoints(axlePts);
    g.add(new THREE.Line(axleGeo, axleMat));

    reg(ringMat, opacity);
    reg(dotMat, Math.min(1, opacity + 0.25));
    reg(axleMat, opacity * 0.7);

    g.userData = { ring: ringMat, dots: dotMat, axle: axleMat, colorKey: colorKey };
    return g;
  }

  /* ---------- the three gimbal rings ---------- */
  var outerRing = makeRing(3.4, 'dim', 0.35, 3, 0);
  var midRing = makeRing(2.6, 'acid', 0.5, 3, Math.PI / 3);
  var innerRing = makeRing(1.9, 'signal', 0.45, 3, Math.PI / 6);

  /* each ring spins around its own axle; rotate the ring's local frame so
     the axle (local +Z) aligns with the gimbal axis in world space */
  var outerSpin = new THREE.Group();
  outerSpin.add(outerRing);
  outerSpin.rotation.x = -Math.PI / 2;    /* axle -> world Y */
  var midSpin = new THREE.Group();
  midSpin.add(midRing);
  midSpin.rotation.y = Math.PI / 2;       /* axle -> world X */
  /* inner ring stays axle-aligned with world Z */

  /* ---------- central core ---------- */
  var coreGroup = new THREE.Group();
  var coreOuterMat = new THREE.MeshBasicMaterial({ color: theme.paper, wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  var coreOuter = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), coreOuterMat);
  var coreInnerMat = new THREE.MeshBasicMaterial({ color: theme.acid, wireframe: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  var coreInner = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), coreInnerMat);
  var coreDotGeo = new THREE.BufferGeometry();
  coreDotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
  var coreDotMat = new THREE.PointsMaterial({ color: theme.signal, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  var coreDot = new THREE.Points(coreDotGeo, coreDotMat);
  coreGroup.add(coreOuter, coreInner, coreDot);

  reg(coreOuterMat, 0.7, function (t) { return 0.82 + 0.18 * Math.sin(t * 0.65); });
  reg(coreInnerMat, 0.45);
  reg(coreDotMat, 0.9);

  /* ---------- sparse particle halo (deterministic seed) ---------- */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(20260214);
  var pCount = lowPower ? 18 : 30;
  var pPos = new Float32Array(pCount * 3);
  for (var i = 0; i < pCount; i++) {
    var r = 3.7 + rng() * 0.9;
    var theta = rng() * Math.PI * 2;
    var phi = Math.acos(2 * rng() - 1);
    pPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pPos[i * 3 + 2] = r * Math.cos(phi);
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var pMat = new THREE.PointsMaterial({ color: theme.dim, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  var particles = new THREE.Points(pGeo, pMat);
  reg(pMat, 0.35);

  /* ---------- assembly ---------- */
  var assembly = new THREE.Group();
  assembly.add(outerSpin, midSpin, innerRing, coreGroup, particles);
  scene.add(assembly);

  function applyTheme() {
    readTheme();
    [outerRing, midRing, innerRing].forEach(function (ring) {
      var key = ring.userData.colorKey;
      ring.userData.ring.color.copy(theme[key]);
      ring.userData.dots.color.copy(theme[key]);
      ring.userData.axle.color.copy(theme.dim);
    });
    coreOuterMat.color.copy(theme.paper);
    coreInnerMat.color.copy(theme.acid);
    coreDotMat.color.copy(theme.signal);
    pMat.color.copy(theme.dim);
  }
  applyTheme();
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- layout / resize (hero box + viewport-safe sizing) ---------- */
  var SPEED = { outer: 0.12, mid: 0.2, inner: 0.3 };   /* rad/s, deterministic */
  var baseRotX = 0.35, baseRotY = 0.45;                /* static 3/4 tilt so all axles read */
  var parX = 0, parY = 0, tparX = 0, tparY = 0;        /* eased parallax offset */
  var dim = 1;                                          /* mobile opacity dampener */

  function layout() {
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (w < 640) {
      dim = 0.62;                                       /* keep hero type readable */
      assembly.scale.setScalar(0.55);
      assembly.position.set(0.6, 0.5, 0);
    } else {
      dim = 1;
      assembly.scale.setScalar(Math.min(1, w / 1000));
      assembly.position.set(Math.min(2.6, 1.2 + (w - 640) / 300), 0.35, 0);
    }
  }
  if (window.ResizeObserver) {
    new ResizeObserver(layout).observe(container);
  } else {
    window.addEventListener('resize', layout);
  }
  layout();

  /* ---------- pause rendering when the hero scrolls off-screen ---------- */
  var visible = true;
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
  }, { threshold: 0 }).observe(container);

  /* ---------- subtle mouse parallax (real pointers only) ---------- */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tparX = (e.clientX / window.innerWidth) * 2 - 1;
      tparY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  /* ---------- animation loop ---------- */
  function update(t, dt) {
    if (!reduceMotion) {
      /* continuous, deterministic rotation — a pure function of elapsed time */
      outerRing.rotation.z += SPEED.outer * dt;
      midRing.rotation.z += SPEED.mid * dt;
      innerRing.rotation.z += SPEED.inner * dt;
      baseRotY += 0.045 * dt;
      baseRotX += 0.018 * dt;
      coreGroup.rotation.x += 0.11 * dt;
      coreGroup.rotation.y += 0.15 * dt;
      coreGroup.position.set(
        Math.sin(t * 0.4) * 0.05,
        Math.cos(t * 0.33) * 0.05,
        Math.sin(t * 0.27) * 0.04
      );
      /* parallax is added on top of the continuous rotation, never replaces it */
      parX += (tparX - parX) * 0.045;
      parY += (tparY - parY) * 0.045;
      assembly.rotation.y = baseRotY + parX * 0.14;
      assembly.rotation.x = baseRotX + parY * 0.1;
    }
    /* gentle brightness pulse + mobile dimming */
    for (var i = 0; i < animated.length; i++) {
      var it = animated[i];
      it.mat.opacity = it.base * dim * (it.factor ? it.factor(t) : 1);
    }
  }

  var t0 = performance.now();
  var last = t0;
  var lost = false;

  function frame(now) {
    requestAnimationFrame(frame);
    if (lost || !visible || document.hidden) return;
    var dt = Math.min((now - last) / 1000, 0.5);   /* clamp big gaps after tab switch */
    last = now;
    update((now - t0) / 1000, dt);
    renderer.render(scene, camera);
  }

  renderer.domElement.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    lost = true;
  }, false);
  renderer.domElement.addEventListener('webglcontextrestored', function () {
    lost = false;
    last = performance.now();
  }, false);

  requestAnimationFrame(frame);

  /* diagnostic handle (harmless; lets tooling inspect the scene) */
  window.__HERO_GIMBAL__ = { renderer: renderer, scene: scene, camera: camera, assembly: assembly };
})();


