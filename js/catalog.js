// 種別・プリセット定義
(function () {
  const NZ = (window.NZ = window.NZ || {});

  NZ.WALL_KINDS = {
    structure: { label: '構造壁(変更不可)', fill: '#d4d4d4', hatch: true },
    existing: { label: '既存間仕切壁', fill: '#a9a9a9', hatch: false },
    new: { label: '新設壁', fill: '#ffffff', hatch: false },
    remove: { label: '撤去壁', fill: 'none', hatch: false, dashed: true },
  };

  // 壁の分割要素
  NZ.SEG_TYPES = {
    wall: { label: '壁', opts: [] },
    door: { label: '片開き戸', opts: ['hinge', 'side'], def: 800 },
    door2: { label: '両開き戸', opts: ['side'], def: 1600 },
    oyako: { label: '親子ドア', opts: ['hinge', 'side'], def: 1200 },
    entrance: { label: '玄関ドア', opts: ['hinge', 'side'], def: 900 },
    sliding: { label: '片引き戸', opts: ['hinge', 'side', 'sill'], def: 800, hingeLabel: ['引込み:始点側', '引込み:終点側'] },
    sliding2: { label: '引違い戸', opts: ['panels', 'sill'], def: 1600, panels: [2, 3, 4] },
    fusuma: { label: '襖(引違い)', opts: ['panels', 'sill'], def: 1690, panels: [2, 3, 4], sillDef: true },
    shoji: { label: '障子(引違い)', opts: ['panels', 'sill'], def: 1690, panels: [2, 3, 4], sillDef: true },
    pocket: { label: '引込み戸(戸袋)', opts: ['hinge'], def: 800, hingeLabel: ['戸袋:始点側', '戸袋:終点側'] },
    folding: { label: '折れ戸', opts: ['hinge', 'side', 'panels'], def: 800, panels: [2, 3, 4, 6] },
    folding2: { label: '両折れ戸', opts: ['side', 'panels'], def: 1600, panels: [4, 6, 8] },
    window: { label: 'ガラス窓(一般)', opts: ['sill'], def: 1690 },
    windowFixed: { label: 'ガラス窓(はめ殺し)', opts: ['sill'], def: 900 },
    windowSash: { label: 'ガラス小窓(開閉)', opts: ['hinge', 'side', 'sill'], def: 600, hingeLabel: ['開き:始点側', '開き:終点側'] },
    opening: { label: '開口(建具なし)', opts: ['sill'], def: 800 },
  };

  // 壁の高さ(mm)。既存図面は既定値を使用する。
  NZ.DEFAULT_WALL_HEIGHT = 2700;

  // 床仕上げ
  NZ.FLOOR_TYPES = {
    flooring: { label: 'フローリング', fill: '#f3e7cf', sizes: [[75, '幅75'], [150, '幅150'], [303, '幅303']], sizeLabel: '板幅', dir: true },
    carpet: { label: 'カーペット', fill: '#ebe7f0', sizes: [], dir: false },
    tile: { label: 'タイル', fill: '#f2f2ef', sizes: [[150, '150角'], [300, '300角'], [450, '450角'], [600, '600角']], sizeLabel: 'タイルサイズ', dir: false },
    tatami: { label: '畳', fill: '#e6ecc9', sizes: [[880, '江戸間(880×1760)'], [910, '中京間(910×1820)'], [955, '京間(955×1910)'], [850, '団地間(850×1700)']], sizeLabel: '畳の大きさ', dir: true },
    cf: { label: 'クッションフロア', fill: '#e9f1f5', sizes: [], dir: false },
    doma: { label: '土間・タイル(玄関)', fill: '#e4e2de', sizes: [[300, '300角'], [450, '450角']], sizeLabel: 'タイルサイズ', dir: false },
  };

  NZ.ZONE_TYPES = {
    kitchen: { label: 'キッチン', color: '#f2a65a' },
    toilet: { label: 'トイレ', color: '#6aa9e9' },
    bath: { label: '浴室', color: '#4fc1c9' },
    wash: { label: '洗面脱衣', color: '#8fd18f' },
    entrance: { label: '玄関', color: '#c9a37a' },
    storage: { label: '収納', color: '#b0a0d8' },
    other: { label: 'その他', color: '#aaaaaa' },
  };

  // 設備・住設  w:幅 d:奥行 h:高さ(mm)
  NZ.FIXTURE_TYPES = {
    kitchen: {
      label: 'システムキッチン',
      presets: [
        { name: 'I型 W2550', w: 2550, d: 650, h: 850 },
        { name: 'I型 W2400', w: 2400, d: 650, h: 850 },
        { name: 'I型 W2100', w: 2100, d: 650, h: 850 },
        { name: 'I型 W1800', w: 1800, d: 650, h: 850 },
        { name: 'ペニンシュラ W2550', w: 2550, d: 1000, h: 850 },
      ],
    },
    bath: {
      label: 'ユニットバス',
      presets: [
        { name: '1216 (内寸1200×1600)', w: 1200, d: 1600, h: 2000 },
        { name: '1317 (内寸1300×1700)', w: 1300, d: 1700, h: 2000 },
        { name: '1616 (内寸1600×1600)', w: 1600, d: 1600, h: 2000 },
        { name: '1618 (内寸1600×1800)', w: 1600, d: 1800, h: 2000 },
        { name: '1620 (内寸1600×2000)', w: 1600, d: 2000, h: 2000 },
      ],
    },
    toilet: {
      label: 'トイレ',
      presets: [
        { name: 'タンク付', w: 400, d: 750, h: 800 },
        { name: 'タンクレス', w: 400, d: 700, h: 550 },
      ],
    },
    vanity: {
      label: '洗面化粧台',
      presets: [
        { name: 'W600', w: 600, d: 500, h: 1850 },
        { name: 'W750', w: 750, d: 500, h: 1850 },
        { name: 'W900', w: 900, d: 500, h: 1850 },
      ],
    },
    washpan: {
      label: '洗濯機パン',
      presets: [
        { name: '640×640', w: 640, d: 640, h: 100 },
        { name: '740×640', w: 740, d: 640, h: 100 },
        { name: '800×640', w: 800, d: 640, h: 100 },
      ],
    },
    fridge: { label: '冷蔵庫', presets: [{ name: '標準', w: 700, d: 700, h: 1800 }] },
    other: { label: 'その他設備', presets: [{ name: '任意', w: 600, d: 600, h: 0 }] },

    // 置き家具(参考表示:細線)
    table: {
      label: 'テーブル', cat: 'loose',
      presets: [
        { name: '2人掛 W800', w: 800, d: 750, h: 700 },
        { name: '4人掛 W1350', w: 1350, d: 800, h: 700 },
        { name: '6人掛 W1800', w: 1800, d: 900, h: 700 },
        { name: '丸 φ900', w: 900, d: 900, h: 700, shape: 'round' },
        { name: 'ローテーブル W1000', w: 1000, d: 500, h: 400 },
      ],
    },
    chair: { label: '椅子', cat: 'loose', presets: [{ name: 'ダイニングチェア', w: 450, d: 500, h: 800 }, { name: 'アームチェア', w: 600, d: 600, h: 800 }] },
    sofa: {
      label: 'ソファ', cat: 'loose',
      presets: [
        { name: '2人掛 W1500', w: 1500, d: 850, h: 800 },
        { name: '3人掛 W2000', w: 2000, d: 900, h: 800 },
        { name: '1人掛 W850', w: 850, d: 850, h: 800 },
      ],
    },
    bed: {
      label: 'ベッド', cat: 'loose',
      presets: [
        { name: 'シングル', w: 1000, d: 2050, h: 450 },
        { name: 'セミダブル', w: 1250, d: 2050, h: 450 },
        { name: 'ダブル', w: 1450, d: 2050, h: 450 },
        { name: 'クイーン', w: 1650, d: 2050, h: 450 },
      ],
    },
    desk: { label: 'デスク', cat: 'loose', presets: [{ name: 'W1000', w: 1000, d: 600, h: 720 }, { name: 'W1200', w: 1200, d: 700, h: 720 }] },
    tvboard: { label: 'テレビボード', cat: 'loose', presets: [{ name: 'W1500', w: 1500, d: 450, h: 450 }, { name: 'W1800', w: 1800, d: 450, h: 450 }] },
    loose: { label: 'その他置き家具', cat: 'loose', presets: [{ name: '任意', w: 900, d: 450, h: 0 }] },

    // 造作家具(作り付け)
    shelf: { label: '造作棚', cat: 'built', presets: [{ name: 'W900 D300', w: 900, d: 300, h: 1800 }, { name: 'W1800 D350', w: 1800, d: 350, h: 2100 }] },
    storage: { label: '造作収納', cat: 'built', presets: [{ name: 'W900 D600', w: 900, d: 600, h: 2000 }, { name: 'W1800 D600', w: 1800, d: 600, h: 2400 }] },
    counter: { label: '造作カウンター', cat: 'built', presets: [{ name: 'W1800 D450', w: 1800, d: 450, h: 700 }, { name: 'W2400 D600', w: 2400, d: 600, h: 850 }] },
    wallcab: { label: '吊戸棚', cat: 'built', presets: [{ name: 'W900 D350', w: 900, d: 350, h: 700 }, { name: 'W1800 D350', w: 1800, d: 350, h: 700 }] },
    shoebox: { label: '下駄箱', cat: 'built', presets: [{ name: 'W900 D350', w: 900, d: 350, h: 900 }, { name: 'トール W900', w: 900, d: 400, h: 2100 }] },
  };
  NZ.FIXTURE_CATS = { equip: '設備', loose: '置き家具', built: '造作家具' };
  NZ.fixtureCat = (type) => (NZ.FIXTURE_TYPES[type] || {}).cat || 'equip';

  NZ.PAPERS = { A4: [297, 210], A3: [420, 297], A2: [594, 420] };
  NZ.SCALES = [10, 20, 30, 50, 100, 150, 200];
})();
