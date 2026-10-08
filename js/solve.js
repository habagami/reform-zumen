// 内法(うちのり)寸法の解決
// 実測値は壁の面から面までの内法。作図上の壁の長さ = 内法 + 両端で接続する壁の厚み分。
// 接続先の壁があとから描かれたり厚みが変わったりしたら、ここで長さを再計算する(入力時の位置は仮置き)。
(function () {
  const NZ = (window.NZ = window.NZ || {});
  const dot = (a, b) => a.x * b.x + a.y * b.y;

  /**
   * 壁 w の端点 which(1=始点, 2=終点)から、接続する壁の面までの距離(=加算する壁厚分)
   * @returns {ext, connected}
   */
  function endExt(walls, w, which) {
    const fr = NZ.wallFrame(w);
    const e = which === 1 ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const v = which === 1 ? fr.u : { x: -fr.u.x, y: -fr.u.y }; // 壁の内側へ向かう向き
    let ext = 0, connected = false;
    for (const o of walls) {
      if (o === w) continue;
      const fo = NZ.wallFrame(o);
      if (Math.abs(dot(fr.u, fo.u)) > 0.9) continue; // 平行(一直線の続き)は対象外
      const rel = { x: e.x - o.x1, y: e.y - o.y1 };
      const along = dot(rel, fo.u), c0 = dot(rel, fo.n);
      const oo = NZ.wallOffset(o), t = o.thick;
      if (along < -t || along > fo.L + t) continue;
      const lo = oo - t / 2, hi = oo + t / 2;
      if (c0 < lo - 100 || c0 > hi + 100) continue;
      connected = true;
      const dv = dot(v, fo.n);
      let d = 0;
      if (dv > 1e-6) d = (hi - c0) / dv;
      else if (dv < -1e-6) d = (lo - c0) / dv;
      if (d > 0 && d < t * 2) ext = Math.max(ext, d);
    }
    return { ext, connected };
  }
  NZ.wallEndExt = function (walls, w) {
    const a = endExt(walls, w, 1), b = endExt(walls, w, 2);
    return { e0: a.ext, e1: b.ext, c0: a.connected, c1: b.connected };
  };

  // 点 pt につながる「後から描いた壁」を、向きを保ったまま平行移動する(その先につながる壁も順に)
  function shiftLater(ws, i, pt, dx, dy) {
    const moved = new Set();
    const stack = [pt];
    while (stack.length) {
      const q = stack.pop();
      for (let j = i + 1; j < ws.length; j++) {
        const o = ws[j];
        if (moved.has(o)) continue;
        let other = null;
        if (Math.hypot(o.x1 - q.x, o.y1 - q.y) < 2) other = { x: o.x2, y: o.y2 };
        else if (Math.hypot(o.x2 - q.x, o.y2 - q.y) < 2) other = { x: o.x1, y: o.y1 };
        if (!other) continue;
        moved.add(o);
        o.x1 += dx; o.y1 += dy; o.x2 += dx; o.y2 += dy;
        stack.push(other);
      }
    }
  }

  // 内法から壁の長さを決める。動かすのは固定していない側の端点。
  // 後から描いた壁の端点だけを追従させ、先に描いた壁は動かさない(一周して合わない分は「ずれ」として残る)
  NZ.solveWalls = function (p) {
    const ws = p.walls;
    ws.forEach((w, i) => {
      let r = NZ.wallEndExt(ws, w);
      w.ext0 = r.e0; w.ext1 = r.e1;
      if (!w.innerMode || !(w.inner > 0)) return;
      for (let iter = 0; iter < 3; iter++) {
        const fr = NZ.wallFrame(w);
        const target = w.inner + w.ext0 + w.ext1;
        if (Math.abs(target - fr.L) < 0.3) break;
        const atEnd = w.anchor !== 'end';
        const old = atEnd ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 };
        const np = atEnd ? { x: w.x1 + fr.u.x * target, y: w.y1 + fr.u.y * target } : { x: w.x2 - fr.u.x * target, y: w.y2 - fr.u.y * target };
        shiftLater(ws, i, old, np.x - old.x, np.y - old.y);
        if (atEnd) { w.x2 = np.x; w.y2 = np.y; } else { w.x1 = np.x; w.y1 = np.y; }
        r = NZ.wallEndExt(ws, w);
        w.ext0 = r.e0; w.ext1 = r.e1;
      }
    });
  };

  // 手で端点を動かしたときなど、今の形から内法を取り直す
  NZ.syncInner = function (p) {
    for (const w of p.walls) {
      const r = NZ.wallEndExt(p.walls, w);
      w.ext0 = r.e0; w.ext1 = r.e1;
      if (w.innerMode) w.inner = Math.max(1, NZ.wallFrame(w).L - r.e0 - r.e1);
    }
  };
})();
