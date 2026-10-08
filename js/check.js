// 寸法チェック(コーション): 実測値の辻褄が合わない箇所を洗い出す
(function () {
  const NZ = (window.NZ = window.NZ || {});
  const R = Math.round;

  // ---------- 幾何 ----------
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  function wallPt(w, fr, s, k) {
    return { x: w.x1 + fr.u.x * s + fr.n.x * k, y: w.y1 + fr.u.y * s + fr.n.y * k };
  }
  // 壁の「壁部分」(開口を除く)の四角形
  function wallSolidPolys(w) {
    const fr = NZ.wallFrame(w), off = NZ.wallOffset(w), t = w.thick;
    return NZ.resolveSegments(w)
      .filter((g) => g.type === 'wall')
      .map((g) => [wallPt(w, fr, g.s0, off - t / 2), wallPt(w, fr, g.s1, off - t / 2), wallPt(w, fr, g.s1, off + t / 2), wallPt(w, fr, g.s0, off + t / 2)]);
  }
  function fixturePoly(f) {
    const a = ((f.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = (sx * f.w) / 2, y = (sy * f.d) / 2;
      return { x: f.x + x * c - y * s, y: f.y + x * s + y * c };
    });
  }
  const rectPoly = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
  const centroid = (pts) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });

  // 凸多角形どうしのめり込み量(分離軸定理)。重なっていなければ 0
  function overlapDepth(A, B) {
    let depth = Infinity;
    for (const poly of [A, B]) {
      for (let i = 0; i < poly.length; i++) {
        const e = sub(poly[(i + 1) % poly.length], poly[i]);
        const L = Math.hypot(e.x, e.y);
        if (L < 1e-6) continue;
        const ax = { x: -e.y / L, y: e.x / L };
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const p of A) { const v = dot(p, ax); a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
        for (const p of B) { const v = dot(p, ax); b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
        const o = Math.min(a1, b1) - Math.max(a0, b0);
        if (o <= 0) return 0;
        depth = Math.min(depth, o);
      }
    }
    return depth === Infinity ? 0 : depth;
  }
  function distToSeg(p, a, b) {
    const d = sub(b, a), L2 = dot(d, d) || 1;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), d) / L2));
    return { d: Math.hypot(p.x - (a.x + d.x * t), p.y - (a.y + d.y * t)), t, q: { x: a.x + d.x * t, y: a.y + d.y * t } };
  }

  // 開き戸・折れ戸が開くときに通る範囲
  function swingPolys(w) {
    const fr = NZ.wallFrame(w), off = NZ.wallOffset(w), t = w.thick;
    const out = [];
    for (const g of NZ.resolveSegments(w)) {
      const sg = NZ.sideSign(g.side);
      const kf = off + sg * t / 2;
      let depth = 0;
      if (['door', 'door2', 'oyako', 'entrance'].includes(g.type)) depth = g.type === 'door2' ? g.len / 2 : g.type === 'oyako' ? (g.len * 2) / 3 : g.len;
      else if (g.type === 'folding') depth = (g.len / Math.max(2, +g.panels || 2)) * 0.866;
      else if (g.type === 'folding2') depth = (g.len / Math.max(2, +g.panels || 4)) * 0.866;
      if (!depth) continue;
      // 端部は 1mm 内側から(隣の壁との接触を除外)
      const pts = [wallPt(w, fr, g.s0 + 1, kf + sg * 1), wallPt(w, fr, g.s1 - 1, kf + sg * 1), wallPt(w, fr, g.s1 - 1, kf + sg * depth), wallPt(w, fr, g.s0 + 1, kf + sg * depth)];
      out.push({ g, pts });
    }
    return out;
  }

  // 同一直線上で連続する壁をまとめる(対面比較用)
  function wallChains(walls) {
    const items = walls.map((w) => {
      const fr = NZ.wallFrame(w);
      let ang = Math.atan2(fr.u.y, fr.u.x);
      if (ang < 0) ang += Math.PI;
      if (ang >= Math.PI - 1e-3) ang = 0;
      const u = { x: Math.cos(ang), y: Math.sin(ang) }, n = { x: -u.y, y: u.x };
      const off = NZ.wallOffset(w);
      const c = { x: w.x1 + fr.n.x * off, y: w.y1 + fr.n.y * off };
      const t1 = dot({ x: w.x1, y: w.y1 }, u), t2 = dot({ x: w.x2, y: w.y2 }, u);
      return { w, ang, u, n, line: dot(c, n), t0: Math.min(t1, t2), t1: Math.max(t1, t2) };
    });
    const chains = [];
    for (const it of items.sort((a, b) => a.t0 - b.t0)) {
      const ch = chains.find((c) => Math.abs(c.ang - it.ang) < 0.02 && Math.abs(c.line - it.line) < 5 && it.t0 <= c.t1 + 5);
      if (ch) { ch.t1 = Math.max(ch.t1, it.t1); ch.ids.push(it.w.id); ch.walls.push(it.w); }
      else chains.push({ ang: it.ang, u: it.u, n: it.n, line: it.line, t0: it.t0, t1: it.t1, ids: [it.w.id], walls: [it.w] });
    }
    return chains;
  }

  /**
   * @returns [{key, level:'error'|'warn'|'info', kind, msg, x, y, ids, line?, area?}]
   */
  NZ.checkDrawing = function (p, opts = {}) {
    const tol = opts.tol ?? 10;
    const out = [];
    const push = (it) => { it.key = it.kind + ':' + it.ids.slice().sort().join(',') + (it.sub ? ':' + it.sub : ''); out.push(it); };
    const walls = p.walls.filter((w) => !w.detected);
    const fixtures = p.fixtures.filter((f) => !f.detected);
    const columns = p.columns.filter((c) => !c.detected);
    const flabel = (f) => f.label || (NZ.FIXTURE_TYPES[f.type] || {}).label || '設備';
    const isLoose = (f) => NZ.fixtureCat(f.type) === 'loose';

    // 1. 分割(建具)の合計が壁の長さを超える
    for (const w of walls) {
      const [i0, i1] = NZ.wallInset(w);
      const L = NZ.wallFrame(w).L - i0 - i1;
      const sum = (w.segments || []).reduce((a, g) => a + (+g.len || 0), 0);
      if (sum > L + 0.5) {
        const m = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
        push({ level: 'error', kind: 'segsum', ids: [w.id], x: m.x, y: m.y, msg: `建具・分割の合計 ${R(sum)}mm が壁の長さ ${R(L)}mm を ${R(sum - L)}mm 超えています。収まりません。` });
      }
    }

    // 2. 壁の端がつながっていない(閉じていない)
    for (const w of walls) {
      for (const which of [1, 2]) {
        const e = which === 1 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
        let connected = false, best = null;
        for (const o of walls) {
          if (o === w) continue;
          for (const q of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
            const d = Math.hypot(q.x - e.x, q.y - e.y);
            if (d < 2) connected = true;
            else if (!best || d < best.d) best = { d, q, o };
          }
          const r = distToSeg(e, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 });
          if (r.d < 2 && r.t > 0 && r.t < 1) connected = true;
          // 相手の壁の中(壁面から描き始めた場合など)に端点があれば接続とみなす
          const fo = NZ.wallFrame(o), oo = NZ.wallOffset(o);
          const rc = distToSeg(e, { x: o.x1 + fo.n.x * oo, y: o.y1 + fo.n.y * oo }, { x: o.x2 + fo.n.x * oo, y: o.y2 + fo.n.y * oo });
          if (rc.d <= o.thick / 2 + 2 && rc.t > 0 && rc.t < 1) connected = true;
          else if (r.t > 0.001 && r.t < 0.999 && (!best || r.d < best.d)) best = { d: r.d, q: r.q, o };
        }
        if (connected || !best) continue;
        const lim = Math.max(400, w.thick * 3);
        if (best.d <= lim) {
          push({
            level: best.d > 50 ? 'error' : 'warn', kind: 'gap', ids: [w.id, best.o.id], sub: which, x: e.x, y: e.y, line: { a: e, b: best.q },
            msg: `壁の端が隣の壁と ${R(best.d)}mm ずれています。どちらかの寸法が合っていない可能性があります。`,
          });
        }
      }
    }

    // 3. 向かい合う壁の長さが違う
    const chains = wallChains(walls);
    const seen = new Set();
    for (const a of chains) {
      let best = null;
      for (const b of chains) {
        if (a === b || Math.abs(a.ang - b.ang) > 0.02) continue;
        const dist = Math.abs(a.line - b.line);
        if (dist < 300 || dist > 20000) continue;
        // 同じ範囲を意図している(両端の差が小さい)ものだけ比較
        if (Math.abs(a.t0 - b.t0) > 600 || Math.abs(a.t1 - b.t1) > 600) continue;
        if (!best || dist < best.dist) best = { b, dist };
      }
      if (!best) continue;
      const b = best.b;
      const k = [a.ids.join(), b.ids.join()].sort().join('|');
      if (seen.has(k)) continue;
      seen.add(k);
      const La = a.t1 - a.t0, Lb = b.t1 - b.t0;
      const diff = Math.abs(La - Lb);
      if (diff > tol) {
        const mid = (ch) => { const t = (ch.t0 + ch.t1) / 2; return { x: ch.u.x * t + ch.n.x * ch.line, y: ch.u.y * t + ch.n.y * ch.line }; };
        const ma = mid(a), mb = mid(b);
        push({
          level: diff > 50 ? 'error' : 'warn', kind: 'opposite', ids: [...a.ids, ...b.ids], x: (ma.x + mb.x) / 2, y: (ma.y + mb.y) / 2, line: { a: ma, b: mb },
          msg: `向かい合う壁の長さが ${R(diff)}mm 違います(${R(La)} / ${R(Lb)}mm)。両側を測り直してください。`,
        });
      }
    }

    // 4. 設備・造作が壁・柱に食い込む(収まらない)
    const solids = [];
    for (const w of walls) for (const poly of wallSolidPolys(w)) solids.push({ id: w.id, poly, name: '壁' });
    for (const c of columns) solids.push({ id: c.id, poly: rectPoly(c.x - c.w / 2, c.y - c.d / 2, c.x + c.w / 2, c.y + c.d / 2), name: '柱' });
    for (const f of fixtures) {
      if (f.type === 'wallcab') continue;
      const fp = fixturePoly(f);
      for (const s of solids) {
        const d = overlapDepth(fp, s.poly);
        if (d > tol) {
          const c = centroid(fp);
          push({ level: isLoose(f) ? 'warn' : 'error', kind: 'fx-wall', ids: [f.id, s.id], x: c.x, y: c.y, area: fp, msg: `${flabel(f)}(${R(f.w)}×${R(f.d)})が${s.name}に ${R(d)}mm 食い込んでいます。この寸法では収まりません。` });
          break;
        }
      }
    }

    // 5. 設備どうしの重なり(置き家具・吊戸棚は除く)
    const hard = fixtures.filter((f) => !isLoose(f) && f.type !== 'wallcab');
    for (let i = 0; i < hard.length; i++) for (let j = i + 1; j < hard.length; j++) {
      const A = fixturePoly(hard[i]), B = fixturePoly(hard[j]);
      const d = overlapDepth(A, B);
      if (d > tol) {
        const c = centroid([...A, ...B]);
        push({ level: 'error', kind: 'fx-fx', ids: [hard[i].id, hard[j].id], x: c.x, y: c.y, msg: `${flabel(hard[i])}と${flabel(hard[j])}が ${R(d)}mm 重なっています。` });
      }
    }

    // 6. ドアの開閉範囲の干渉
    for (const w of walls) {
      for (const sw of swingPolys(w)) {
        const c = centroid(sw.pts);
        const label = (NZ.SEG_TYPES[sw.g.type] || {}).label || '建具';
        let hit = null;
        for (const s of solids) {
          if (s.id === w.id) continue;
          const d = overlapDepth(sw.pts, s.poly);
          if (d > tol) { hit = { name: s.name, id: s.id, d }; break; }
        }
        if (!hit) for (const f of fixtures) {
          if (f.type === 'wallcab') continue;
          const d = overlapDepth(sw.pts, fixturePoly(f));
          if (d > tol) { hit = { name: flabel(f), id: f.id, d, loose: isLoose(f) }; break; }
        }
        if (hit) push({
          level: hit.loose ? 'warn' : 'error', kind: 'swing', ids: [w.id, hit.id], sub: R(sw.g.s0), x: c.x, y: c.y, area: sw.pts,
          msg: `${label}(W${R(sw.g.len)})を開くと${hit.name}に当たります(${R(hit.d)}mm)。吊元・開き方向か寸法を確認してください。`,
        });
      }
    }

    // 7. 下図の長さと入力値の差(入力ミスの疑い)
    for (const w of walls) {
      if (!w.traced) continue;
      const L = NZ.wallFrame(w).L;
      const diff = Math.abs(L - w.traced);
      if (diff > Math.max(150, L * 0.08)) {
        const m = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
        push({ level: 'warn', kind: 'traced', ids: [w.id], x: m.x, y: m.y, msg: `入力値 ${R(L)}mm が下図の長さ(約${R(w.traced)}mm)と ${R(diff)}mm 違います。入力ミス(数字の入れ替わり等)がないか確認してください。` });
      }
    }

    // 8. 寸法の表示値と線の長さの不一致
    for (const d of p.dims) {
      const v = Number(String(d.text || '').replace(/[,，\s]/g, ''));
      if (!d.text || !isFinite(v)) continue;
      const L = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
      if (Math.abs(v - L) > tol) push({ level: 'warn', kind: 'dimtext', ids: [d.id], x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2, msg: `寸法の表示値 ${R(v)}mm と、図面上の長さ ${R(L)}mm が違います。` });
    }

    // 9. 未確定の検出結果
    const det = [...p.walls, ...p.columns, ...p.fixtures, ...p.zones].filter((e) => e.detected);
    if (det.length) {
      const e = det[0];
      const x = e.x1 ?? e.x, y = e.y1 ?? e.y;
      push({ level: 'info', kind: 'detected', ids: ['detected'], x, y, msg: `下図から検出した要素が ${det.length} 件、未確定のままです(チェック対象外)。実測して確定してください。` });
    }

    const ign = new Set(p.ignoredIssues || []);
    const order = { error: 0, warn: 1, info: 2 };
    return out.filter((i) => !ign.has(i.key)).sort((a, b) => order[a.level] - order[b.level]);
  };
})();
