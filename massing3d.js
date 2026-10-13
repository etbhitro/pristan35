(function () {
  if (customElements.get('massing-3d')) return;
  const V = '0.149.0';
  let loading;
  const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const ensure = () => loading || (loading = window.THREE ? Promise.resolve() :
    load(`https://cdn.jsdelivr.net/npm/three@${V}/build/three.min.js`).catch(() => load(`https://unpkg.com/three@${V}/build/three.min.js`)));

  class Orbit {
    constructor(cam, el) {
      this.cam = cam; this.el = el; this.target = new THREE.Vector3();
      this.autoRotate = false; this.autoRotateSpeed = 0.55; this.minDistance = 1; this.maxDistance = 1e4;
      this.minPolarAngle = 0.15; this.maxPolarAngle = 1.42; this._l = [];
      this.th = 0; this.ph = 1; this.r = 100; this.vth = 0; this.vph = 0;
      let drag = null;
      el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; this.autoRotate = false; this._l.forEach(f => f()); });
      el.addEventListener('pointermove', e => { if (!drag) return; this.vth -= (e.clientX - drag.x) * 0.006; this.vph -= (e.clientY - drag.y) * 0.006; drag = { x: e.clientX, y: e.clientY }; });
      const up = () => { drag = null; el.style.cursor = 'grab'; };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      el.addEventListener('wheel', e => { e.preventDefault(); this.r = Math.min(this.maxDistance, Math.max(this.minDistance, this.r * (1 + Math.sign(e.deltaY) * 0.1))); this.autoRotate = false; }, { passive: false });
    }
    addEventListener(n, f) { if (n === 'start') this._l.push(f); }
    sync() { const o = this.cam.position.clone().sub(this.target); this.r = o.length(); this.th = Math.atan2(o.x, o.z); this.ph = Math.acos(Math.min(1, Math.max(-1, o.y / this.r))); }
    update() {
      if (this.autoRotate) this.th += this.autoRotateSpeed * 0.004;
      this.th += this.vth * 0.35; this.ph += this.vph * 0.35; this.vth *= 0.65; this.vph *= 0.65;
      this.ph = Math.min(this.maxPolarAngle, Math.max(this.minPolarAngle, this.ph));
      const s = Math.sin(this.ph);
      this.cam.position.set(this.target.x + this.r * s * Math.sin(this.th), this.target.y + this.r * Math.cos(this.ph), this.target.z + this.r * s * Math.cos(this.th));
      this.cam.lookAt(this.target);
    }
  }

  const C = {
    terra: 0xC47A55, terraDeep: 0x9A5038, charcoal: 0x3B4541, wheat: 0xD2B07A, teal: 0x5E95A1, water: 0x7FB8C4,
    fish: 0x55708F, red: 0xB4513F, gray: 0xBDB6A6, lawn: 0xD3DABB, ground: 0xE6E1D2, glass: 0xA9C6CC, wood: 0xB88A5A,
    deck: 0xC9A77A, concrete: 0xD4CFC5, pv: 0x2D3E52, stone: 0xDAD3C4, tree: 0x8EA571, treeDark: 0x6F8A57, sand: 0xEADBB8, lake: 0x8DB9C2,
  };

  // master-plan geometry (same as the plan, meters; plan y -> 3D z)
  const SITE = [[10,224],[178,224],[142,111],[105,4],[14,90]];
  const R = (x, y, w, h, rot = 0) => ({ x, y, w, h, rot });
  const BARNS = [[74,76,-6],[88,76,-2],[102,76,3],[60,94,-4],[74,94,-1],[88,94,2],[102,94,5]];
  const COTT = [[86,140],[104,140],[122,140],[140,140],[92,160],[110,160],[128,160],[146,160],[110,180],[128,180],[146,180]];
  const PLAN = [
    { k: 'box', s: R(128,108,16,10), h: 3.6, c: 'gray' },
    { k: 'flat', s: R(114,60.8,40,16,70.9), c: 'concrete' },
    { k: 'slab', s: R(68.4,56.5,56,13,-43.4), h: 13.2, c: 'terra' },
    ...BARNS.map(p => ({ k: 'barn', s: R(p[0],p[1],7,11,p[2]) })),
    { k: 'box', s: R(52,120,40,18), h: 10, c: 'terraDeep' },
    ...COTT.map(p => ({ k: 'box', s: R(p[0],p[1],11,11), h: 6.2, c: 'wheat' })),
    { k: 'box', s: R(96,196,28,13), h: 4.5, c: 'stone', roof: 'lawn' },
    { k: 'water', s: R(112,212,36,8) }, { k: 'water', s: R(138,211,10,7) },
    { k: 'box', s: R(157,207,20,12), h: 4, c: 'red' },
    { k: 'box', s: R(55,150,22,16), h: 4, c: 'red' },
    { k: 'pond', s: R(48,181,26,10) }, { k: 'pond', s: R(48,196,26,10) }, { k: 'pond', s: R(52,211,26,10) },
    { k: 'box', s: R(22,150,16,22), h: 5, c: 'fish' },
    { k: 'box', s: R(101,24,12,8), h: 4, c: 'gray' },
  ];

  class Massing3D extends HTMLElement {
    static get observedAttributes() { return ['model']; }
    connectedCallback() {
      this.style.display = 'block'; this.style.position = 'relative';
      if (!this.style.height) this.style.height = '100%';
      this._alive = true;
      ensure().then(() => this._alive && this.init()).catch(() => { this.textContent = '3D не загрузилось'; });
    }
    disconnectedCallback() {
      this._alive = false; cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); }
      this.scene = null;
    }
    attributeChangedCallback() { if (this.scene) this.build(); }
    set model(v) { this.setAttribute('model', v); }
    get model() { return this.getAttribute('model') || 'site'; }

    init() {
      const T = THREE;
      const r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      Object.assign(r.domElement.style, { width: '100%', height: '100%', display: 'block', cursor: 'grab' });
      this.appendChild(r.domElement);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(32, 1, 0.5, 3000);
      this.scene.add(new T.HemisphereLight(0xfff6e8, 0x8a8170, 0.75));
      const sun = this.sun = new T.DirectionalLight(0xffffff, 1.55);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      this.scene.add(sun, sun.target);
      this.scene.add(new T.AmbientLight(0xffffff, 0.18));
      const ctl = this.controls = new Orbit(this.camera, r.domElement);
      ctl.autoRotate = true;
      ctl.addEventListener('start', () => { ctl.autoRotate = false; });
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(this);
      this.resize(); this.build();
      const loop = () => { if (!this._alive) return; this._raf = requestAnimationFrame(loop); ctl.update(); r.render(this.scene, this.camera); };
      loop();
    }
    resize() {
      const w = this.clientWidth || 600, h = this.clientHeight || 400;
      this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }

    // ---------- helpers
    mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: typeof c === 'string' ? C[c] : c, roughness: 0.85, metalness: 0, ...o }); }
    glass() { return new THREE.MeshStandardMaterial({ color: C.glass, roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.55 }); }
    box(g, w, h, d, m, x = 0, y = 0, z = 0, ry = 0) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y + h / 2, z); mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
    }
    cyl(g, r, h, m, x, y, z, seg = 20) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);
      mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
    }
    tree(g, x, z, s = 1) {
      const T = THREE;
      const trunk = new T.Mesh(new T.CylinderGeometry(0.12 * s, 0.18 * s, 1.6 * s, 6), this.mat(0x7a6248));
      trunk.position.set(x, 0.8 * s, z); trunk.castShadow = true; g.add(trunk);
      const crown = new T.Mesh(new T.IcosahedronGeometry(1.5 * s, 0), this.mat(Math.random() > 0.5 ? C.tree : C.treeDark, { flatShading: true }));
      crown.position.set(x, 2.6 * s, z); crown.scale.y = 1.15; crown.castShadow = true; g.add(crown);
    }
    groundPlane(g, size, color = C.ground, opacity = 1) {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: opacity < 1, opacity });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
      p.rotation.x = -Math.PI / 2; p.receiveShadow = true; g.add(p); return p;
    }
    gable(g, w, wallH, ridgeH, d, m, x, z, ry = 0, glassFront = true) {
      const T = THREE;
      const sh = new T.Shape([new T.Vector2(-w/2, 0), new T.Vector2(w/2, 0), new T.Vector2(w/2, wallH), new T.Vector2(0, ridgeH), new T.Vector2(-w/2, wallH)]);
      const geo = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2);
      const holder = new T.Group(); holder.position.set(x, 0, z); holder.rotation.y = ry;
      const mesh = new T.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; holder.add(mesh);
      if (glassFront) {
        const inset = 0.5;
        const gs = new T.Shape([new T.Vector2(-w/2 + inset, 0.2), new T.Vector2(w/2 - inset, 0.2), new T.Vector2(w/2 - inset, wallH - 0.1), new T.Vector2(0, ridgeH - inset * 1.2), new T.Vector2(-w/2 + inset, wallH - 0.1)]);
        const gm = new T.Mesh(new T.ShapeGeometry(gs), new T.MeshStandardMaterial({ color: 0x9fbac0, roughness: 0.05, metalness: 0.4 }));
        gm.position.z = d / 2 + 0.03; holder.add(gm);
      }
      g.add(holder); return holder;
    }
    flatShape(g, pts, color, y = 0.02) {
      const T = THREE;
      const sh = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
      const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color, roughness: 1 }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; g.add(m); return m;
    }

    // ---------- models
    m_apart(g) {
      this.groundPlane(g, 160, C.lawn);
      const terra = this.mat('terra'), slab = this.mat(0xE3D6C6), gl = this.glass(), wood = this.mat('wood');
      for (let i = 0; i < 4; i++) {
        const y = i * 3.3;
        this.box(g, 55.4, 3.0, 11.4, gl, 0, y, 0);
        this.box(g, 57, 0.3, 14.2, slab, 0, y + 3.0, 0.9);
        for (let x = -28; x <= 28; x += 7) this.box(g, 0.9, 3.0, 12.2, terra, x, y, 0);
        for (let x = -24.5; x < 28; x += 7) this.box(g, 6.1, 1.0, 0.08, this.mat(0xCDBFA9), x, y + 3.3, 7.9);
      }
      this.box(g, 57, 1.0, 14.2, terra, 0, 13.2, 0.9);
      for (let x = -26; x <= 26; x += 2.3) for (const z of [-4.5, -1.5, 1.5, 4.5]) {
        const p = this.box(g, 2.1, 0.06, 1.7, this.mat('pv', { roughness: 0.3, metalness: 0.5 }), x, 14.6, z);
        p.rotation.x = -0.35;
      }
      for (let x = -28; x <= 28; x += 3.5) this.box(g, 0.25, 13.2, 0.5, wood, x + 1.75, 0, 7.6);
      this.box(g, 60, 0.15, 8, this.mat('deck'), 0, 0, 12);
      [[-34,8],[-36,-6],[34,6],[36,-8],[-20,20],[0,22],[20,20],[-10,-14],[12,-15],[30,-16]].forEach(p => this.tree(g, p[0], p[1], 1.2));
    }
    m_hotel(g) {
      this.groundPlane(g, 140, C.lawn, 0.72);
      const deep = this.mat('terraDeep'), gl = this.glass(), wood = this.mat('wood');
      const grotto = new THREE.Mesh(new THREE.BoxGeometry(26, 4, 20), new THREE.MeshStandardMaterial({ color: C.teal, transparent: true, opacity: 0.45 }));
      grotto.position.set(4, -2.6, -2); g.add(grotto);
      this.box(g, 40, 3.6, 18, gl, 0, 0, 0);
      for (let x = -20; x <= 20; x += 5) this.box(g, 0.6, 3.6, 18.4, deep, x, 0, 0);
      for (let i = 0; i < 2; i++) {
        const y = 3.6 + i * 3.3;
        this.box(g, 40.4, 0.4, 18.6, deep, 0, y, 0);
        this.box(g, 39.6, 2.9, 17.6, gl, 0, y + 0.4, 0);
        for (let x = -18; x <= 18; x += 3) this.box(g, 1.4, 2.9, 0.6, deep, x, y + 0.4, 9.1);
      }
      this.box(g, 41, 0.5, 19, deep, 0, 10.2, 0);
      this.box(g, 28, 3.0, 11, this.mat('wood'), -4, 10.7, -2);
      this.box(g, 28.8, 0.4, 11.8, deep, -4, 13.7, -2);
      this.box(g, 26, 3.6, 9, gl, -4, 0, 13.5);
      this.box(g, 30, 0.45, 12, wood, -4, 3.6, 14);
      for (let x = -18; x <= 10; x += 4) this.box(g, 0.3, 3.6, 0.3, wood, x, 0, 19.7);
      this.box(g, 40, 0.2, 10, this.mat('deck'), -4, 0, 24);
      for (let x = -20; x <= 10; x += 4) this.cyl(g, 0.5, 0.75, this.mat(0xEFE9DD), x, 0.2, 23);
      this.box(g, 6, 2.6, 4, this.mat('teal'), 24, 0, 6);
      [[-30,10],[-30,-10],[30,-12],[32,18],[-14,32],[10,32],[0,-16],[-18,-16]].forEach(p => this.tree(g, p[0], p[1], 1.2));
    }
    m_barn(g) {
      this.groundPlane(g, 130, C.lawn);
      const m = this.mat('charcoal', { roughness: 0.7 }), deck = this.mat('deck');
      const P = BARNS;
      P.forEach(p => {
        const h = this.gable(g, 7, 3.4, 8.2, 11, m, p[0] - 81, p[1] - 85, -p[2] * Math.PI / 180);
        const d = new THREE.Mesh(new THREE.BoxGeometry(7, 0.25, 3), deck); d.position.set(0, 0.12, 7); d.receiveShadow = true; h.add(d);
      });
      for (let i = 0; i < 18; i++) this.tree(g, -45 + Math.random() * 90, -35 + Math.random() * 10 + (i % 2) * 52, 1 + Math.random() * 0.4);
    }
    m_cottage(g) {
      this.groundPlane(g, 130, C.lawn);
      const wheat = this.mat('wheat'), wood = this.mat('wood'), gl = this.glass(), deck = this.mat('deck');
      COTT.forEach(p => {
        const x = p[0] - 116, z = p[1] - 160;
        this.box(g, 11, 3.2, 11, wheat, x, 0, z);
        this.box(g, 10.6, 2.6, 0.1, gl, x, 0.3, z + 5.52);
        this.box(g, 9, 3.0, 7.5, wood, x + 1, 3.2, z - 0.4);
        this.box(g, 8.4, 2.4, 0.1, gl, x + 1, 3.5, z + 3.4);
        this.box(g, 9.4, 0.3, 8, this.mat(0x8E6A45), x + 1, 6.2, z - 0.4);
        this.box(g, 11, 0.25, 3.5, deck, x, 0, z + 7.2);
        this.cyl(g, 1.0, 0.9, this.mat('wood'), x + 3.6, 0.25, z + 7.4);
        this.cyl(g, 0.85, 0.05, this.mat('water', { roughness: 0.1 }), x + 3.6, 1.12, z + 7.4);
      });
      for (let i = 0; i < 18; i++) this.tree(g, -45 + Math.random() * 90, (i % 2 ? 34 : -34) + Math.random() * 6, 1 + Math.random() * 0.4);
    }
    m_rest(g) {
      this.groundPlane(g, 110, C.lawn);
      const wood = this.mat('wood'), gl = this.glass(), conc = this.mat('concrete');
      this.box(g, 24, 0.5, 18, conc, 0, 0, 0);
      this.box(g, 21, 3.6, 15, gl, 0, 0.5, 0);
      this.box(g, 8, 4.1, 5, this.mat('red'), -6, 0, -9.5);
      this.box(g, 1.3, 8.5, 1.3, this.mat('charcoal'), -9, 0, -10.5);
      for (let x = -11; x <= 11; x += 3.66) { this.box(g, 0.35, 3.8, 0.35, wood, x, 0.5, 9); this.box(g, 0.35, 3.8, 0.35, wood, x, 0.5, -8.5); }
      const roof = this.box(g, 27, 0.55, 22, wood, 0, 4.3, 1.5);
      this.box(g, 26, 0.25, 9, this.mat('deck'), 0, 0, 14.5);
      for (let x = -9; x <= 9; x += 4.5) for (const z of [12.5, 16.5]) {
        this.cyl(g, 0.7, 0.75, this.mat(0xEFE9DD), x, 0.25, z);
        const u = this.cyl(g, 0.05, 2.4, this.mat(0x555555), x, 0.25, z);
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), this.mat(0xEDE4D2)); c.position.set(x, 2.9, z); c.castShadow = true; g.add(c);
      }
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(110, 30), this.mat('lake', { roughness: 0.15 })); lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.03, 40); g.add(lake);
      [[-18,-4],[18,-6],[-16,-16],[16,-16],[0,-22]].forEach(p => this.tree(g, p[0], p[1], 1.3));
    }
    m_spa(g) {
      this.groundPlane(g, 130, C.lawn);
      const stone = this.mat('stone'), gl = this.glass(), deck = this.mat('deck'), conc = this.mat('concrete');
      this.box(g, 30, 4.5, 14, stone, 0, 0, 0);
      this.box(g, 26, 3.4, 0.12, gl, 1, 0.4, 7.02);
      this.box(g, 31, 0.5, 15, this.mat('lawn'), 0, 4.5, 0);
      for (const x of [-3, 1, 5]) this.box(g, 3, 2.4, 3, this.mat('wood'), x + 19, 0, -2);
      this.box(g, 56, 0.25, 22, deck, 6, 0, 21);
      this.box(g, 38, 0.8, 11, conc, 6, 0, 22);
      this.box(g, 36, 0.05, 9, this.mat('water', { roughness: 0.05, metalness: 0.1 }), 6, 0.78, 22);
      this.box(g, 12, 0.8, 9, conc, 32, 0, 20);
      this.box(g, 10, 0.05, 7, this.mat('water', { roughness: 0.05 }), 32, 0.78, 20);
      for (let x = -10; x <= 22; x += 3) this.box(g, 0.9, 0.35, 2, this.mat(0xF2ECE0), x, 0.25, 30);
      for (const x of [-18, -14]) { const b = this.cyl(g, 1.2, 2.2, this.mat('wood'), x, 0.25, 12); b.rotation.z = Math.PI / 2; b.position.y = 1.45; }
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(130, 40), this.mat('lake', { roughness: 0.15 })); lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.02, 55); g.add(lake);
      [[-26,-8],[-30,6],[28,-10],[-8,-14],[10,-15]].forEach(p => this.tree(g, p[0], p[1], 1.3));
    }
    m_fish(g) {
      this.groundPlane(g, 130, C.lawn);
      const conc = this.mat('concrete'), water = this.mat(0x6E9CB0, { roughness: 0.05, metalness: 0.15 }), wood = this.mat('wood');
      [[48,181],[48,196],[52,211]].forEach(p => {
        const x = p[0] - 40, z = p[1] - 190;
        this.box(g, 28, 1.0, 10, conc, x, 0, z);
        this.box(g, 26.6, 0.05, 8.6, water, x, 0.95, z);
      });
      this.box(g, 1.8, 0.3, 40, wood, 13, 1.6, 6);
      for (let z = -12; z <= 24; z += 5) { this.box(g, 0.08, 1.0, 0.08, wood, 12.2, 1.9, z); this.box(g, 0.08, 1.0, 0.08, wood, 13.8, 1.9, z); }
      this.box(g, 16, 5, 22, this.mat('fish'), 22 - 40, 0, 150 - 190);
      this.box(g, 16.6, 0.4, 22.6, this.mat(0x3E5269), 22 - 40, 5, 150 - 190);
      this.box(g, 1.2, 8, 1.2, this.mat('charcoal'), -13, 0, -46);
      this.box(g, 22, 3.6, 16, this.glass(), 55 - 40, 0, 150 - 190);
      this.box(g, 24, 0.5, 18, this.mat('wood'), 55 - 40, 3.6, 150 - 190);
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(130, 40), this.mat('lake', { roughness: 0.15 })); lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.02, 60); g.add(lake);
      [[30,-30],[34,-14],[-34,6],[30,30],[-30,-14]].forEach(p => this.tree(g, p[0], p[1], 1.3));
    }
    m_site(g) {
      const T = THREE, ox = 92, oz = 118;
      const base = this.groundPlane(g, 420, C.ground); base.position.set(0, -0.05, -20);
      const sand = new T.Mesh(new T.PlaneGeometry(420, 26), this.mat('sand')); sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.02, 224 - oz + 12); sand.receiveShadow = true; g.add(sand);
      const lake = new T.Mesh(new T.PlaneGeometry(420, 160), this.mat('lake', { roughness: 0.12, metalness: 0.05 })); lake.rotation.x = -Math.PI / 2; lake.position.set(0, -0.01, 224 - oz + 24 + 80); g.add(lake);
      this.flatShape(g, SITE.map(p => [p[0] - ox, p[1] - oz]), C.lawn, 0.01);
      const pip = (p) => { let c = false; for (let i = 0, j = SITE.length - 1; i < SITE.length; j = i++) { const [xi, yi] = SITE[i], [xj, yj] = SITE[j]; if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) c = !c; } return c; };
      const inR = (p, s, m) => { const a = -s.rot * Math.PI / 180, dx = p[0]-s.x, dy = p[1]-s.y; const lx = dx*Math.cos(a)-dy*Math.sin(a), ly = dx*Math.sin(a)+dy*Math.cos(a); return Math.abs(lx) < s.w/2+m && Math.abs(ly) < s.h/2+m; };
      PLAN.forEach(o => {
        const s = o.s, x = s.x - ox, z = s.y - oz, ry = -s.rot * Math.PI / 180;
        if (o.k === 'barn') { this.gable(g, 7, 3.4, 8.2, 11, this.mat('charcoal', { roughness: 0.7 }), x, z, ry); return; }
        if (o.k === 'flat') { const m = this.box(g, s.w, 0.08, s.h, this.mat('concrete'), x, 0, z, ry); m.castShadow = false; return; }
        if (o.k === 'water') { this.box(g, s.w + 1, 0.5, s.h + 1, this.mat('concrete'), x, 0, z, ry); this.box(g, s.w, 0.05, s.h, this.mat('water', { roughness: 0.05 }), x, 0.48, z, ry); return; }
        if (o.k === 'pond') { this.box(g, s.w, 0.9, s.h, this.mat('concrete'), x, 0, z, ry); this.box(g, s.w - 1.4, 0.05, s.h - 1.4, this.mat(0x6E9CB0, { roughness: 0.05 }), x, 0.87, z, ry); return; }
        if (o.k === 'slab') {
          for (let i = 0; i < 4; i++) {
            this.box(g, s.w - 0.4, 3.0, s.h - 1, this.glass(), x, i * 3.3, z, ry);
            this.box(g, s.w + 0.6, 0.3, s.h + 1, this.mat(0xE3D6C6), x, i * 3.3 + 3.0, z, ry);
          }
          this.box(g, s.w + 0.6, 0.8, s.h + 1, this.mat('terra'), x, 13.2, z, ry); return;
        }
        this.box(g, s.w, o.h, s.h, this.mat(o.c), x, 0, z, ry);
        if (o.roof) this.box(g, s.w + 0.4, 0.4, s.h + 0.4, this.mat(o.roof), x, o.h, z, ry);
      });
      this.box(g, 4, 0.4, 26, this.mat('wood'), 160 - ox, 0.2, 240 - oz);
      let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let n = 0;
      for (let k = 0; k < 1400 && n < 150; k++) {
        const p = [10 + rnd() * 168, 6 + rnd() * 216];
        if (!pip(p) || PLAN.some(o => inR(p, o.s, 2.5))) continue;
        if (Math.abs(p[1] - 220) < 3 || (p[0] > 67 && p[0] < 77 && p[1] > 132)) continue;
        this.tree(g, p[0] - ox, p[1] - oz, 0.9 + rnd() * 0.5); n++;
      }
    }

    build() {
      const T = THREE;
      if (this.group) { this.scene.remove(this.group); this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      const g = this.group = new T.Group();
      const name = this.model;
      const fn = this['m_' + name] || this.m_site;
      fn.call(this, g);
      this.scene.add(g);
      const box = new T.Box3();
      g.traverse(o => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') box.expandByObject(o); });
      const c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
      const rad = Math.max(size.x, size.z, size.y * 1.6) * 0.62;
      const dist = rad / Math.sin((this.camera.fov * Math.PI / 180) / 2) * 0.62;
      const dir = new T.Vector3(0.55, 0.62, 1).normalize();
      this.camera.position.copy(c).addScaledVector(dir, dist);
      this.controls.target.copy(c); this.controls.minDistance = dist * 0.25; this.controls.maxDistance = dist * 2.5;
      this.controls.sync(); this.controls.autoRotate = true; this.controls.update();
      const sc = this.sun.shadow.camera, s = rad * 1.4;
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 1; sc.far = rad * 8; sc.updateProjectionMatrix();
      this.sun.position.set(c.x - rad * 0.9, rad * 2.2, c.z + rad * 0.6); this.sun.target.position.copy(c);
    }
  }
  customElements.define('massing-3d', Massing3D);
})();
