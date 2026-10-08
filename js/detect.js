// 下図画像から構造壁・柱を簡易検出(オフライン・画像処理のみ)
// 黒く太く塗られた部分を「動かせない構造体」とみなす。細い線(家具・寸法線・文字)は除外。
(function () {
  const NZ = (window.NZ = window.NZ || {});

  // 二値画像 m に対して半径 r の正方形で膨張/収縮(分離可能なスライディングウィンドウ)
  function morph(m, W, H, r, dilate) {
    const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
    const pass = (src, dst, horiz) => {
      const len = horiz ? W : H, lines = horiz ? H : W;
      for (let l = 0; l < lines; l++) {
        let cnt = 0;
        const idx = (i) => (horiz ? l * W + i : i * W + l);
        for (let i = 0; i < Math.min(r, len); i++) cnt += src[idx(i)];
        for (let i = 0; i < len; i++) {
          if (i + r < len) cnt += src[idx(i + r)];
          if (i - r - 1 >= 0) cnt -= src[idx(i - r - 1)];
          const span = Math.min(len - 1, i + r) - Math.max(0, i - r) + 1;
          dst[idx(i)] = dilate ? (cnt > 0 ? 1 : 0) : cnt === span ? 1 : 0;
        }
      }
    };
    pass(m, tmp, true);
    pass(tmp, out, false);
    return out;
  }

  // 行(または列)方向に、長さ minLen 以上の連続を矩形にまとめる
  function sweepRects(mask, W, H, minLen, tol, horiz) {
    const lines = horiz ? H : W, len = horiz ? W : H;
    const at = (l, i) => (horiz ? mask[l * W + i] : mask[i * W + l]);
    let active = [];
    const done = [];
    for (let l = 0; l <= lines; l++) {
      const runs = [];
      if (l < lines) {
        let st = -1;
        for (let i = 0; i <= len; i++) {
          const v = i < len ? at(l, i) : 0;
          if (v && st < 0) st = i;
          else if (!v && st >= 0) { if (i - st >= minLen) runs.push([st, i - 1]); st = -1; }
        }
      }
      const next = [];
      for (const r of runs) {
        const a = active.find((a) => !a.used && Math.abs(a.a0 - r[0]) <= tol && Math.abs(a.a1 - r[1]) <= tol);
        if (a) { a.used = true; a.a0 = Math.min(a.a0, r[0]); a.a1 = Math.max(a.a1, r[1]); a.l1 = l; next.push(a); }
        else next.push({ a0: r[0], a1: r[1], l0: l, l1: l });
      }
      for (const a of active) if (!a.used) done.push(a);
      for (const a of next) a.used = false;
      active = next;
    }
    return done.map((a) => (horiz ? { x0: a.a0, x1: a.a1, y0: a.l0, y1: a.l1 } : { x0: a.l0, x1: a.l1, y0: a.a0, y1: a.a1 }));
  }

  /**
   * @param img HTMLImageElement
   * @param opts { minThickPx(元画像px), maxThickPx, threshold, close }
   * @returns { walls:[{x1,y1,x2,y2,thick}], columns:[{x,y,w,d}] } 元画像のピクセル座標
   */
  NZ.detectStructure = function (img, opts = {}) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const k = Math.min(1, 1600 / Math.max(iw, ih));
    const W = Math.round(iw * k), H = Math.round(ih * k);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const thr = opts.threshold || 120;
    let dark = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const lum = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      dark[i] = lum < thr ? 1 : 0;
    }
    // ハッチングされた壁を塗りつぶすためのクロージング
    const cr = opts.close ?? 2;
    if (cr > 0) dark = morph(morph(dark, W, H, cr, true), W, H, cr, false);
    const tmin = Math.max(2, Math.round((opts.minThickPx || Math.min(iw, ih) * 0.006) * k));
    const tmax = Math.round((opts.maxThickPx || tmin * 4) * k);
    // 細線除去: 半径 tmin/2 の収縮→膨張(オープニング)
    const rr = Math.max(1, Math.floor(tmin / 2));
    const thick = morph(morph(dark, W, H, rr, false), W, H, rr, true);

    const minLen = tmin * 3;
    const hr = sweepRects(thick, W, H, minLen, Math.max(2, tmin / 2), true);
    const vr = sweepRects(thick, W, H, minLen, Math.max(2, tmin / 2), false);
    const walls = [], columns = [];
    const inv = 1 / k;
    for (const r of hr) {
      const t = r.y1 - r.y0 + 1, L = r.x1 - r.x0 + 1;
      if (t < tmin * 0.8) continue;
      if (t <= tmax && L >= t * 2.5) walls.push({ x1: r.x0 * inv, y1: ((r.y0 + r.y1 + 1) / 2) * inv, x2: (r.x1 + 1) * inv, y2: ((r.y0 + r.y1 + 1) / 2) * inv, thick: t * inv });
      else if (L / t < 1.6 && t <= tmax * 3) columns.push({ x: ((r.x0 + r.x1 + 1) / 2) * inv, y: ((r.y0 + r.y1 + 1) / 2) * inv, w: L * inv, d: t * inv });
    }
    for (const r of vr) {
      const t = r.x1 - r.x0 + 1, L = r.y1 - r.y0 + 1;
      if (t < tmin * 0.8) continue;
      if (t <= tmax && L >= t * 2.5) walls.push({ x1: ((r.x0 + r.x1 + 1) / 2) * inv, y1: r.y0 * inv, x2: ((r.x0 + r.x1 + 1) / 2) * inv, y2: (r.y1 + 1) * inv, thick: t * inv });
    }
    // 柱の重複を除去
    const cols = [];
    for (const c of columns) if (!cols.some((o) => Math.abs(o.x - c.x) < Math.max(o.w, c.w) / 2 && Math.abs(o.y - c.y) < Math.max(o.d, c.d) / 2)) cols.push(c);
    return { walls, columns: cols };
  };
})();
