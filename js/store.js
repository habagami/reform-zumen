// 保存まわり: 設定は localStorage、図面データと品番キャッシュは IndexedDB
(function () {
  const NZ = (window.NZ = window.NZ || {});

  const SETTINGS_KEY = 'naiso-zumen.settings';
  const DEFAULT_SETTINGS = {
    company: '',
    companySub: '', // 住所・TEL など
    author: '',
    license: '', // 許認可番号(既定値)
    apiKey: '',
    model: 'claude-opus-5-5',
    round: 5, // 寸法の丸め(mm)
  };

  NZ.loadSettings = function () {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return Object.assign({}, DEFAULT_SETTINGS, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  };
  NZ.saveSettings = function (s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* 保存できない環境 */ }
  };

  // --- IndexedDB (失敗時はメモリ保持) ---
  let dbp = null;
  const mem = { projects: new Map(), products: new Map() };
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve) => {
        try {
          const req = indexedDB.open('naiso-zumen', 1);
          req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
            if (!d.objectStoreNames.contains('products')) d.createObjectStore('products', { keyPath: 'key' });
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then((d) => {
      if (!d) return fn(null);
      return new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
        t.onerror = () => reject(t.error);
      });
    });
  }

  NZ.db = {
    saveProject(p) {
      p.updatedAt = Date.now();
      return tx('projects', 'readwrite', (s) => (s ? s.put(p) : mem.projects.set(p.id, p)));
    },
    getProject(id) {
      return tx('projects', 'readonly', (s) => (s ? s.get(id) : { result: mem.projects.get(id) }));
    },
    deleteProject(id) {
      return tx('projects', 'readwrite', (s) => (s ? s.delete(id) : mem.projects.delete(id)));
    },
    listProjects() {
      return tx('projects', 'readonly', (s) => (s ? s.getAll() : { result: [...mem.projects.values()] })).then((list) =>
        (list || [])
          .map((p) => ({ id: p.id, name: p.meta.name || '(無題)', updatedAt: p.updatedAt || 0 }))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    },
    getProduct(key) {
      return tx('products', 'readonly', (s) => (s ? s.get(key) : { result: mem.products.get(key) }));
    },
    putProduct(rec) {
      return tx('products', 'readwrite', (s) => (s ? s.put(rec) : mem.products.set(rec.key, rec)));
    },
  };

  NZ.uid = function () {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  };

  NZ.newProject = function (settings) {
    const d = new Date();
    return {
      id: NZ.uid(),
      version: 1,
      meta: {
        name: '',
        title: '平面詳細図',
        drawingNo: 'A-01',
        scale: 'auto',
        paper: 'A3',
        author: settings.author || '',
        license: settings.license || '',
        company: settings.company || '',
        companySub: settings.companySub || '',
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        note: '',
        north: 0, // 方位(度) 上=北 から時計回り
      },
      underlay: null, // {src, w, h, x, y, mmPerPx, opacity, visible}
      walls: [],
      columns: [],
      fixtures: [],
      labels: [],
      dims: [],
      zones: [],
      floors: [],
      grid: { xs: [], ys: [], visible: true, ext: 1500 },
    };
  };
})();
