'use strict';
/* =====================================================================
   Serra Safe — aplicativo de segurança e preservação na Serra do Japi
   Estrutura: utilidades · armazenamento · dados · mapas offline · GPS ·
   alertas · motor de mapa · telas · eventos
   ===================================================================== */

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const R_EARTH = 6371008.8;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const daysSince = iso => iso ? Math.floor((Date.now() - (typeof iso === 'number' ? iso : Date.parse(iso))) / 86400000) : null;
const fmtDate = iso => { if (!iso) return 'sem data'; const d = new Date(iso); return isNaN(d) ? 'sem data' : d.toLocaleDateString('pt-BR'); };
const fmtDist = m => m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
const fmtBytes = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB';

const ICONS = {
  home: '<path d="M3 11 12 3l9 8M5 10v10h14V10"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14"/>',
  trail: '<path d="M5 21c0-6 14-4 14-10S7 8 9 3"/><circle cx="5" cy="21" r="1.5"/><circle cx="9" cy="3" r="1.5"/>',
  leaf: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15ZM5 19l8-8"/>',
  alert: '<path d="M12 3 2 20h20L12 3ZM12 10v4M12 17.5v.01"/>',
  hut: '<path d="M3 20 12 5l9 15ZM10 20v-5h4v5"/>',
  dl: '<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01"/>',
  wifioff: '<path d="M3 3l18 18M2 9a15 15 0 0 1 5-3M17 6.5A15 15 0 0 1 22 9M5 12.5a10 10 0 0 1 4-2.4M15 10.1a10 10 0 0 1 4 2.4M8.5 16a5 5 0 0 1 3.5-1.5M12 19.5v.01"/>',
  gps: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  gpsoff: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M3 3l18 18"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Armazenamento local ---------- */
const KEY = 'serrasafe_v3';
const DB = { maps: null, check: [], reports: [], settings: { demo: true, anchor: null } };
function dbLoad() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const o = JSON.parse(raw); DB.maps = o.maps || null; DB.check = o.check || []; DB.reports = o.reports || []; DB.settings = Object.assign({ demo: true, anchor: null }, o.settings || {}); }
    else {
      const v2 = localStorage.getItem('serrasafe_v2');
      if (v2) { const o = JSON.parse(v2); DB.check = o.check || []; DB.reports = o.reports || []; }
    }
  } catch (e) { /* armazenamento indisponível: o app funciona sem salvar */ }
}
function dbSave() { try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (e) { return false; } }

/* ---------- Estado ---------- */
const TILE_CACHE = 'serrasafe-tiles-v1';
const DATA_CACHE = 'serrasafe-data-v1';
const S = {
  view: 'home', arg: null, data: null, dataErr: '', feats: [], mvs: [], mapState: null,
  layers: { trilhas: true, zonas: true, apoio: true, atencao: true, info: true, naoVerif: false },
  forceOff: false, sw: 'verificando', dl: null, selected: null, learn: 'fauna', animal: null, qi: 0, qs: 0, qa: null, ci: 0,
  draft: { cat: 'lixo', desc: '', foto: null, loc: false, locData: null }, formMsg: '', confirmSend: null, confirmDel: false, delMsg: '',
  sim: null, simAcc: 10, storage: null, mapsMsg: ''
};
const online = () => navigator.onLine !== false && !S.forceOff;
const cacheOK = () => typeof caches !== 'undefined';

/* ---------- Geometria ---------- */
function mToLL(e, n, a) { return [a.lon + deg(e / (R_EARTH * Math.cos(rad(a.lat)))), a.lat + deg(n / R_EARTH)]; }
function llToXY(lon, lat, lon0, lat0) { return [rad(lon - lon0) * R_EARTH * Math.cos(rad(lat0)), rad(lat - lat0) * R_EARTH]; }
function distLL(a, b) { const [x, y] = llToXY(b[0], b[1], a[0], a[1]); return Math.hypot(x, y); }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function inPoly(pts, px, py) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
/* distância em metros do ponto (lat, lon) ao polígono; 0 se estiver dentro */
function distToPoly(lat, lon, ll) {
  const pts = ll.map(([lo, la]) => llToXY(lo, la, lon, lat));
  if (inPoly(pts, 0, 0)) return { d: 0, inside: true };
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; m = Math.min(m, segDist(0, 0, a[0], a[1], b[0], b[1])); }
  return { d: m, inside: false };
}
function lineLength(ll) { let s = 0; for (let i = 1; i < ll.length; i++) s += distLL(ll[i - 1], ll[i]); return s; }

/* ---------- Dados ---------- */
const TIPOS = { trilha: 'Trilha', area_restrita: 'Área restrita', apoio: 'Ponto de apoio', atencao: 'Ponto de atenção', entrada: 'Entrada', informacao: 'Ponto de informação' };
const VER = {
  verificado: { t: 'Verificado', cls: 'ok', i: 'check' },
  desatualizado: { t: 'Desatualizado', cls: 'warn', i: 'alert' },
  pendente: { t: 'Pendente de verificação', cls: 'warn', i: 'alert' },
  ficticio: { t: 'Fictício (protótipo)', cls: 'info', i: 'info' }
};
const AUT = { autorizada: 'Autorizada', restrita: 'Restrita', desconhecida: 'Autorização desconhecida', ficticia: 'Fictícia (demonstração)', nao_autorizada: 'Sem autorização (proposta)' };
const APOIO = { proposto: 'Proposta do projeto', avaliacao: 'Em avaliação', confirmado: 'Existente e confirmado' };
function verState(f) {
  if (f.verificacao === 'verificado') { const d = daysSince(f.verificadoEm); if (d === null || d > 365) return 'desatualizado'; }
  return f.verificacao;
}
const isDemo = f => f.verificacao === 'ficticio';
const trusted = f => verState(f) === 'verificado';
const trustedAuth = f => trusted(f) && f.autorizacao === 'autorizada';
function featureVisible(f) {
  if (isDemo(f)) return !!DB.settings.demo;
  if (f.tipo === 'trilha') return trustedAuth(f) || S.layers.naoVerif;
  return trusted(f) || S.layers.naoVerif;
}
function layerOn(f) {
  return { trilha: S.layers.trilhas, area_restrita: S.layers.zonas, apoio: S.layers.apoio, atencao: S.layers.atencao, entrada: S.layers.info, informacao: S.layers.info }[f.tipo] !== false;
}
const verTag = f => { const v = VER[verState(f)] || VER.pendente; return `<span class="tag ${v.cls}">${ic(v.i)}${v.t}</span>`; };
function anchor() { return DB.settings.anchor || S.data.meta.ancora; }
function resolveFeatures() {
  if (!S.data) { S.feats = []; return; }
  const a = anchor(), rel = S.data.meta.georef === 'relativo';
  S.feats = S.data.features.map(f => {
    let pts = f.geom.coords ? f.geom.coords : (f.geom.type === 'Polygon' ? f.geom.m[0] : f.geom.m).map(p => rel ? mToLL(p[0], p[1], a) : p);
    if (f.geom.type === 'Polygon' && f.geom.coords) pts = f.geom.coords[0];
    return Object.assign({}, f, { ll: pts });
  });
}
const featById = id => S.feats.find(f => f.id === id);
async function loadData() {
  try {
    const r = await fetch('data/dados.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text(); S.data = JSON.parse(t);
    if (cacheOK()) { try { const c = await caches.open(DATA_CACHE); await c.put('data/dados.json', new Response(t, { headers: { 'Content-Type': 'application/json' } })); } catch (e) { } }
  } catch (e) {
    try { if (cacheOK()) { const c = await caches.open(DATA_CACHE); const m = await c.match('data/dados.json'); if (m) S.data = await m.json(); } } catch (e2) { }
    if (!S.data) S.dataErr = location.protocol === 'file:'
      ? 'Os dados não podem ser lidos quando o arquivo é aberto direto do disco. Abra o app por um servidor local (por exemplo: python3 -m http.server).'
      : 'Não foi possível carregar os dados. Verifique a conexão e tente de novo.';
  }
  resolveFeatures();
}

/* ---------- Mapas offline (Cache API) ---------- */
const tilesCfg = () => (S.data && S.data.meta.tiles) || { ativo: false };
const tilesActive = () => { const t = tilesCfg(); return !!(t.ativo && t.url); };
const tileUrl = (t, z, x, y) => t.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const s = Math.sin(rad(lat)); return Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z); };
function dataBBox(marginM) {
  const pts = S.feats.flatMap(f => f.ll);
  if (!pts.length) return null;
  let w = 180, e = -180, s = 90, n = -90;
  pts.forEach(([lo, la]) => { w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la); });
  const dLat = deg(marginM / R_EARTH), dLon = deg(marginM / (R_EARTH * Math.cos(rad((s + n) / 2))));
  return { w: w - dLon, e: e + dLon, s: s - dLat, n: n + dLat };
}
function tileList(bb, zmin, zmax) {
  const out = [];
  for (let z = zmin; z <= zmax; z++) {
    const x0 = lon2x(bb.w, z), x1 = lon2x(bb.e, z), y0 = lat2y(bb.n, z), y1 = lat2y(bb.s, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]);
  }
  return out;
}
const MAX_TILES = 3000, DL_MARGIN = 800;
async function tileCount() { try { const c = await caches.open(TILE_CACHE); return (await c.keys()).length; } catch (e) { return 0; } }
const blobUrls = new Map();
async function tileBlobUrl(url) {
  if (blobUrls.has(url)) return blobUrls.get(url);
  let blob = null;
  try { if (cacheOK()) { const c = await caches.open(TILE_CACHE); const r = await c.match(url); if (r) blob = await r.blob(); } } catch (e) { }
  if (!blob && online()) { try { const r = await fetch(url, { mode: 'cors' }); if (r.ok) blob = await r.blob(); } catch (e) { } }
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  blobUrls.set(url, u);
  if (blobUrls.size > 400) { const k = blobUrls.keys().next().value; URL.revokeObjectURL(blobUrls.get(k)); blobUrls.delete(k); }
  return u;
}
async function verifyMaps() {
  if (!DB.maps || !cacheOK()) { if (DB.maps && !cacheOK()) { DB.maps = null; dbSave(); } return; }
  try {
    if (DB.maps.tiles) {
      const n = await tileCount();
      if (n < DB.maps.tiles.count * 0.95) { S.mapsMsg = 'Os mapas baixados não foram encontrados no aparelho (o navegador pode tê-los apagado). Baixe novamente.'; DB.maps = null; dbSave(); return; }
    }
    const c = await caches.open(DATA_CACHE);
    if (!(await c.match('data/dados.json'))) { S.mapsMsg = 'Os dados salvos não foram encontrados. Baixe novamente.'; DB.maps = null; dbSave(); }
  } catch (e) { }
}
async function downloadMaps() {
  if (!cacheOK()) { toast('bad', 'Armazenamento indisponível', 'Este navegador ou ambiente não permite guardar mapas offline.'); return; }
  if (!online()) { toast('warn', 'Sem internet', 'Conecte-se para baixar os mapas.'); return; }
  const t = tilesCfg();
  let list = [];
  if (tilesActive()) {
    const bb = dataBBox(DL_MARGIN);
    list = bb ? tileList(bb, t.minZoom, t.maxZoom) : [];
    if (list.length > MAX_TILES) { toast('bad', 'Área grande demais', `Seriam ${list.length} blocos de mapa. O limite é ${MAX_TILES}. Reduza a área ou o zoom máximo.`); return; }
  }
  S.dl = { st: 'run', done: 0, total: list.length, bytes: 0, fail: 0, cancel: false };
  render();
  try {
    const dc = await caches.open(DATA_CACHE);
    const r = await fetch('data/dados.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('dados');
    await dc.put('data/dados.json', r);
    if (list.length) {
      const tc = await caches.open(TILE_CACHE);
      let i = 0;
      const worker = async () => {
        while (!S.dl.cancel) {
          const k = i++; if (k >= list.length) return;
          const [z, x, y] = list[k], url = tileUrl(t, z, x, y);
          try {
            const rr = await fetch(url, { mode: 'cors' });
            if (!rr.ok) throw new Error('tile');
            const b = await rr.blob();
            await tc.put(url, new Response(b, { headers: { 'Content-Type': b.type || 'image/png' } }));
            S.dl.bytes += b.size;
          } catch (e) { S.dl.fail++; }
          S.dl.done++;
          dlProgress();
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    if (S.dl.cancel) { await caches.delete(TILE_CACHE); DB.maps = null; dbSave(); S.dl = null; toast('warn', 'Download cancelado', 'Os blocos parciais foram removidos.'); render(); return; }
    if (list.length && S.dl.fail > list.length * 0.05) {
      const f = S.dl.fail; await caches.delete(TILE_CACHE); DB.maps = null; dbSave(); S.dl = null;
      toast('bad', 'Download incompleto', `${f} blocos falharam. Nada foi salvo. Tente de novo com uma conexão melhor.`); render(); return;
    }
    DB.maps = { ts: Date.now(), dataTs: S.data.meta.atualizadoEm, tiles: list.length ? { count: list.length - S.dl.fail, bytes: S.dl.bytes, zmin: t.minZoom, zmax: t.maxZoom } : null };
    dbSave(); S.dl = null; S.mapsMsg = '';
    toast('ok', 'Download concluído', list.length ? 'Mapa e dados salvos neste aparelho.' : 'Dados salvos. Não há fonte de mapa-base configurada.');
  } catch (e) {
    S.dl = null; toast('bad', 'Falha no download', 'Não foi possível baixar. Verifique a conexão e tente de novo.');
  }
  render();
}
function dlProgress() {
  if (!S.dl) return;
  const pct = S.dl.total ? Math.round(S.dl.done / S.dl.total * 100) : 0;
  const b = $('#dlbar'), tx = $('#dltxt'), bw = $('#dlwrap');
  if (b) b.style.width = pct + '%';
  if (bw) bw.setAttribute('aria-valuenow', pct);
  if (tx) tx.textContent = `Baixando ${S.dl.done} de ${S.dl.total} blocos (${fmtBytes(S.dl.bytes)})…`;
  renderStatus();
}
async function removeMaps() {
  try { if (cacheOK()) { await caches.delete(TILE_CACHE); await caches.delete(DATA_CACHE); } } catch (e) { }
  blobUrls.forEach(u => URL.revokeObjectURL(u)); blobUrls.clear();
  DB.maps = null; dbSave();
}
async function registerSW() {
  if (!('serviceWorker' in navigator)) { S.sw = 'indisponivel'; return; }
  const limite = new Promise(res => setTimeout(() => res('timeout'), 4000));
  try {
    const r = await Promise.race([navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => 'ok'), limite]);
    S.sw = r === 'ok' ? 'ativo' : 'indisponivel';
  } catch (e) { S.sw = 'indisponivel'; }
}

/* ---------- GPS ---------- */
const GPS = { st: 'off', pos: null, watch: null, simulated: false, lastTs: 0, perm: '' };
function gpsStart() {
  if (S.sim) { toast('info', 'Simulação ativa', 'Pare a simulação para usar o GPS real.'); return; }
  if (!navigator.geolocation) { GPS.st = 'unavailable'; liveUpdate(); return; }
  if (GPS.watch != null) return;
  GPS.st = 'searching'; liveUpdate();
  try {
    GPS.watch = navigator.geolocation.watchPosition(p => {
      if (S.sim) return;
      onPosition({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() }, false);
    }, er => {
      if (er.code === 1) { gpsStop(true); GPS.st = 'denied'; }
      else if (er.code === 2) GPS.st = 'unavailable';
      else GPS.st = 'timeout';
      liveUpdate();
    }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
  } catch (e) { GPS.st = 'unavailable'; GPS.watch = null; liveUpdate(); }
}
function gpsStop(keepState) {
  if (GPS.watch != null) { try { navigator.geolocation.clearWatch(GPS.watch); } catch (e) { } GPS.watch = null; }
  if (!S.sim) { GPS.pos = null; GPS.simulated = false; }
  if (!keepState) GPS.st = S.sim ? GPS.st : 'off';
  AL.zones = {};
  liveUpdate();
}
function onPosition(p, simulated) {
  GPS.pos = p; GPS.simulated = simulated; GPS.lastTs = Date.now();
  GPS.st = p.acc > 50 ? 'imprecise' : 'ok';
  let rr = false;
  if (S.draft.loc && S.view === 'report' && !S.draft.locData && !simulated) { S.draft.locData = { lat: p.lat, lon: p.lon, acc: p.acc }; rr = true; }
  runAlerts(p);
  liveUpdate();
  if (rr) render();
}
const gpsWatching = () => GPS.watch != null || !!S.sim;
function gpsMessage() {
  const a = GPS.pos ? Math.round(GPS.pos.acc) : 0;
  switch (GPS.st) {
    case 'off': return { k: 'info', t: 'GPS desligado', x: 'Toque em “Ativar GPS” para ver sua posição. O aparelho vai pedir permissão de localização.' };
    case 'searching': return { k: 'info', t: 'Buscando localização…', x: 'Em mata fechada ou em locais cobertos o sinal pode demorar.' };
    case 'ok': return { k: 'ok', t: `GPS ativo (±${a} m)`, x: 'A precisão varia com a vegetação, o relevo e o clima.' };
    case 'imprecise': return { k: 'warn', t: `Localização imprecisa (±${a} m)`, x: 'Os alertas geográficos ficam suspensos. Vá para uma área aberta e aguarde.' };
    case 'denied': return { k: 'bad', t: 'Permissão de localização negada', x: 'Ative a localização para este site nas configurações do navegador ou do aparelho. O mapa continua disponível sem a sua posição.' };
    case 'unavailable': return { k: 'bad', t: 'GPS indisponível', x: 'Verifique se a localização do aparelho está ligada. Em locais fechados o sinal pode falhar.' };
    case 'timeout': return { k: 'warn', t: 'Sem sinal de GPS no momento', x: 'Tente em uma área aberta. O app continua tentando.' };
  }
  return { k: 'info', t: '', x: '' };
}
function coordTxt() { return GPS.pos ? GPS.pos.lat.toFixed(5) + ', ' + GPS.pos.lon.toFixed(5) : ''; }
async function copyCoords() {
  const txt = coordTxt(); if (!txt) return;
  try { await navigator.clipboard.writeText(txt); toast('ok', 'Coordenadas copiadas', txt); }
  catch (e) {
    const i = $('#coordfallback'); if (i) { i.focus(); i.select(); }
    toast('warn', 'Não foi possível copiar sozinho', 'As coordenadas foram selecionadas. Copie manualmente.');
  }
}
setInterval(() => {
  if (GPS.watch != null && !S.sim && GPS.pos && Date.now() - GPS.lastTs > 30000 && GPS.st !== 'timeout') { GPS.st = 'timeout'; liveUpdate(); }
}, 5000);

/* ---------- Alertas ambientais ---------- */
const AL = { zones: {}, log: [], banner: null };
const THRESH = 40, HYST = 25, COOLDOWN = 5 * 60 * 1000;
const alertZones = () => S.feats.filter(f => f.tipo === 'area_restrita' && (trusted(f) || (isDemo(f) && DB.settings.demo)));
function runAlerts(p) {
  if (p.acc > 50) {
    if (!AL.banner || AL.banner.kind !== 'imprecise') AL.banner = { kind: 'imprecise', acc: Math.round(p.acc) };
    else AL.banner.acc = Math.round(p.acc);
    return;
  }
  if (AL.banner && AL.banner.kind === 'imprecise') AL.banner = null;
  const zones = alertZones();
  zones.forEach(z => {
    const { d, inside } = distToPoly(p.lat, p.lon, z.ll);
    const eff = inside ? 0 : d - p.acc;
    const level = inside ? 2 : (eff <= THRESH ? 1 : 0);
    const st = AL.zones[z.id] || (AL.zones[z.id] = { level: 0, ts: 0 });
    const now = Date.now();
    if (level > st.level) { st.level = level; st.ts = now; notify(z, level, p, d); }
    else if (level < st.level) {
      if (level === 0 && d - p.acc > THRESH + HYST) st.level = 0;
      else if (level === 1 && st.level === 2) st.level = 1;
    } else if (level > 0 && now - st.ts > COOLDOWN) { st.ts = now; notify(z, level, p, d); }
  });
}
function notify(z, level, p, d) {
  AL.banner = { kind: level === 2 ? 'inside' : 'near', zone: z.id, acc: Math.round(p.acc), d: Math.round(d), ts: Date.now() };
  AL.log.unshift({ ts: Date.now(), nome: z.nome, level, demo: isDemo(z) });
  AL.log.length = Math.min(AL.log.length, 10);
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
}

/* ---------- Simulação (ferramentas de demonstração) ---------- */
function simPath() {
  const f = featById('trilha-a'); if (!f) return [];
  const out = [];
  for (let i = 1; i < f.ll.length; i++) {
    const a = f.ll[i - 1], b = f.ll[i], n = Math.max(1, Math.round(distLL(a, b) / 10));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  out.push(f.ll[f.ll.length - 1]);
  return out;
}
function simStart() {
  const path = simPath(); if (!path.length) return;
  if (GPS.watch != null) gpsStop(true);
  AL.zones = {}; AL.banner = null;
  S.sim = { path, i: 0, dir: 1, timer: null };
  const step = () => {
    const s = S.sim; if (!s) return;
    const [lon, lat] = s.path[s.i];
    onPosition({ lat, lon, acc: S.simAcc, t: Date.now() }, true);
    if (s.i + s.dir >= s.path.length || s.i + s.dir < 0) s.dir *= -1;
    s.i += s.dir;
  };
  S.sim.timer = setInterval(step, 800);
  step();
  render();
}
function simStop() {
  if (S.sim) { clearInterval(S.sim.timer); S.sim = null; }
  GPS.pos = null; GPS.simulated = false; GPS.st = GPS.watch != null ? 'searching' : 'off'; AL.zones = {}; AL.banner = null;
  liveUpdate(); render();
}

/* ---------- Motor de mapa ---------- */
function proj(lat, lon, z) { const s = 256 * 2 ** z; const sin = Math.sin(rad(lat)); return { x: (lon + 180) / 360 * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s }; }
function unproj(x, y, z) { const s = 256 * 2 ** z; return { lon: x / s * 360 - 180, lat: deg(Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y / s))) }; }
let mvCount = 0;
class MapView {
  constructor(root, o) {
    this.root = root; this.o = o || {}; this.id = 'mv' + (++mvCount);
    this.z = o.z || 16; this.c = { lat: o.lat, lon: o.lon }; this.size = { w: root.clientWidth || 320, h: root.clientHeight || 300 };
    this.tiles = new Map(); this.pointers = new Map(); this.following = false; this.user = null; this.sel = o.sel || null; this.moved = false;
    root.classList.add('mv'); root.classList.toggle('small', !!o.small);
    root.innerHTML = '<div class="mv-tiles"></div><svg class="mv-vec" role="img" aria-label="' + esc(o.label || 'Mapa') + '"></svg><div class="mv-note" role="status"></div>' +
      (o.interactive ? `<div class="mv-ctrl"><button type="button" class="icobtn" data-mv="in" aria-label="Aproximar">${ic('plus')}</button><button type="button" class="icobtn" data-mv="out" aria-label="Afastar">${ic('minus')}</button><button type="button" class="icobtn" data-mv="loc" aria-label="Centralizar na minha localização">${ic('locate')}</button></div>` : '') +
      '<div class="mv-attr"><span></span></div>';
    this.tilesEl = root.querySelector('.mv-tiles'); this.svg = root.querySelector('.mv-vec'); this.noteEl = root.querySelector('.mv-note'); this.attrEl = root.querySelector('.mv-attr span');
    if (o.interactive) { root.tabIndex = 0; this.bind(); }
    this.zr = tilesActive() ? [tilesCfg().minZoom, tilesCfg().maxZoom] : [12, 18];
    this.z = clamp(this.z, this.zr[0], this.zr[1]);
    if (o.fit) this.fit(o.fit); else this.render();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => { const w = root.clientWidth, h = root.clientHeight; if (w && h && (w !== this.size.w || h !== this.size.h)) { this.size = { w, h }; if (this.o.fit && !this.touched) this.fit(this.o.fit); else this.render(); } });
      this.ro.observe(root);
    }
  }
  destroy() { if (this.ro) this.ro.disconnect(); }
  get tl() { const wc = proj(this.c.lat, this.c.lon, this.z); return { x: wc.x - this.size.w / 2, y: wc.y - this.size.h / 2 }; }
  toScreen(lat, lon) { const p = proj(lat, lon, this.z), t = this.tl; return [p.x - t.x, p.y - t.y]; }
  setView(lat, lon, z) { this.c = { lat, lon }; if (z) this.z = clamp(z, this.zr[0], this.zr[1]); this.emit(); this.render(); }
  emit() { if (this.o.onMove) this.o.onMove(this.c, this.z); }
  fit(pts) {
    if (!pts.length) { this.render(); return; }
    let w = 180, e = -180, s = 90, n = -90;
    pts.forEach(([lo, la]) => { w = Math.min(w, lo); e = Math.max(e, lo); s = Math.min(s, la); n = Math.max(n, la); });
    const cLat = (s + n) / 2, cLon = (w + e) / 2;
    let z = this.zr[1];
    if (n === s && w === e) z = clamp(15, this.zr[0], this.zr[1]);
    else for (; z > this.zr[0]; z--) { const a = proj(n, w, z), b = proj(s, e, z); if (Math.abs(b.x - a.x) < this.size.w - 70 && Math.abs(b.y - a.y) < this.size.h - 70) break; }
    this.z = z; this.c = { lat: cLat, lon: cLon }; this.emit(); this.render();
  }
  panBy(dx, dy) { const wc = proj(this.c.lat, this.c.lon, this.z); this.c = unproj(wc.x - dx, wc.y - dy, this.z); this.emit(); this.render(); }
  zoomBy(dz) { const nz = clamp(this.z + dz, this.zr[0], this.zr[1]); if (nz === this.z) return; this.z = nz; this.emit(); this.render(); }
  setUser(p) { this.user = p; if (this.following && p) { this.c = { lat: p.lat, lon: p.lon }; this.emit(); } this.render(); }
  locate() {
    if (this.o.onLocate) this.o.onLocate(this);
  }
  bind() {
    const r = this.root;
    r.addEventListener('pointerdown', e => {
      if (e.target.closest('.mv-ctrl')) return;
      try { r.setPointerCapture(e.pointerId); } catch (x) { }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, target: e.target, moved: 0 });
      if (this.pointers.size === 2) this.pd = this.pdist();
    });
    r.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (this.pointers.size === 1) { if (p.moved > 4) { this.touched = true; this.following = false; this.panBy(dx, dy); } }
      else if (this.pointers.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const d = this.pdist(), ratio = d / (this.pd || d);
        if (ratio > 1.6) { this.zoomBy(1); this.pd = d; } else if (ratio < 0.62) { this.zoomBy(-1); this.pd = d; }
        this.touched = true; return;
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      this.pointers.delete(e.pointerId);
      if (p.moved < 6 && this.pointers.size === 0 && e.type === 'pointerup') {
        const t = p.target && p.target.closest ? p.target.closest('[data-fid]') : null;
        if (t && this.o.onSelect) this.o.onSelect(t.getAttribute('data-fid'));
      }
    };
    r.addEventListener('pointerup', up); r.addEventListener('pointercancel', up);
    r.addEventListener('wheel', e => { e.preventDefault(); const n = Date.now(); if (n - (this.wt || 0) < 250) return; this.wt = n; this.touched = true; this.zoomBy(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    r.addEventListener('keydown', e => {
      const k = e.key, st = 80;
      if (k === 'ArrowLeft') this.panBy(st, 0); else if (k === 'ArrowRight') this.panBy(-st, 0); else if (k === 'ArrowUp') this.panBy(0, st); else if (k === 'ArrowDown') this.panBy(0, -st);
      else if (k === '+' || k === '=') this.zoomBy(1); else if (k === '-') this.zoomBy(-1); else return;
      this.touched = true; this.following = false; e.preventDefault();
    });
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-mv]'); if (!b) return;
      const a = b.getAttribute('data-mv'); this.touched = true;
      if (a === 'in') this.zoomBy(1); else if (a === 'out') this.zoomBy(-1); else if (a === 'loc') this.locate();
    });
  }
  pdist() { const a = [...this.pointers.values()]; return a.length < 2 ? 1 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
  render() {
    this.drawTiles(); this.drawVec(); this.updateNote();
  }
  drawTiles() {
    const t = tilesCfg();
    this.tActive = tilesActive();
    if (!this.tActive) { if (this.tiles.size) { this.tilesEl.innerHTML = ''; this.tiles.clear(); } return; }
    const { w, h } = this.size, z = this.z, n = 2 ** z, tl = this.tl;
    const keep = new Set();
    for (let y = Math.floor(tl.y / 256); y <= Math.floor((tl.y + h) / 256); y++) {
      if (y < 0 || y >= n) continue;
      for (let x = Math.floor(tl.x / 256); x <= Math.floor((tl.x + w) / 256); x++) {
        const xx = ((x % n) + n) % n, key = `${z}/${x}/${y}`;
        let el = this.tiles.get(key);
        if (!el) {
          el = document.createElement('img'); el.alt = ''; el.draggable = false; el.dataset.s = 'pend';
          this.tilesEl.appendChild(el); this.tiles.set(key, el);
          const url = tileUrl(t, z, xx, y);
          tileBlobUrl(url).then(u => { if (u) { el.src = u; el.dataset.s = 'ok'; } else el.dataset.s = 'fail'; this.updateNote(); this.drawVec(); });
        }
        el.style.transform = `translate(${Math.round(x * 256 - tl.x)}px,${Math.round(y * 256 - tl.y)}px)`;
        keep.add(key);
      }
    }
    for (const [k, el] of this.tiles) if (!keep.has(k)) { el.remove(); this.tiles.delete(k); }
  }
  tileStats() { let ok = 0, fail = 0, pend = 0; this.tiles.forEach(el => { const s = el.dataset.s; if (s === 'ok') ok++; else if (s === 'fail') fail++; else pend++; }); return { ok, fail, pend }; }
  updateNote() {
    const n = this.noteEl; let txt = '', bad = false;
    const t = tilesCfg();
    if (!this.tActive) { txt = ''; }
    else {
      const st = this.tileStats();
      if (st.pend > 0) txt = 'Carregando mapa…';
      else if (st.fail > 0 && st.ok === 0) { txt = online() ? 'Mapa-base indisponível para esta área.' : 'Mapa-base indisponível: sem internet e esta área não foi baixada.'; bad = true; }
      else if (st.fail > 0) { txt = 'Parte do mapa-base não está disponível.'; bad = true; }
    }
    n.textContent = txt; n.classList.toggle('on', !!txt);
    this.allFailed = this.tActive && (() => { const st = this.tileStats(); return st.ok === 0 && st.fail > 0; })();
    this.attrEl.textContent = this.tActive ? (t.atribuicao || 'Mapa-base') : 'Sem mapa-base';
  }
  mpp() { return 156543.03392 * Math.cos(rad(this.c.lat)) / 2 ** this.z; }
  drawVec() {
    const { w, h } = this.size, P = ll => ll.map(([lo, la]) => this.toScreen(la, lo).map(v => v.toFixed(1)).join(',')).join(' ');
    let s = `<defs><pattern id="${this.id}h" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--danger)" stroke-width="2.5"/></pattern></defs>`;
    if (!this.tActive || this.allFailed) {
      const mpp = this.mpp(), step = [50, 100, 200, 500, 1000, 2000].find(v => v / mpp >= 60) || 2000, px = step / mpp, tl = this.tl;
      const wc = proj(this.c.lat, this.c.lon, this.z); void wc;
      const ox = -((tl.x * 1) % px), oy = -((tl.y * 1) % px);
      s += `<g stroke="var(--map-line)" stroke-width="1" opacity=".9">`;
      for (let x = ox; x < w; x += px) s += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${h}"/>`;
      for (let y = oy; y < h; y += px) s += `<line x1="0" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}"/>`;
      s += '</g>';
    }
    const feats = S.feats.filter(f => layerOn(f) && featureVisible(f));
    const sel = this.sel;
    feats.filter(f => f.tipo === 'area_restrita').forEach(f => {
      s += `<polygon points="${P(f.ll)}" fill="url(#${this.id}h)" fill-opacity=".4" stroke="var(--danger)" stroke-width="${f.id === sel ? 4 : 2.5}" stroke-dasharray="6 4" data-fid="${esc(f.id)}"/>`;
    });
    feats.filter(f => f.tipo === 'trilha').forEach(f => {
      const ok = isDemo(f) ? f.autorizacao !== 'desconhecida' : trustedAuth(f);
      const col = !ok ? 'var(--muted)' : (f.props && f.props.bicicleta ? 'var(--earth)' : 'var(--forest)');
      const pts = P(f.ll), w1 = f.id === sel ? 8 : 5;
      s += `<polyline points="${pts}" fill="none" stroke="var(--bg)" stroke-width="${w1 + 5}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
      s += `<polyline points="${pts}" fill="none" stroke="${col}" stroke-width="${w1}" stroke-linecap="round" stroke-linejoin="round"${ok ? '' : ' stroke-dasharray="7 7"'}/>`;
      s += `<polyline points="${pts}" fill="none" stroke="transparent" stroke-width="28" stroke-linecap="round" data-fid="${esc(f.id)}"/>`;
    });
    const pt = f => this.toScreen(f.ll[0][1], f.ll[0][0]);
    feats.filter(f => f.tipo === 'atencao').forEach(f => { const [x, y] = pt(f); s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" data-fid="${esc(f.id)}"><circle r="20" fill="transparent"/><rect x="-9" y="-9" width="18" height="18" rx="3" transform="rotate(45)" fill="var(--surface)" stroke="var(--warn)" stroke-width="${f.id === sel ? 4 : 2.5}"/><text y="4.5" font-size="13" font-weight="800" text-anchor="middle" fill="var(--warn)">!</text></g>`; });
    feats.filter(f => f.tipo === 'entrada').forEach(f => { const [x, y] = pt(f); s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" data-fid="${esc(f.id)}"><circle r="20" fill="transparent"/><rect x="-9" y="-9" width="18" height="18" rx="3" fill="var(--forest)" stroke="var(--bg)" stroke-width="2"/></g>`; });
    feats.filter(f => f.tipo === 'informacao').forEach(f => { const [x, y] = pt(f); s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" data-fid="${esc(f.id)}"><circle r="20" fill="transparent"/><circle r="9" fill="var(--surface)" stroke="var(--forest)" stroke-width="2.5"/><text y="4" font-size="12" font-weight="800" text-anchor="middle" fill="var(--forest)">i</text></g>`; });
    feats.filter(f => f.tipo === 'apoio').forEach(f => {
      const [x, y] = pt(f), st = f.props && f.props.situacao, tri = 'M-11 9 0 -10 11 9Z';
      let inner;
      if (st === 'confirmado') inner = `<path d="${tri}" fill="var(--forest)" stroke="var(--bg)" stroke-width="2"/>`;
      else if (st === 'avaliacao') inner = `<path d="${tri}" fill="var(--surface2)" stroke="var(--warn)" stroke-width="2.5" stroke-dasharray="1.5 3" stroke-linecap="round"/><text y="6" font-size="11" font-weight="800" text-anchor="middle" fill="var(--warn)">?</text>`;
      else inner = `<path d="${tri}" fill="var(--surface)" stroke="var(--earth)" stroke-width="2.5" stroke-dasharray="4 3"/>`;
      s += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" data-fid="${esc(f.id)}"><circle r="20" fill="transparent"/>${inner}${f.id === sel ? '<circle r="16" fill="none" stroke="var(--fg)" stroke-width="2"/>' : ''}</g>`;
    });
    if (this.user) {
      const [x, y] = this.toScreen(this.user.lat, this.user.lon), r = Math.max(8, this.user.acc / this.mpp());
      s += `<g aria-label="Sua posição"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--forest)" fill-opacity=".16" stroke="var(--forest)" stroke-width="1.5"${GPS.simulated ? ' stroke-dasharray="4 3"' : ''}/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="var(--forest)" stroke="#fff" stroke-width="3"/></g>`;
    }
    if (this.o.interactive) {
      const mpp = this.mpp(), step = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].filter(v => v / mpp <= 110).pop() || 10, px = step / mpp;
      s += `<g transform="translate(14 ${h - 34})"><rect x="-4" y="-14" width="${px + 56}" height="26" rx="6" fill="var(--surface)" opacity=".92"/><path d="M0 4V-4M${px.toFixed(1)} 4V-4M0 4H${px.toFixed(1)}" stroke="var(--fg)" stroke-width="2" fill="none"/><text x="${(px + 6).toFixed(1)}" y="5" font-size="12" font-weight="600" fill="var(--fg)">${step >= 1000 ? step / 1000 + ' km' : step + ' m'}</text></g>`;
    }
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.innerHTML = s;
  }
}

/* ---------- Ilustrações originais ---------- */
function scene() {
  let h = '<svg viewBox="0 0 360 150" role="img" aria-label="Ilustração original de morros cobertos de mata com névoa" preserveAspectRatio="xMidYMid slice">';
  h += '<rect width="360" height="150" fill="var(--surface2)"/><circle cx="84" cy="40" r="20" fill="var(--earth)" opacity=".75"/>';
  h += '<path d="M0 95 C40 58 80 70 120 85 S200 46 250 68 S330 58 360 78 V150 H0Z" fill="var(--forest)" opacity=".25"/>';
  h += '<path d="M0 112 C50 78 100 100 150 94 S260 68 360 100 V150 H0Z" fill="var(--forest)" opacity=".45"/>';
  h += '<path d="M0 92 C60 86 120 98 190 90 S300 84 360 92" fill="none" stroke="var(--bg)" stroke-width="6" opacity=".45" stroke-linecap="round"/>';
  h += '<path d="M0 132 C60 106 120 126 190 116 S300 100 360 126 V150 H0Z" fill="var(--forest)" opacity=".8"/>';
  [22, 48, 70, 300, 326, 344, 150, 205].forEach((x, i) => { const y = 118 + (i % 3) * 8, k = 1 + (i % 2) * .35; h += `<g transform="translate(${x} ${y}) scale(${k})"><rect x="-1.5" y="0" width="3" height="14" fill="var(--earth)"/><circle cx="0" cy="-4" r="10" fill="var(--forest)"/><circle cx="-6" cy="2" r="7" fill="var(--forest)"/><circle cx="6" cy="2" r="7" fill="var(--forest)"/></g>`; });
  h += '<path d="M236 34 q6 -6 12 0 q6 -6 12 0 M262 24 q5 -5 10 0 q5 -5 10 0" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linecap="round"/></svg>';
  return h;
}
function art(id) {
  const s = '<svg class="art" viewBox="0 0 64 64" aria-hidden="true">', e = '</svg>';
  if (id === 'tucano') return s + '<path d="M6 52 H58" stroke="var(--earth)" stroke-width="4" stroke-linecap="round"/><path d="M20 40 L5 50 L22 47Z" fill="var(--fg)"/><ellipse cx="32" cy="39" rx="14" ry="10" fill="var(--fg)"/><circle cx="44" cy="27" r="7" fill="var(--fg)"/><path d="M49 25 L63 30 L50 34Z" fill="var(--earth)"/><circle cx="45" cy="26" r="1.6" fill="var(--surface)"/>' + e;
  if (id === 'bugio') return s + '<path d="M4 14 H60" stroke="var(--forest)" stroke-width="4" stroke-linecap="round"/><path d="M40 48 C62 54 58 30 46 36" fill="none" stroke="var(--earth)" stroke-width="4" stroke-linecap="round"/><ellipse cx="32" cy="40" rx="10" ry="14" fill="var(--earth)"/><path d="M26 28 L24 14 M38 28 L40 14" stroke="var(--earth)" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="24" r="8" fill="var(--earth)"/><circle cx="29" cy="23" r="1.5" fill="var(--surface)"/><circle cx="35" cy="23" r="1.5" fill="var(--surface)"/>' + e;
  if (id === 'palmito') return s + '<path d="M32 62 V28" stroke="var(--earth)" stroke-width="4" stroke-linecap="round"/><g fill="none" stroke="var(--forest)" stroke-width="3.5" stroke-linecap="round"><path d="M32 28 C18 18 9 25 5 37"/><path d="M32 28 C46 18 55 25 59 37"/><path d="M32 28 C24 14 30 8 30 3"/><path d="M32 28 C40 14 34 8 36 3"/><path d="M32 28 C20 26 16 16 10 14"/><path d="M32 28 C44 26 48 16 54 14"/></g>' + e;
  if (id === 'bromelia') return s + '<g fill="none" stroke="var(--forest)" stroke-width="4" stroke-linecap="round"><path d="M32 60 C20 42 12 32 8 20"/><path d="M32 60 C26 40 26 30 28 14"/><path d="M32 60 C38 40 38 30 36 14"/><path d="M32 60 C44 42 52 32 56 20"/></g><circle cx="32" cy="42" r="5" fill="var(--earth)"/>' + e;
  return '';
}

/* ---------- Componentes de interface ---------- */
const MI = { ok: 'check', warn: 'alert', bad: 'alert', info: 'info' };
const msg = (k, t, x, extra) => `<div class="msg ${k}" role="${k === 'bad' ? 'alert' : 'status'}">${ic(MI[k])}<div><b>${t}</b>${x ? `<span>${x}</span>` : ''}${extra || ''}</div></div>`;
let toastTimer;
function toast(k, t, x) {
  const el = $('#toast'); if (!el) return;
  el.innerHTML = msg(k, esc(t), esc(x));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.innerHTML = ''; }, 4500);
}
function mapAge() { return DB.maps ? daysSince(DB.maps.ts) : null; }
function statusChips() {
  const on = online();
  const chips = [];
  chips.push({ k: on ? 'ok' : 'warn', i: on ? 'wifi' : 'wifioff', t: on ? 'Online' : (S.forceOff ? 'Offline (simulado)' : 'Offline'), go: 'settings' });
  const sim = GPS.simulated ? ' (simulado)' : '', a = GPS.pos ? Math.round(GPS.pos.acc) : 0;
  const g = {
    off: ['neutral', 'gpsoff', 'GPS desligado'], searching: ['neutral', 'gps', 'GPS buscando…'], ok: ['ok', 'gps', `GPS ativo · ±${a} m${sim}`],
    imprecise: ['warn', 'gps', `GPS impreciso · ±${a} m${sim}`], denied: ['bad', 'gpsoff', 'GPS negado'], unavailable: ['bad', 'gpsoff', 'GPS indisponível'], timeout: ['warn', 'gps', 'GPS sem sinal']
  }[GPS.st];
  chips.push({ k: g[0], i: g[1], t: g[2], go: 'map' });
  const age = mapAge();
  let m;
  if (S.dl) m = ['warn', 'dl', `Baixando ${S.dl.total ? Math.round(S.dl.done / S.dl.total * 100) : 0}%`];
  else if (!DB.maps) m = ['warn', 'map', 'Mapa: não baixado'];
  else if (age >= 30) m = ['warn', 'map', `Mapa: desatualizado · ${age} d`];
  else if (!DB.maps.tiles) m = ['warn', 'map', 'Mapa: só dados'];
  else m = ['ok', 'map', 'Mapa: baixado · ' + (age === 0 ? 'hoje' : age + ' d')];
  chips.push({ k: m[0], i: m[1], t: m[2], go: 'download' });
  return chips;
}
function renderStatus() {
  const el = $('#status'); if (!el) return;
  el.innerHTML = statusChips().map(c => `<button type="button" class="chip ${c.k}" data-act="go" data-arg="${c.go}">${ic(c.i)}${esc(c.t)}</button>`).join('');
}
function renderLive() {
  const el = $('#live'); if (!el) return;
  let h = '';
  if (S.sim) h += `<div style="margin-top:.75rem">${msg('info', 'Simulação de GPS ativa', 'A posição mostrada não é a do seu aparelho. Use apenas para demonstração.', `<div class="row"><button class="btn sm" type="button" data-act="simstop">Parar simulação</button></div>`)}</div>`;
  if (S.forceOff) h += `<div style="margin-top:.75rem">${msg('info', 'Modo offline simulado', 'O app está se comportando como se não houvesse internet.', `<div class="row"><button class="btn sm" type="button" data-act="offtoggle">Voltar ao normal</button></div>`)}</div>`;
  const b = AL.banner;
  if (b) {
    if (b.kind === 'imprecise') h += `<div style="margin-top:.75rem">${msg('warn', `Localização imprecisa (±${b.acc} m)`, 'Os alertas de áreas restritas estão suspensos. Permaneça na rota autorizada.')}</div>`;
    else {
      const z = featById(b.zone), demo = z && isDemo(z);
      h += `<div style="margin-top:.75rem">${msg('bad', b.kind === 'inside' ? 'Atenção! Você está dentro de uma área ambiental restrita.' : 'Atenção! Você está próximo de uma área ambiental restrita.',
        'Permaneça na rota autorizada e siga as orientações oficiais.' + (z && z.props && z.props.motivo ? `<br><span class="small">Por que proteger: ${esc(z.props.motivo)}</span>` : '') + `<br><span class="small">${demo ? 'DEMONSTRAÇÃO com área fictícia. ' : ''}Considerando a margem de erro do GPS (±${b.acc} m). O GPS não é preciso em todos os lugares.</span>`,
        `<div class="row"><button class="btn sm" type="button" data-act="dismissalert">Entendi</button></div>`)}</div>`;
    }
  }
  el.innerHTML = h;
}
function gpsInfoHtml(withCoordsOnly) {
  const m = gpsMessage(), watching = gpsWatching();
  let h = msg(m.k, esc(m.t), esc(m.x));
  if (GPS.pos) h += `<p class="coords" id="coordv" style="margin-top:.75rem">${coordTxt()}</p><p class="small">Precisão de ±${Math.round(GPS.pos.acc)} m · atualizado às ${new Date(GPS.pos.t).toLocaleTimeString('pt-BR')}${GPS.simulated ? ' · SIMULADO' : ''}</p>`;
  h += `<div class="row" style="margin-top:.75rem">` +
    (S.sim ? '' : (watching ? `<button class="btn sm" type="button" data-act="gpsoff">${ic('gpsoff')}Desligar GPS</button>` : `<button class="btn sm primary" type="button" data-act="gpson">${ic('gps')}Ativar GPS</button>`)) +
    (GPS.pos ? `<button class="btn sm" type="button" data-act="copy">${ic('copy')}Copiar coordenadas</button>` : '') + `</div>`;
  if (GPS.pos) h += `<input type="text" id="coordfallback" readonly value="${coordTxt()}" aria-label="Coordenadas para copiar" style="margin-top:.5rem">`;
  return h;
}
function liveUpdate() {
  renderStatus(); renderLive();
  const g = $('#gpsinfo'); if (g) g.innerHTML = gpsInfoHtml();
  S.mvs.forEach(mv => mv.setUser(GPS.pos));
  const lg = $('#alertlog'); if (lg) lg.innerHTML = alertLogHtml();
  const near = $('#nearapoio'); if (near) near.innerHTML = nearApoioHtml();
}
function alertLogHtml() {
  if (!AL.log.length) return '<p class="muted">Nenhum aviso nesta visita.</p>';
  return '<div class="list">' + AL.log.map(a => `<div><b>${a.level === 2 ? 'Dentro de' : 'Perto de'} ${esc(a.nome)}</b><br><span class="small">${new Date(a.ts).toLocaleTimeString('pt-BR')}${a.demo ? ' · demonstração' : ''}. Os avisos ficam só na memória e somem ao fechar o app.</span></div>`).join('') + '</div>';
}
function nearApoioHtml() {
  const conf = S.feats.filter(f => f.tipo === 'apoio' && f.props.situacao === 'confirmado' && trusted(f));
  if (!conf.length) return msg('warn', 'Nenhum ponto de apoio confirmado', 'As cabanas propostas não estão disponíveis para emergências.');
  if (!GPS.pos) return msg('info', 'Ative o GPS para ver o mais próximo', conf.length + ' ponto(s) confirmado(s).');
  const l = conf.map(f => ({ f, d: distLL([GPS.pos.lon, GPS.pos.lat], f.ll[0]) })).sort((a, b) => a.d - b.d);
  return '<div class="list">' + l.map(x => `<div><b>${esc(x.f.nome)}</b> · ${fmtDist(x.d)} em linha reta</div>`).join('') + '</div>';
}

/* ---------- Telas ---------- */
const NAV = [['home', 'Início', 'home'], ['map', 'Mapa', 'map'], ['trails', 'Trilhas', 'trail'], ['learn', 'Conhecer', 'leaf'], ['safety', 'Emergência', 'alert']];
function mapSubtitle() { return DB.settings.demo ? 'Dados de demonstração' : 'Somente dados verificados'; }
function viewHome() {
  const m = DB.maps, tiles = m && m.tiles;
  return (DB.settings.demo ? msg('info', 'Protótipo de demonstração', 'Trilhas, áreas e cabanas são fictícias e não representam a Serra do Japi real.') : '')
    + `<div class="mapwrap" data-act="go" data-arg="map"><div id="mapHome"></div><div class="mv-over"><span class="btn primary block">${ic('map')}<span>Abrir mapa<small>${mapSubtitle()}</small></span></span></div></div>`
    + `<div class="grid2">
      <button class="btn block" type="button" data-act="go" data-arg="download">${ic('dl')}<span>Baixar mapas offline<small>${m ? (tiles ? 'Baixado há ' + mapAge() + ' d' : 'Dados baixados, sem mapa-base') : 'Ainda não baixado'}</small></span></button>
      <button class="btn danger solid block" type="button" data-act="go" data-arg="safety">${ic('alert')}<span>Emergência<small>Funciona sem internet</small></span></button>
    </div>
    <div class="grid2">
      <button class="btn block" type="button" data-act="go" data-arg="trails">${ic('trail')}<span>Explorar trilhas</span></button>
      <button class="btn block" type="button" data-act="go" data-arg="learn">${ic('leaf')}<span>Conheça a Serra do Japi<small>Inclui “Vi um animal”</small></span></button>
      <button class="btn block" type="button" data-act="go" data-arg="huts">${ic('hut')}<span>Cabanas e pontos de apoio<small>${S.feats.some(f => f.tipo === 'apoio' && f.props.situacao === 'confirmado' && trusted(f)) ? 'Há pontos confirmados' : 'Nenhum confirmado ainda'}</small></span></button>
      <button class="btn block" type="button" data-act="go" data-arg="check">${ic('list')}<span>Prepare sua visita<small>${DB.check.length} de ${S.data.checklist.length} itens marcados</small></span></button>
      <button class="btn block" type="button" data-act="go" data-arg="report">${ic('flag')}<span>Relatar um problema ambiental<small>${DB.reports.length} relato(s) neste aparelho</small></span></button>
      <button class="btn block" type="button" data-act="go" data-arg="data">${ic('db')}<span>Fontes e dados<small>O que é verificado e o que é fictício</small></span></button>
    </div>
    <p class="muted">Este aplicativo não substitui os serviços de emergência, os monitores treinados nem as orientações oficiais.</p>`;
}
function mapMessages() {
  let h = '';
  if (S.mapsMsg) h += msg('warn', 'Mapas baixados não encontrados', esc(S.mapsMsg));
  if (!tilesActive()) h += msg('info', 'Sem mapa-base', 'Nenhuma fonte de mapas está configurada neste projeto. As trilhas e áreas aparecem sobre uma grade, e a posição do GPS é real.');
  else if (!DB.maps) h += msg('warn', 'Mapa ainda não baixado', online() ? 'Baixe antes da visita. Sem isso, o mapa-base não aparece quando você estiver sem internet.' : 'Você está sem internet e o mapa não foi baixado.', `<div class="row"><button class="btn sm" type="button" data-act="go" data-arg="download">${ic('dl')}Baixar agora</button></div>`);
  else if (mapAge() >= 30) h += msg('warn', 'Informação possivelmente desatualizada', `Os dados foram baixados há ${mapAge()} dias. Conecte-se para atualizar.`);
  const anyVerified = S.feats.some(f => trusted(f) && f.tipo !== 'entrada');
  if (!DB.settings.demo && !anyVerified) h += msg('warn', 'Sem dados verificados', 'O app não mostra trilhas como autorizadas nem gera alertas de áreas restritas sem dados verificados.');
  return h;
}
function selPanel() {
  const f = featById(S.selected);
  if (!f) return '<p class="muted">Toque em uma trilha, área ou ponto do mapa para ver os detalhes.</p>';
  let h = `<div class="row between"><h3>${esc(f.nome)}</h3><span class="small">${TIPOS[f.tipo]}</span></div><div>${verTag(f)}<span class="tag">${AUT[f.autorizacao] || f.autorizacao}</span>${f.tipo === 'apoio' ? `<span class="tag warn">${APOIO[f.props.situacao]}</span>` : ''}</div>`;
  h += `<p style="margin-top:.5rem">${esc(f.descricao)}</p>`;
  if (f.props && f.props.motivo) h += `<p class="muted" style="margin-top:.5rem"><b>Por que proteger:</b> ${esc(f.props.motivo)}</p>`;
  if (!alertZones().some(z => z.id === f.id) && f.tipo === 'area_restrita') h += `<p class="small" style="margin-top:.5rem">Esta área não gera alertas porque os limites não estão verificados.</p>`;
  h += `<p class="small" style="margin-top:.5rem">Fonte: ${esc(f.fonte)} · Verificado em ${fmtDate(f.verificadoEm)} · Atualizado em ${fmtDate(f.atualizadoEm)}</p>`;
  if (f.tipo === 'trilha') h += `<div class="row" style="margin-top:.75rem"><button class="btn sm primary" type="button" data-act="trail" data-arg="${esc(f.id)}">Ver detalhes da trilha</button></div>`;
  if (f.tipo === 'apoio') h += `<div class="row" style="margin-top:.75rem"><button class="btn sm primary" type="button" data-act="go" data-arg="huts">Ver ficha</button></div>`;
  return h;
}
function viewMap() {
  const tg = (k, l) => `<label><input type="checkbox" data-layer="${k}" ${S.layers[k] ? 'checked' : ''}> ${l}</label>`;
  return `<h1>Mapa</h1>${mapMessages()}
  <div id="mapMain" tabindex="0"></div>
  <div class="toggles" role="group" aria-label="Camadas do mapa">${tg('trilhas', 'Trilhas')}${tg('zonas', 'Áreas restritas')}${tg('apoio', 'Pontos de apoio')}${tg('atencao', 'Pontos de atenção')}${tg('info', 'Entradas e informação')}${tg('naoVerif', 'Mostrar não verificados')}</div>
  <div class="panel" id="sel" aria-live="polite">${selPanel()}</div>
  <div class="panel"><h2>Minha localização</h2><p class="muted" style="margin-bottom:.75rem">A localização é pedida só para mostrar onde você está. A posição não é gravada nem enviada.</p><div id="gpsinfo">${gpsInfoHtml()}</div></div>
  <div class="panel"><h2>Avisos desta visita</h2><div id="alertlog">${alertLogHtml()}</div></div>
  <div class="msg info">${ic('info')}<div><b>Como os alertas funcionam</b><span>Os alertas só usam áreas com limites verificados${DB.settings.demo ? ' (e, em modo de demonstração, as áreas fictícias)' : ''}. Eles consideram a margem de erro do GPS, evitam repetir o mesmo aviso e ficam suspensos se a localização estiver imprecisa. Funcionam offline porque os limites ficam salvos no aparelho.</span></div></div>
  <details class="ficha"><summary>Legenda do mapa</summary><div class="legend">
   <div><svg width="30" height="8" aria-hidden="true"><line x1="0" y1="4" x2="30" y2="4" stroke="var(--forest)" stroke-width="5" stroke-linecap="round"/></svg>Trilha a pé</div>
   <div><svg width="30" height="8" aria-hidden="true"><line x1="0" y1="4" x2="30" y2="4" stroke="var(--earth)" stroke-width="5" stroke-linecap="round"/></svg>Trilha que permite bicicleta</div>
   <div><svg width="30" height="8" aria-hidden="true"><line x1="0" y1="4" x2="30" y2="4" stroke="var(--muted)" stroke-width="5" stroke-dasharray="6 6"/></svg>Rota não verificada</div>
   <div><svg width="30" height="20" aria-hidden="true"><circle cx="15" cy="10" r="9" fill="var(--danger)" fill-opacity=".3" stroke="var(--danger)" stroke-dasharray="4 2"/></svg>Área restrita</div>
   <div><svg width="30" height="20" aria-hidden="true"><rect x="9" y="3" width="14" height="14" rx="3" fill="var(--forest)"/></svg>Entrada</div>
   <div><svg width="30" height="20" aria-hidden="true"><circle cx="15" cy="10" r="8" fill="none" stroke="var(--forest)" stroke-width="2.5"/></svg>Ponto de informação</div>
   <div><svg width="30" height="20" aria-hidden="true"><path d="M4 17 15 2 26 17Z" fill="var(--forest)"/></svg>Ponto de apoio confirmado</div>
   <div><svg width="30" height="20" aria-hidden="true"><path d="M4 17 15 2 26 17Z" fill="var(--surface2)" stroke="var(--warn)" stroke-width="2.5" stroke-dasharray="1.5 3"/></svg>Cabana em avaliação</div>
   <div><svg width="30" height="20" aria-hidden="true"><path d="M4 17 15 2 26 17Z" fill="none" stroke="var(--earth)" stroke-width="2.5" stroke-dasharray="4 3"/></svg>Cabana proposta (não existe)</div>
   <div><svg width="30" height="20" aria-hidden="true"><rect x="9" y="4" width="12" height="12" rx="2" transform="rotate(45 15 10)" fill="var(--surface)" stroke="var(--warn)" stroke-width="2.5"/></svg>Ponto de atenção</div>
   <div><svg width="30" height="20" aria-hidden="true"><circle cx="15" cy="10" r="6" fill="var(--forest)" stroke="#fff" stroke-width="2"/></svg>Sua posição</div></div></details>`;
}
function viewTrails() {
  const trails = S.feats.filter(f => f.tipo === 'trilha' && featureVisible(f));
  const cat = S.data.catalogo_trilhas;
  let h = '<h1>Trilhas</h1>';
  if (!trails.length) h += msg('warn', 'Nenhuma trilha com autorização verificada', 'O app só mostra trilhas no mapa quando a autorização foi verificada em fonte oficial.');
  else h += '<div class="panel list">' + trails.map(f => `<div><button class="btn block" type="button" data-act="trail" data-arg="${esc(f.id)}" style="border:0;padding-left:0;padding-right:0"><span><b>${esc(f.nome)}</b><br>${verTag(f)}<span class="tag">${AUT[f.autorizacao]}</span>${f.autorizacao !== 'desconhecida' && f.props.atividades.length ? `<br><small>${f.props.atividades.join(', ')} · ${fmtDist(lineLength(f.ll))}</small>` : '<br><small>Informações não verificadas</small>'}</span></button></div>`).join('') + '</div>';
  h += `<div class="panel"><h2>${esc(cat.titulo)}</h2><p class="muted" style="margin-bottom:.75rem">${esc(cat.aviso)}</p><div class="list">` + cat.itens.map(i => `<div><b>${esc(i.nome)}</b><br><span class="small">${esc(i.distancia)} · dificuldade ${esc(i.dificuldade.toLowerCase())}</span></div>`).join('') + `</div><p class="small" style="margin-top:.75rem">Fonte: <a href="${esc(cat.url)}" target="_blank" rel="noopener">${esc(cat.fonte)}</a> (${fmtDate(cat.dataFonte)}). ${verTag({ verificacao: cat.verificacao, verificadoEm: cat.dataFonte })}</p></div>`;
  return h;
}
function viewTrail() {
  const f = featById(S.arg);
  if (!f) return viewTrails();
  const p = f.props || {}, ok = trustedAuth(f), unk = f.autorizacao === 'desconhecida';
  let h = `<button class="btn sm" type="button" data-act="go" data-arg="trails" style="align-self:flex-start">← Trilhas</button><h1>${esc(f.nome)}</h1><div>${verTag(f)}<span class="tag">${AUT[f.autorizacao]}</span></div>`;
  if (isDemo(f) && !unk) h += msg('info', 'Rota de demonstração', 'Esta trilha é fictícia. A autorização, a distância e os demais dados servem só para mostrar o app.');
  if (unk || (!ok && !isDemo(f))) h += msg('warn', 'Informações sobre esta rota ainda não foram verificadas.', 'Consulte os responsáveis oficiais pela Serra do Japi antes de utilizá-la.');
  if (!unk) {
    h += `<div class="panel"><dl class="facts"><dt>Situação</dt><dd>${AUT[f.autorizacao]}</dd><dt>Atividades</dt><dd>${p.atividades && p.atividades.length ? p.atividades.join(', ') : 'Não verificado'}</dd><dt>Bicicleta</dt><dd>${p.bicicleta === true ? 'Permitida neste exemplo' : p.bicicleta === false ? 'Não permitida neste exemplo' : 'Não verificado'}</dd><dt>Distância</dt><dd>${fmtDist(lineLength(f.ll))} <span class="small">(calculada pelo traçado)</span></dd><dt>Duração</dt><dd>${esc(p.duracao || 'Não verificado')}</dd><dt>Dificuldade</dt><dd>${esc(p.dificuldade || 'Não verificado')}</dd><dt>Terreno</dt><dd>${esc(p.terreno || 'Não verificado')}</dd></dl></div>`;
    h += `<div class="panel"><h2>Recomendações de segurança</h2><ul class="clean"><li>Avise alguém sobre seu roteiro e horário de retorno.</li><li>Leve água, lanche, protetor solar e roupa adequada.</li><li>Baixe o mapa antes de sair e saia com a bateria carregada.</li><li>Volte antes do fim da tarde.</li></ul></div>`;
    h += `<div class="panel"><h2>Regras de preservação</h2><ul class="clean">${S.data.educacao.regras.proibido.map(r => `<li>${esc(r)}</li>`).join('')}<li>Não alimente animais silvestres.</li></ul></div>`;
    const ap = (p.apoio || []).map(featById).filter(Boolean);
    h += `<div class="panel"><h2>Pontos de apoio próximos</h2>${ap.length ? '<ul class="clean">' + ap.map(a => `<li>${esc(a.nome)}: ${APOIO[a.props.situacao].toLowerCase()}${a.props.situacao === 'confirmado' ? '' : ' (ainda não disponível)'}</li>`).join('') + '</ul>' : '<p class="muted">Nenhum ponto de apoio confirmado.</p>'}</div>`;
  }
  h += `<p class="small">Fonte: ${esc(f.fonte)} · Verificado em ${fmtDate(f.verificadoEm)} · Atualizado em ${fmtDate(f.atualizadoEm)}</p>`;
  h += `<div id="mapTrail"></div><button class="btn block" type="button" data-act="seemap" data-arg="${esc(f.id)}">${ic('map')}<span>Ver no mapa grande</span></button>`;
  return h;
}
function viewLearn() {
  const E = S.data.educacao;
  const tabs = [['fauna', 'Fauna'], ['flora', 'Flora'], ['animal', 'Vi um animal'], ['regras', 'Regras'], ['curio', 'Curiosidades'], ['quiz', 'Quiz']];
  let h = `<div class="scene">${scene()}<span>Ilustração original</span></div><h1>Conheça a Serra do Japi</h1><div class="tabs" role="tablist">${tabs.map(x => `<button role="tab" type="button" aria-selected="${S.learn === x[0]}" data-act="learn" data-arg="${x[0]}">${x[1]}</button>`).join('')}</div>`;
  const card = o => `<div class="panel item">${art(o.id)}<div><h3>${esc(o.comum)}</h3><p class="small"><i>${esc(o.cientifico)}</i></p><p style="margin-top:.5rem">${esc(o.texto)}</p><div style="margin-top:.5rem">${verTag(o)}<span class="tag">${ic('eye')}Foto autorizada pendente</span></div><p class="small">${esc(E.fonte_pendente)}</p></div></div>`;
  if (S.learn === 'fauna') h += `<p class="muted">Exemplos de espécies da Mata Atlântica. Nenhum avistamento é indicado. O conteúdo fica salvo no app e funciona offline.</p>` + E.fauna.map(card).join('');
  if (S.learn === 'flora') h += `<p class="muted">Exemplos de plantas da Mata Atlântica.</p>` + E.flora.map(card).join('');
  if (S.learn === 'animal') {
    h += msg('info', 'Vi um animal', 'Consulte informações educativas sobre animais documentados. Este recurso não identifica espécies por foto ou descrição. As imagens são ilustrações originais, pois ainda não há fotos com autorização de uso.');
    h += E.fauna.map((o, i) => { const open = S.animal === i; return `<div class="panel"><button type="button" class="btn block" data-act="animal" data-arg="${i}" aria-expanded="${open}" style="border:0;padding:0;min-height:56px"><span class="item" style="align-items:center">${art(o.id)}<span><b>${esc(o.comum)}</b><br><small>${open ? 'Toque para fechar' : 'Toque para ver como agir'}</small></span></span></button>${open ? `<div style="margin-top:.75rem"><p>${esc(o.texto)}</p><ul class="clean" style="margin-top:.5rem">${E.regras.observar.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="small" style="margin-top:.5rem">${esc(E.fonte_pendente)}</p></div>` : ''}</div>`; }).join('');
    h += msg('warn', 'Proteja as espécies', 'Não compartilhe a localização exata de espécies ameaçadas ou de locais sensíveis, nem nas redes sociais.');
  }
  if (S.learn === 'regras') {
    h += `<div class="panel"><h2>Por que a Mata Atlântica importa</h2><p>${esc(E.regras.mata)}</p><p class="small" style="margin-top:.5rem">Fonte a verificar antes de publicar.</p></div>`
      + `<div class="panel"><h2>Fatos sobre a Serra do Japi</h2><div class="list">${S.data.fatos_serra.map(f => `<div>${esc(f.t)}<br><span class="small"><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.fonte)}</a> · ${verTag({ verificacao: f.verificacao, verificadoEm: f.verificadoEm })}</span></div>`).join('')}</div></div>`
      + `<div class="panel"><h2>Como observar sem perturbar</h2><ul class="clean">${E.regras.observar.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`
      + `<div class="panel"><h2>Proibido</h2><ul class="clean">${E.regras.proibido.map(r => `<li>${esc(r)}</li>`).join('')}</ul><p class="small" style="margin-top:.5rem">Regras oficiais de visitação: a obter da gestão da Serra do Japi.</p></div>`;
  }
  if (S.learn === 'curio') h += `<div class="panel"><p class="muted">Você sabia?</p><p style="font-size:1.125rem;margin:.5rem 0" id="curio">${esc(E.curiosidades[S.ci % E.curiosidades.length])}</p><button class="btn sm primary" type="button" data-act="curio">Outra curiosidade</button></div>`;
  if (S.learn === 'quiz') {
    const q = E.quiz[S.qi];
    if (!q) h += `<div class="panel"><h2>Fim do quiz</h2><p>Você acertou ${S.qs} de ${E.quiz.length}.</p><div class="row" style="margin-top:.75rem"><button class="btn primary" type="button" data-act="qreset">Refazer</button></div></div>`;
    else h += `<div class="panel quiz"><p class="muted">Pergunta ${S.qi + 1} de ${E.quiz.length}</p><h2>${esc(q.q)}</h2>${q.o.map((o, i) => `<button class="opt ${S.qa !== null ? (i === q.c ? 'right' : (i === S.qa ? 'wrong' : '')) : ''}" type="button" data-act="qa" data-arg="${i}" ${S.qa !== null ? 'disabled' : ''}>${S.qa !== null && i === q.c ? '✓ ' : ''}${S.qa === i && i !== q.c ? '✗ ' : ''}${esc(o)}</button>`).join('')}${S.qa !== null ? `<div style="margin-top:.75rem">${msg(S.qa === q.c ? 'ok' : 'warn', S.qa === q.c ? 'Correto.' : 'Quase.', esc(q.e))}</div><div class="row" style="margin-top:.75rem"><button class="btn primary" type="button" data-act="qnext">Próxima</button></div>` : ''}</div>`;
  }
  return h;
}
function viewHuts() {
  const aps = S.feats.filter(f => f.tipo === 'apoio' && featureVisible(f));
  const conf = aps.filter(f => f.props.situacao === 'confirmado' && trusted(f));
  let h = '<h1>Cabanas e pontos de apoio</h1>';
  h += msg('warn', conf.length ? 'Há pontos de apoio confirmados' : 'Nenhum ponto de apoio está confirmado', 'As cabanas propostas pelo projeto não existem. Só poderão ser instaladas após avaliação e autorização ambiental, em locais fora de habitats sensíveis e com o mínimo de intervenção. Não há equipe de emergência nem equipamentos confirmados em nenhum local.');
  h += `<div class="panel"><h2>Situação dos pontos</h2><div class="legend"><div><span class="tag ok">${ic('check')}Existente e confirmado</span></div><div><span class="tag warn">${ic('alert')}Em avaliação</span></div><div><span class="tag warn">${ic('alert')}Proposta do projeto</span></div></div></div>`;
  h += aps.map(c => `<div class="panel"><div class="row between"><h2>${esc(c.nome)}</h2><span class="tag ${c.props.situacao === 'confirmado' ? 'ok' : 'warn'}">${APOIO[c.props.situacao]}</span></div><div>${verTag(c)}</div>
    <details class="ficha" style="margin-top:.75rem"><summary>Ver ficha</summary><dl class="facts"><dt>Identificação</dt><dd>${esc(c.id)}</dd><dt>Situação</dt><dd>${APOIO[c.props.situacao]}</dd><dt>Localização</dt><dd>${trusted(c) ? 'Verificada' : 'Não verificada (fictícia)'}</dd><dt>Recursos</dt><dd>${esc(c.props.recursos)}</dd><dt>Primeiros socorros</dt><dd>${esc(c.props.primeirosSocorros)}</dd><dt>Comunicação</dt><dd>${esc(c.props.comunicacao)}</dd><dt>Rotas próximas</dt><dd>${esc(c.props.rotas.join(', '))}</dd><dt>Orientações</dt><dd>${esc(c.props.orientacoes)}</dd></dl></details>
    <div class="row" style="margin-top:.75rem"><button class="btn sm" type="button" data-act="seemap" data-arg="${esc(c.id)}">${ic('map')}Ver no mapa</button></div></div>`).join('');
  h += `<div class="panel"><h2>O que cada cabana poderá ter, se aprovada</h2><ul class="clean"><li>Materiais básicos de primeiros socorros</li><li>Contatos oficiais de emergência</li><li>Equipamentos de comunicação</li><li>Mapas físicos e orientações aos visitantes</li><li>Materiais de educação ambiental</li><li>Informações sobre as rotas autorizadas mais próximas</li></ul></div>`;
  return h;
}
function viewSafety() {
  const em = S.data.emergencia;
  return `<h1>Segurança e emergência</h1>
  ${msg('bad', 'Este aplicativo não chama o resgate nem envia sua localização automaticamente.', 'Ligue você mesmo para os serviços de emergência. Esta tela funciona sem internet.')}
  <div class="panel"><h2>Números de emergência</h2><div class="list">${em.nacionais.map(n => `<div class="row between"><div><b>${esc(n.nome)}</b></div><div class="row" style="gap:.75rem"><span class="coords" style="color:var(--danger)">${esc(n.numero)}</span><a class="btn sm danger" href="tel:${esc(n.numero)}">${ic('phone')}Ligar</a></div></div>`).join('')}</div>
   <p class="small" style="margin-top:.75rem">${verTag({ verificacao: em.verificacao, verificadoEm: em.verificadoEm })} Fonte: <a href="${esc(em.url)}" target="_blank" rel="noopener">${esc(em.fonte)}</a>. O botão Ligar abre o discador se o aparelho permitir. Se não abrir, disque o número manualmente.</p></div>
  <div class="panel"><h2>Minhas coordenadas</h2><div id="gpsinfo">${gpsInfoHtml()}</div></div>
  <div class="panel"><h2>Contatos da gestão da Serra do Japi</h2>${msg('warn', 'Pendentes de verificação', 'Estes contatos vêm de uma notícia de 2022 e não são para emergências. Reconfirme antes de divulgar.')}<div class="list" style="margin-top:.75rem">${em.gestao.map(g => `<div><b>${esc(g.nome)}</b><br>${esc(g.tel)} · <span class="small">${esc(g.email)}</span><br>${verTag({ verificacao: g.verificacao })}<span class="small">${esc(g.nota)}</span></div>`).join('')}</div></div>
  <div class="panel"><h2>Ponto de apoio confirmado mais próximo</h2><div id="nearapoio">${nearApoioHtml()}</div></div>
  <div class="panel"><h2>Como informar sua localização</h2><ul class="clean"><li>Passe as coordenadas acima, se tiver obtido.</li><li>Diga o nome da trilha e o último ponto conhecido (entrada, placa).</li><li>Informe há quanto tempo está parado ou caminhando.</li><li>Descreva o que vê ao redor: rio, antena, mirante.</li></ul></div>
  <div class="panel"><h2>Se você se perder</h2><ul class="clean"><li>Pare e mantenha a calma. Não saia da trilha.</li><li>Volte pelo caminho que conhece, se tiver certeza.</li><li>Procure sinal de celular e ligue.</li><li>Economize bateria e água.</li></ul></div>
  <div class="panel"><h2>Se houver um acidente</h2><ul class="clean"><li>Garanta a segurança do local e das pessoas.</li><li>Ligue para 192 ou 193.</li><li>Não mova a vítima sem necessidade.</li><li>Siga as instruções do atendente.</li></ul></div>
  <div class="panel"><h2>Para evitar acidentes</h2><ul class="clean"><li>Avise alguém do seu roteiro.</li><li>Use calçado adequado e leve água.</li><li>Evite caminhar com chuva forte ou trovoadas.</li><li>Respeite as atividades permitidas em cada rota.</li></ul></div>`;
}
function viewCheck() {
  const C = S.data.checklist, pct = Math.round(DB.check.length / C.length * 100);
  return `<button class="btn sm" type="button" data-act="go" data-arg="home" style="align-self:flex-start">← Início</button><h1>Prepare sua visita</h1>
  <div class="panel"><p><b id="chkcount">${DB.check.length} de ${C.length}</b> itens marcados</p><div class="bar" style="margin-top:.5rem" role="progressbar" aria-label="Progresso do checklist" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><p class="small" style="margin-top:.5rem">Suas marcações ficam salvas neste aparelho e funcionam sem internet.</p></div>
  ${C.map((t, i) => { const on = DB.check.includes(i); return `<button class="check" type="button" role="checkbox" aria-checked="${on}" data-act="chk" data-arg="${i}"><span class="box">${on ? ic('check') : ''}</span><span>${esc(t)}</span></button>`; }).join('')}
  <div class="row"><button class="btn sm" type="button" data-act="chkreset">Desmarcar todos</button></div>`;
}
const CATS = [['lixo', 'Acúmulo de lixo'], ['vegetacao', 'Danos visíveis à vegetação'], ['trilha', 'Obstáculo ou dano em uma trilha'], ['sinal', 'Sinalização danificada'], ['outro', 'Outra situação ambiental']];
const RSTAT = { local: 'Salvo no aparelho', pending: 'Aguardando envio', sent: 'Enviado (demonstração)' };
function reportCard(r) {
  const cat = CATS.find(c => c[0] === r.cat);
  let h = `<div class="panel"><div class="row between"><h3>${esc(cat ? cat[1] : r.cat)}</h3><span class="tag ${r.status === 'sent' ? 'info' : 'warn'}">${ic(r.status === 'sent' ? 'check' : 'alert')}${RSTAT[r.status]}</span></div><p class="small">${new Date(r.ts).toLocaleString('pt-BR')}</p><p style="margin-top:.5rem">${esc(r.desc)}</p>`;
  if (r.foto) h += `<img class="photo" style="margin-top:.5rem" alt="Foto do relato" src="${r.foto}">`;
  h += r.loc ? `<p class="small" style="margin-top:.5rem">Localização registrada: ${r.loc.lat.toFixed(5)}, ${r.loc.lon.toFixed(5)} (±${Math.round(r.loc.acc)} m)</p>` : '<p class="small" style="margin-top:.5rem">Sem localização.</p>';
  if (r.status === 'sent') h += '<p class="small" style="margin-top:.25rem">Envio de demonstração: nenhum servidor recebeu este relato.</p>';
  h += '<div class="row" style="margin-top:.75rem">';
  if (S.confirmSend === r.id) h += `<div style="width:100%">${msg('warn', 'Confirmar envio?', 'Este protótipo não tem servidor: o relato será apenas marcado como enviado (demonstração).', `<div class="row"><button class="btn sm primary" type="button" data-act="sendyes" data-arg="${r.id}">Confirmar</button><button class="btn sm" type="button" data-act="sendno">Cancelar</button></div>`)}</div>`;
  else {
    if (r.status !== 'sent') {
      if (online()) h += `<button class="btn sm primary" type="button" data-act="send" data-arg="${r.id}">Enviar relato</button>`;
      else if (r.status === 'local') h += `<button class="btn sm" type="button" data-act="queue" data-arg="${r.id}">Enviar quando houver conexão</button>`;
      else h += '<span class="muted">Aguardando conexão para você confirmar o envio.</span>';
    }
    h += `<button class="btn sm danger" type="button" data-act="delrep" data-arg="${r.id}">${ic('trash')}Apagar</button>`;
  }
  return h + '</div></div>';
}
function viewReport() {
  const d = S.draft, pend = DB.reports.filter(r => r.status === 'pending').length;
  let h = `<button class="btn sm" type="button" data-act="go" data-arg="home" style="align-self:flex-start">← Início</button><h1>Relatar um problema ambiental</h1>`;
  h += msg('info', 'Protótipo sem servidor', 'Os relatos ficam salvos apenas neste aparelho. Nada é encaminhado às autoridades até existir um canal oficial de recebimento.');
  if (online() && pend) h += msg('warn', pend + ' relato(s) aguardando envio', 'Você está online. Confirme o envio de cada um abaixo.');
  h += `<form class="panel stack" id="repform" novalidate>
   <div class="field"><label for="rcat">Categoria</label><select id="rcat" data-draft="cat">${CATS.map(c => `<option value="${c[0]}"${d.cat === c[0] ? ' selected' : ''}>${c[1]}</option>`).join('')}</select></div>
   <div class="field"><label for="rdesc">Descrição</label><textarea id="rdesc" data-draft="desc" placeholder="Descreva o que você viu e onde, de forma geral.">${esc(d.desc)}</textarea></div>
   <div class="field"><label for="rfoto">Foto (opcional)</label><input type="file" id="rfoto" accept="image/*" data-draft="foto"><span class="small">A foto fica só neste aparelho e é reduzida para ocupar menos espaço.</span>${d.foto ? `<img class="photo" alt="Prévia da foto" src="${d.foto}"><button type="button" class="btn sm" data-act="rmfoto">Remover foto</button>` : ''}</div>
   <div class="field"><span class="lbl">Localização (opcional)</span><label style="display:flex;gap:.75rem;align-items:center;min-height:44px"><input type="checkbox" id="rloc" data-draft="loc" ${d.loc ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--forest)"> Registrar minha localização neste relato</label><span class="small">O aparelho vai pedir permissão de localização. Não registre a posição exata de espécies ameaçadas ou de locais sensíveis.</span>
   ${d.loc ? `<span role="status" class="small">${d.locData ? `Localização registrada: ${d.locData.lat.toFixed(5)}, ${d.locData.lon.toFixed(5)} (±${Math.round(d.locData.acc)} m)` : esc(gpsMessage().t + '. ' + gpsMessage().x)}</span>` : ''}</div>
   ${S.formMsg ? msg(S.formMsg.k, esc(S.formMsg.t), esc(S.formMsg.x || '')) : ''}
   <button type="submit" class="btn primary block" id="rsave">${ic('check')}Salvar relato neste aparelho</button></form>`;
  h += `<h2>Meus relatos (${DB.reports.length})</h2>`;
  h += DB.reports.length ? DB.reports.slice().reverse().map(reportCard).join('') : '<p class="muted">Nenhum relato salvo ainda.</p>';
  return h;
}
function viewDownload() {
  const t = tilesCfg(), m = DB.maps, bb = dataBBox(DL_MARGIN);
  const est = tilesActive() && bb ? tileList(bb, t.minZoom, t.maxZoom).length : 0;
  const pct = S.dl ? (S.dl.total ? Math.round(S.dl.done / S.dl.total * 100) : 0) : (m ? 100 : 0);
  let h = `<button class="btn sm" type="button" data-act="go" data-arg="home" style="align-self:flex-start">← Início</button><h1>Mapas offline</h1>`;
  if (S.mapsMsg) h += msg('warn', 'Atenção', esc(S.mapsMsg));
  h += `<div class="panel"><h2>O que está salvo neste aparelho</h2><div class="list">
   <div><b>Dados e informações</b> (trilhas, áreas, pontos, conteúdo educativo, emergência)<br>${m ? `<span class="tag ok">${ic('check')}Salvo há ${mapAge()} d</span>` : '<span class="tag warn">Não baixado</span>'}</div>
   <div><b>Mapa-base</b><br>${!tilesActive() ? '<span class="tag warn">Sem fonte de mapas configurada</span>' : (m && m.tiles ? `<span class="tag ok">${ic('check')}${m.tiles.count} blocos · ${fmtBytes(m.tiles.bytes)} · zoom ${m.tiles.zmin} a ${m.tiles.zmax}</span>` : '<span class="tag warn">Não baixado</span>')}</div>
   <div><b>App sem internet</b> (service worker)<br>${S.sw === 'ativo' ? `<span class="tag ok">${ic('check')}Ativo</span>` : (S.sw === 'verificando' ? '<span class="tag">Verificando…</span>' : '<span class="tag warn">Indisponível neste ambiente</span>')}</div></div></div>`;
  h += `<div class="panel"><h2>Baixar</h2><p class="muted" style="margin-bottom:.75rem">${tilesActive() ? `Área dos dados mais ${DL_MARGIN} m de margem, zoom ${t.minZoom} a ${t.maxZoom}: cerca de ${est} blocos.` : 'Sem fonte de mapa-base, só os dados e informações serão salvos.'} Use uma rede Wi-Fi.</p>
   <div class="bar" id="dlwrap" role="progressbar" aria-label="Progresso do download" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span id="dlbar" style="width:${pct}%"></span></div>
   <p class="muted" id="dltxt" role="status" style="margin:.5rem 0 .75rem">${S.dl ? `<span class="spin"></span> Baixando…` : (m ? 'Mapa salvo.' : (online() ? 'Pronto para baixar.' : 'Sem internet: conecte-se para baixar.'))}</p>
   <div class="row">${S.dl ? `<button class="btn" type="button" data-act="dlcancel">Cancelar</button>` : `<button class="btn primary" type="button" data-act="dl" ${online() ? '' : 'disabled'}>${ic('dl')}${m ? 'Atualizar mapas' : 'Baixar mapas'}</button>`}${m && !S.dl ? `<button class="btn danger" type="button" data-act="rmmaps">${ic('trash')}Remover downloads</button>` : ''}</div>
   ${!online() ? '<p class="small" style="margin-top:.5rem">Baixar e atualizar dependem de internet.</p>' : ''}</div>`;
  h += `<div class="panel"><h2>Sobre o mapa-base</h2><p class="muted">${esc(t.licenca || '')}</p><p class="muted" style="margin-top:.5rem">Tiles só podem ser baixados em lote quando a licença do provedor permite. Muitos serviços públicos, como o do OpenStreetMap, proíbem o download em massa.</p></div>`;
  return h;
}
function viewSettings() {
  const permTxt = { granted: 'Permitida', denied: 'Negada', prompt: 'Ainda não perguntada' }[GPS.perm] || 'Não foi possível consultar';
  const a = anchor();
  return `<button class="btn sm" type="button" data-act="go" data-arg="home" style="align-self:flex-start">← Início</button><h1>Ajustes</h1>
  <div class="panel"><h2>Localização</h2><p class="muted">Permissão do navegador: <b id="permtxt">${permTxt}</b></p><p class="muted" style="margin:.5rem 0">Usamos o GPS só para mostrar sua posição, preencher as coordenadas de emergência e, se você quiser, anexar ao relato. O histórico de localização não é guardado.</p><div id="gpsinfo">${gpsInfoHtml()}</div></div>
  <div class="panel"><h2>Mapas baixados</h2><p class="muted">${DB.maps ? `Dados salvos há ${mapAge()} d${DB.maps.tiles ? ` e ${DB.maps.tiles.count} blocos de mapa (${fmtBytes(DB.maps.tiles.bytes)})` : ''}.` : 'Nada baixado.'}</p><div class="row" style="margin-top:.75rem"><button class="btn sm primary" type="button" data-act="go" data-arg="download">Gerenciar downloads</button></div></div>
  <div class="panel"><h2>Funcionamento offline</h2><ul class="clean"><li>Mapas e dados precisam ser baixados antes, com internet.</li><li>Emergência, checklist, conteúdo educativo e relatos salvos funcionam sem internet.</li><li>O GPS pode funcionar sem internet, mas depende do sinal.</li><li>Enviar relatos e atualizar dados dependem de internet.</li></ul></div>
  <div class="panel"><h2>Modo de demonstração</h2><label class="toggles" style="display:flex"><span style="display:inline-flex;gap:.75rem;align-items:center;min-height:44px"><input type="checkbox" data-setting="demo" ${DB.settings.demo ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--forest)"> Mostrar dados fictícios de demonstração</span></label><p class="small" style="margin-top:.5rem">Desligado, o app mostra apenas dados verificados e não gera alertas sem eles.</p></div>
  <div class="panel"><h2>Ferramentas para a feira</h2><p class="muted" style="margin-bottom:.75rem">Servem para demonstrar o app sem estar na trilha. Tudo o que elas produzem aparece marcado como simulado.</p>
   <div class="stack">
    <button class="btn block" type="button" data-act="offtoggle">${ic(S.forceOff ? 'wifi' : 'wifioff')}<span>${S.forceOff ? 'Voltar ao modo online' : 'Simular modo offline'}<small>Faz o app agir como se não houvesse internet</small></span></button>
    <div class="field"><label for="simacc">Precisão simulada do GPS: ±<span id="simaccv">${S.simAcc}</span> m</label><input type="range" id="simacc" min="5" max="80" step="5" value="${S.simAcc}"></div>
    ${S.sim ? `<button class="btn block danger" type="button" data-act="simstop">${ic('x')}<span>Parar simulação de GPS</span></button>` : `<button class="btn block" type="button" data-act="simstart">${ic('trail')}<span>Simular caminhada pela Trilha Exemplo A<small>Gera posições de GPS simuladas e dispara os alertas</small></span></button>`}
    <button class="btn block" type="button" data-act="anchorme" ${GPS.pos && !GPS.simulated ? '' : 'disabled'}>${ic('pin')}<span>Posicionar a demonstração ao redor de mim<small>${GPS.pos && !GPS.simulated ? 'Move os dados fictícios para a sua posição atual' : 'Ative o GPS real e aguarde uma posição'}</small></span></button>
    <button class="btn block" type="button" data-act="anchorreset" ${DB.settings.anchor ? '' : 'disabled'}>${ic('home')}<span>Restaurar posição padrão da demonstração</span></button>
    <p class="small">Posição atual da demonstração: ${a.lat.toFixed(4)}, ${a.lon.toFixed(4)}. ${DB.settings.anchor ? 'Definida por você.' : esc(S.data.meta.ancora.descricao)}</p>
   </div></div>
  <div class="panel"><h2>Armazenamento neste aparelho</h2><p class="muted" id="storetxt">${S.storage ? S.storage : 'Calculando…'}</p></div>
  <div class="panel"><h2>Privacidade</h2><ul class="clean"><li>Seus dados ficam neste aparelho.</li><li>A localização só é lida quando você ativa o GPS e não é gravada, exceto num relato que você escolher.</li><li>Não coletamos nome, e-mail nem outros dados pessoais.</li><li>Fotos e relatos ficam só no aparelho e não são enviados.</li><li>Não divulgue a posição de espécies ameaçadas.</li></ul></div>
  <div class="panel"><h2>Apagar dados locais</h2><p class="muted" style="margin:.25rem 0 .75rem">Remove mapas baixados, checklist, relatos e ajustes deste aparelho.</p>${S.confirmDel ? msg('warn', 'Tem certeza?', 'Esta ação não pode ser desfeita.', `<div class="row"><button class="btn sm danger" type="button" data-act="delyes">Sim, apagar tudo</button><button class="btn sm" type="button" data-act="delno">Cancelar</button></div>`) : `<button class="btn sm danger" type="button" data-act="delask">${ic('trash')}Apagar dados locais</button>`}${S.delMsg ? `<div style="margin-top:.75rem">${msg('ok', esc(S.delMsg))}</div>` : ''}</div>
  <button class="btn block" type="button" data-act="go" data-arg="data">${ic('db')}<span>Fontes e dados<small>Verificação, fontes e status do protótipo</small></span></button>`;
}
function viewData() {
  const L = (t, a) => `<div class="panel"><h2>${t}</h2><ul class="clean">${a.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  const M = S.data.meta;
  return `<button class="btn sm" type="button" data-act="go" data-arg="settings" style="align-self:flex-start">← Ajustes</button><h1>Fontes e dados</h1>
  <div class="panel"><h2>Como lemos cada informação</h2><div class="list">
   <div><span class="tag ok">${ic('check')}Verificado</span> Confirmado em fonte oficial e recente.</div>
   <div><span class="tag warn">${ic('alert')}Desatualizado</span> Já foi verificado, mas a verificação tem mais de um ano.</div>
   <div><span class="tag warn">${ic('alert')}Pendente de verificação</span> Ainda não confirmado. Não gera alertas nem aparece como autorizado.</div>
   <div><span class="tag info">${ic('info')}Fictício (protótipo)</span> Existe só para demonstrar o app.</div></div></div>
  <div class="panel"><h2>Base de dados</h2><dl class="facts"><dt>Versão</dt><dd>${esc(M.versao)}</dd><dt>Atualizada em</dt><dd>${fmtDate(M.atualizadoEm)}</dd><dt>Coordenadas</dt><dd>${M.georef === 'relativo' ? 'Relativas a um ponto de demonstração (não são reais)' : 'Absolutas'}</dd></dl><p class="muted" style="margin-top:.5rem">${esc(M.descricao)}</p></div>
  <div class="panel"><h2>Itens do mapa</h2><div class="list">${S.feats.map(f => `<div><b>${esc(f.nome)}</b> <span class="small">· ${TIPOS[f.tipo]}</span><br>${verTag(f)}<br><span class="small">Fonte: ${esc(f.fonte)} · Verificado em ${fmtDate(f.verificadoEm)} · Atualizado em ${fmtDate(f.atualizadoEm)}</span></div>`).join('')}</div></div>
  <div class="panel"><h2>Fontes oficiais usadas</h2><div class="list">
   <div><a href="${esc(S.data.emergencia.url)}" target="_blank" rel="noopener">Prefeitura de Jundiaí: Telefones úteis</a><br><span class="small">Números de emergência. Verificado em ${fmtDate(S.data.emergencia.verificadoEm)}.</span></div>
   <div><a href="${esc(S.data.catalogo_trilhas.url)}" target="_blank" rel="noopener">Prefeitura de Jundiaí: visitação monitorada (2022)</a><br><span class="small">Trilhas citadas, sem traçado. Informação de ${fmtDate(S.data.catalogo_trilhas.dataFonte)}.</span></div>
   <div><a href="${esc(S.data.fatos_serra[0].url)}" target="_blank" rel="noopener">Prefeitura de Jundiaí: tombamento da Serra do Japi (2023)</a><br><span class="small">Tombamento, área e reconhecimento da Unesco.</span></div></div>
   <p class="small" style="margin-top:.75rem">Ainda sem incorporar: dados georreferenciados oficiais da Fundação Serra do Japi e fontes científicas para fauna e flora.</p></div>
  ${L('Funciona de verdade', ['Indicadores de conexão, GPS e mapa, lidos do estado real do aparelho', 'Motor de mapa georreferenciado: a posição do GPS aparece no mapa', 'GPS com permissão, avisos de erro e de precisão ruim', 'Download de blocos de mapa para o aparelho (Cache API) e leitura sem internet', 'App instalável que abre sem internet (service worker), quando servido por HTTPS ou localhost', 'Alertas de áreas restritas com margem de erro, histerese e pausa entre avisos', 'Coordenadas de emergência com cópia', 'Checklist e relatos salvos no aparelho', 'Apagar dados locais'])}
  ${L('Simulado ou fictício', ['Todas as trilhas, áreas, cabanas e pontos do mapa (dados fictícios)', 'Envio de relatos (não existe servidor)', 'Caminhada e GPS simulados, e modo offline simulado (ferramentas para a feira)'])}
  ${L('Ainda a desenvolver', ['Fonte de mapa-base licenciada (por exemplo MapLibre com PMTiles ou tiles próprios)', 'Servidor para receber relatos e painel de administração', 'Testes de campo do GPS e dos alertas'])}
  ${L('Dados oficiais necessários', ['Traçados (GPX ou shapefile) das trilhas autorizadas e as atividades permitidas em cada uma, inclusive bicicleta', 'Limites oficiais das áreas restritas e sensíveis', 'Distâncias, tempos e dificuldades verificados, com cruzamentos e trechos íngremes', 'Entradas e pontos de apoio confirmados', 'Contatos de emergência da gestão da Serra do Japi', 'Lista de fauna e flora validada, com fontes e fotos autorizadas', 'Canal oficial para receber relatos ambientais', 'Autorização ambiental para qualquer cabana'])}`;
}

/* ---------- Render ---------- */
const VIEWS = { home: viewHome, map: viewMap, trails: viewTrails, trail: viewTrail, learn: viewLearn, huts: viewHuts, safety: viewSafety, check: viewCheck, report: viewReport, download: viewDownload, settings: viewSettings, data: viewData };
function allPoints() { return S.feats.filter(f => featureVisible(f)).flatMap(f => f.ll); }
function mountMaps() {
  S.mvs.forEach(m => m.destroy()); S.mvs = [];
  const mk = (id, o) => {
    const el = $('#' + id); if (!el) return null;
    const st = o.read !== false && o.save !== false && S.mapState;
    const pts = o.fitPts || allPoints(), a = anchor();
    const base = { lat: st ? st.lat : 0, lon: st ? st.lon : 0, z: st ? st.z : 16, fit: st ? null : (pts.length ? pts : [[a.lon, a.lat]]), onMove: o.save ? (c, z) => { S.mapState = { lat: c.lat, lon: c.lon, z }; } : null, label: o.label };
    const mv = new MapView(el, Object.assign({}, o, base));
    mv.setUser(GPS.pos); S.mvs.push(mv); return mv;
  };
  mk('mapHome', { small: true, interactive: false, label: 'Mapa resumido da área', save: false });
  const mm = mk('mapMain', {
    interactive: true, save: true, label: 'Mapa interativo. Toque para ver detalhes, arraste para mover.', sel: S.selected,
    onSelect: id => { S.selected = id; mm.sel = id; const p = $('#sel'); if (p) p.innerHTML = selPanel(); mm.render(); },
    onLocate: v => {
      if (GPS.pos) { v.following = true; v.setView(GPS.pos.lat, GPS.pos.lon, Math.max(v.z, 16)); if (GPS.st === 'imprecise') toast('warn', 'Localização imprecisa', `±${Math.round(GPS.pos.acc)} m. O mapa foi centralizado, mas os alertas ficam suspensos.`); }
      else if (!gpsWatching()) { gpsStart(); toast('info', 'Ativando o GPS', 'Aceite o pedido de permissão do aparelho. Vamos centralizar assim que houver uma posição.'); v.following = true; }
      else toast('info', 'Aguardando posição', gpsMessage().t);
    }
  });
  if (S.view === 'trail') { const f = featById(S.arg); if (f) { const mv = mk('mapTrail', { small: true, interactive: false, save: false, read: false, fitPts: f.ll, sel: f.id, label: 'Mapa da trilha' }); } }
}
function render() {
  S.mvs.forEach(m => m.destroy()); S.mvs = [];
  const app = $('#app'); if (!app) return;
  let h;
  if (!S.data) h = S.dataErr ? msg('bad', 'Não foi possível carregar os dados', esc(S.dataErr), '<div class="row"><button class="btn sm" type="button" data-act="reload">Tentar de novo</button></div>') : '<p class="muted"><span class="spin"></span> Carregando…</p>';
  else h = (VIEWS[S.view] || viewHome)();
  app.innerHTML = h;
  const cur = S.view === 'trail' ? 'trails' : (['huts', 'download', 'settings', 'check', 'report', 'data'].includes(S.view) ? 'home' : S.view);
  $('#nav').innerHTML = NAV.map(n => `<button type="button" data-act="go" data-arg="${n[0]}" class="${n[0] === 'safety' ? 'sos' : ''}" ${cur === n[0] ? 'aria-current="page"' : ''}>${ic(n[2])}${n[1]}</button>`).join('');
  renderStatus(); renderLive();
  if (S.data) mountMaps();
  if (S.view === 'settings') updateStorageInfo();
}
async function updateStorageInfo() {
  try {
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); S.storage = `Usando ${fmtBytes(e.usage || 0)}${e.quota ? ' de cerca de ' + fmtBytes(e.quota) + ' disponíveis' : ''}.`; }
    else S.storage = 'Não foi possível consultar o armazenamento.';
  } catch (e) { S.storage = 'Não foi possível consultar o armazenamento.'; }
  const el = $('#storetxt'); if (el) el.textContent = S.storage;
}
function go(v, arg) {
  S.view = v; S.arg = arg === undefined ? null : arg; S.formMsg = ''; S.confirmSend = null; S.confirmDel = false; S.delMsg = '';
  if (v === 'settings' && navigator.permissions && navigator.permissions.query) {
    try { navigator.permissions.query({ name: 'geolocation' }).then(r => { GPS.perm = r.state; const e = $('#permtxt'); if (e) e.textContent = { granted: 'Permitida', denied: 'Negada', prompt: 'Ainda não perguntada' }[r.state] || r.state; r.onchange = () => { GPS.perm = r.state; }; }).catch(() => { }); } catch (e) { }
  }
  render(); window.scrollTo(0, 0);
  const m = $('#app'); if (m) m.focus({ preventScroll: true });
}
const uid = () => 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
function readPhoto(file, cb) {
  const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onload = () => { const m = 720, s = Math.min(1, m / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .7)); }; im.onerror = () => cb(null); im.src = r.result; };
  r.onerror = () => cb(null); r.readAsDataURL(file);
}

/* ---------- Eventos ---------- */
const ACT = {
  go: a => go(a),
  trail: a => go('trail', a),
  seemap: a => { S.selected = a; const f = featById(a); if (f) S.mapState = null; go('map'); if (f) { const mv = S.mvs.find(m => m.o.interactive); if (mv) { mv.fit(f.ll.length > 1 ? f.ll : [f.ll[0], [f.ll[0][0] + 0.0004, f.ll[0][1] + 0.0004]]); mv.sel = a; const p = $('#sel'); if (p) p.innerHTML = selPanel(); mv.render(); } } },
  learn: a => { S.learn = a; render(); },
  animal: a => { S.animal = S.animal === +a ? null : +a; render(); },
  curio: () => { S.ci++; render(); },
  qa: a => { const q = S.data.educacao.quiz[S.qi]; S.qa = +a; if (S.qa === q.c) S.qs++; render(); },
  qnext: () => { S.qi++; S.qa = null; render(); },
  qreset: () => { S.qi = 0; S.qs = 0; S.qa = null; render(); },
  offtoggle: () => { S.forceOff = !S.forceOff; render(); },
  gpson: () => gpsStart(),
  gpsoff: () => gpsStop(),
  copy: () => copyCoords(),
  dl: () => downloadMaps(),
  dlcancel: () => { if (S.dl) S.dl.cancel = true; },
  rmmaps: async () => { await removeMaps(); toast('ok', 'Downloads removidos', 'Os mapas e dados salvos foram apagados deste aparelho.'); render(); },
  chk: a => { const i = +a, k = DB.check.indexOf(i); if (k >= 0) DB.check.splice(k, 1); else DB.check.push(i); dbSave(); render(); },
  chkreset: () => { DB.check = []; dbSave(); render(); },
  rmfoto: () => { S.draft.foto = null; render(); },
  send: a => { S.confirmSend = a; render(); },
  sendno: () => { S.confirmSend = null; render(); },
  sendyes: a => { DB.reports.forEach(r => { if (r.id === a) r.status = 'sent'; }); S.confirmSend = null; dbSave(); toast('info', 'Envio de demonstração', 'O relato foi marcado como enviado, mas nenhum servidor o recebeu.'); render(); },
  queue: a => { DB.reports.forEach(r => { if (r.id === a) r.status = 'pending'; }); dbSave(); toast('ok', 'Marcado para envio', 'Você poderá confirmar o envio quando houver conexão.'); render(); },
  delrep: a => { DB.reports = DB.reports.filter(r => r.id !== a); dbSave(); render(); },
  delask: () => { S.confirmDel = true; render(); },
  delno: () => { S.confirmDel = false; render(); },
  delyes: async () => {
    await removeMaps();
    try { localStorage.removeItem(KEY); localStorage.removeItem('serrasafe_v2'); } catch (e) { }
    DB.maps = null; DB.check = []; DB.reports = []; DB.settings = { demo: true, anchor: null };
    S.confirmDel = false; S.draft = { cat: 'lixo', desc: '', foto: null, loc: false, locData: null }; S.mapState = null; S.selected = null;
    resolveFeatures(); S.delMsg = 'Dados locais apagados deste aparelho.'; render();
  },
  simstart: () => simStart(),
  simstop: () => simStop(),
  dismissalert: () => { AL.banner = null; renderLive(); },
  anchorme: () => { if (GPS.pos && !GPS.simulated) { DB.settings.anchor = { lat: GPS.pos.lat, lon: GPS.pos.lon, descricao: 'Definida por você.' }; dbSave(); resolveFeatures(); S.mapState = null; AL.zones = {}; toast('ok', 'Demonstração reposicionada', 'Os dados fictícios agora ficam ao redor da sua posição.'); render(); } },
  anchorreset: () => { DB.settings.anchor = null; dbSave(); resolveFeatures(); S.mapState = null; AL.zones = {}; toast('ok', 'Posição padrão restaurada', ''); render(); },
  reload: () => location.reload()
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const f = ACT[t.dataset.act]; if (!f) return;
  if (t.tagName === 'A' && !t.getAttribute('href').startsWith('tel:')) e.preventDefault();
  f(t.dataset.arg, t);
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.layer) { S.layers[t.dataset.layer] = t.checked; S.mvs.forEach(m => m.render()); return; }
  if (t.dataset && t.dataset.setting === 'demo') { DB.settings.demo = t.checked; dbSave(); AL.zones = {}; AL.banner = null; render(); return; }
  if (t.dataset && t.dataset.draft) {
    const k = t.dataset.draft;
    if (k === 'cat') S.draft.cat = t.value;
    if (k === 'foto' && t.files && t.files[0]) readPhoto(t.files[0], u => { if (u) S.draft.foto = u; else S.formMsg = { k: 'bad', t: 'Não foi possível ler essa foto.', x: 'Tente outra imagem.' }; render(); });
    if (k === 'loc') {
      S.draft.loc = t.checked; S.draft.locData = null;
      if (t.checked) { if (GPS.pos && !GPS.simulated) S.draft.locData = { lat: GPS.pos.lat, lon: GPS.pos.lon, acc: GPS.pos.acc }; else if (!gpsWatching()) gpsStart(); }
      render();
    }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'simacc') { S.simAcc = +t.value; const v = $('#simaccv'); if (v) v.textContent = S.simAcc; }
  if (t.dataset && t.dataset.draft === 'desc') S.draft.desc = t.value;
});
document.addEventListener('submit', e => {
  e.preventDefault();
  const d = S.draft;
  if (!d.desc || d.desc.trim().length < 5) { S.formMsg = { k: 'bad', t: 'Escreva uma descrição.', x: 'Use pelo menos 5 letras para que o relato seja compreendido.' }; render(); return; }
  if (d.loc && !d.locData) { S.formMsg = { k: 'warn', t: 'A localização ainda não foi obtida.', x: 'Aguarde o GPS ou desmarque a opção para salvar sem localização.' }; render(); return; }
  const r = { id: uid(), cat: d.cat, desc: d.desc.trim(), foto: d.foto, loc: d.loc ? d.locData : null, ts: Date.now(), status: 'local' };
  DB.reports.push(r);
  let note = '';
  if (!dbSave()) { r.foto = null; if (!dbSave()) { DB.reports.pop(); S.formMsg = { k: 'bad', t: 'Não foi possível salvar.', x: 'O armazenamento do aparelho está cheio ou bloqueado.' }; render(); return; } note = 'A foto não coube e foi descartada.'; }
  S.formMsg = { k: 'ok', t: 'Relato salvo neste aparelho.', x: note || 'Ele ainda não foi enviado.' };
  S.draft = { cat: 'lixo', desc: '', foto: null, loc: false, locData: null };
  render();
});
window.addEventListener('online', () => { render(); });
window.addEventListener('offline', () => { render(); });
$('#themeBtn').addEventListener('click', () => {
  const r = document.documentElement, dark = r.getAttribute('data-theme') ? r.getAttribute('data-theme') === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark ? 'light' : 'dark');
  S.mvs.forEach(m => m.render());
});

/* ---------- Início ---------- */
(async function init() {
  dbLoad(); render();
  await loadData();
  await verifyMaps();
  render();
  registerSW().then(() => { if (S.view === 'download') render(); });
  window.__SS = { S, DB, GPS, AL, onPosition, runAlerts, distToPoly, tileList, dataBBox, go, render, simStart, simStop, tileCount, downloadMaps, gpsMessage };
})();
