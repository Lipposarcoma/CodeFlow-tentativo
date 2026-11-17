/* ══════════════════════════════════════════════════════════
   ANALÍTICA DOCENTE
   Los números vienen del servidor (GET /docente/analitica): son los
   de TODOS los alumnos de la(s) sección(es) del docente, no los de
   la sesión local. Los nombres, íconos y colores de los módulos sí
   salen de MODS (lacaceria-datos.js).
   Requiere docente.js y auth.js (authFetch, mensajeError).
   ══════════════════════════════════════════════════════════ */

let AN = null;                  // última respuesta del servidor
let anCargando = false;

const ANV = id => String(id);   // MODS usa claves de texto: '1'..'6'

function anModulo(id){
  return (typeof MODS !== 'undefined' && MODS[ANV(id)]) || {name:'Módulo ' + id, icon:'', color:'#4F8EF7', levels:[]};
}

function anPct(parte, total){
  return total > 0 ? Math.round(parte / total * 100) : 0;
}

/* ───────────── carga ───────────── */
async function refreshAnalytics(){
  if(anCargando) return;
  anCargando = true;
  const sel = document.getElementById('section-select');
  try{
    const secciones = await docLeerSecciones();
    docPintarSelector(sel, secciones);

    if(!secciones.length){
      AN = null;
      pintarAnalitica();
      anAviso('Aún no tienes secciones asignadas.');
      return;
    }
    const q = sel.value ? '?seccion_id=' + encodeURIComponent(sel.value) : '';
    const res = await authFetch('/docente/analitica' + q);
    if(!res.ok) throw new Error(mensajeError(res));
    AN = res.datos;
    pintarAnalitica();
    anAviso('');
  }catch(e){
    AN = null;
    pintarAnalitica();
    anAviso(e.message || 'No se pudo cargar la analítica.');
  }finally{
    anCargando = false;
  }
}

function anAviso(texto){
  let el = document.getElementById('an-aviso');
  if(!el){
    el = document.createElement('p');
    el.id = 'an-aviso';
    el.className = 'doc-estado';
    const grid = document.querySelector('#view-analytics .a-grid');
    grid.parentNode.insertBefore(el, grid);
  }
  el.textContent = texto;
  el.hidden = !texto;
}

function pintarAnalitica(){
  const d = AN || {alumnos:0, activos_7d:0, respuestas:0, aciertos:0, errores:0, racha_max:0,
                   niveles_hechos:0, niveles_posibles:0, modulos:[], preguntas_dificiles:[],
                   ultimas:[], historial:[]};

  document.getElementById('a-acc').innerText = d.respuestas ? anPct(d.aciertos, d.respuestas) + '%' : '—';
  document.getElementById('a-sessions').innerText = d.activos_7d + ' / ' + d.alumnos;
  document.getElementById('a-lvls').innerText = d.niveles_hechos;
  document.getElementById('a-lvls-sub').innerText = 'de ' + d.niveles_posibles + ' posibles';
  document.getElementById('a-att').innerText = d.respuestas;
  document.getElementById('a-err').innerText = d.errores;
  document.getElementById('a-str').innerText = d.racha_max;

  buildErrorBarChart(d);
  buildDonut(d);
  buildPrecisionTimeline(d);
  buildModuleProgChart(d);
  buildErrorHeatmap(d);
  buildRadarChart(d);
  buildBossAnalytics(d);
  buildModTable(d);
  buildLog(d);
}

/* ───────────── gráficos ───────────── */
function buildBossAnalytics(d){
  const cont = document.getElementById('boss-analytics');
  const lista = d.modulos.filter(m => m.jefes > 0);
  if(!lista.length){
    cont.innerHTML = '<p class="chart-empty">Ningún alumno ha superado un Boss Fight aún</p>';
    return;
  }
  cont.innerHTML = lista.map(x => {
    const m = anModulo(x.modulo);
    const pct = anPct(x.jefes, d.alumnos);
    return `
      <div class="mini-bar-row">
        <div class="mini-bar-label">${m.icon} ${escD(m.name)}</div>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,#DC2626,#F97316)"></div></div>
        <div class="mini-bar-val" style="color:#f87171;width:56px">${x.jefes}/${d.alumnos}</div>
      </div>`;
  }).join('');
}

function buildModTable(d){
  const tbody = document.getElementById('mod-tbody');
  tbody.innerHTML = d.modulos.map(x => {
    const m = anModulo(x.modulo);
    const pct = anPct(x.niveles_hechos, x.niveles_posibles);
    const completo = x.niveles_posibles > 0 && x.niveles_hechos === x.niveles_posibles;
    const cls = completo ? 'pill-ok' : x.niveles_hechos > 0 ? 'pill-go' : 'pill-no';
    const lbl = completo ? 'Completado' : x.niveles_hechos > 0 ? 'En curso' : 'Sin iniciar';
    const isFinal = !m.candidateName;
    return `
      <tr>
        <td>${m.icon} ${escD(m.name)}${isFinal ? '<span class="boss-badge">JEFE</span>' : ''}</td>
        <td>${x.niveles_hechos}/${x.niveles_posibles}</td>
        <td><div class="tbar-w"><div class="tbar" style="width:${pct}%;background:${m.color};box-shadow:0 0 5px ${m.color}66"></div></div></td>
        <td><span class="pill ${cls}">${lbl}</span>${x.jefes ? `<span class="boss-badge">Boss ${x.jefes}/${d.alumnos}</span>` : ''}</td>
      </tr>`;
  }).join('');
}

function buildErrorHeatmap(d){
  const cont = document.getElementById('error-heatmap');
  if(!d.errores){
    cont.innerHTML = '<p class="chart-empty">Aún no hay errores registrados</p>';
    return;
  }
  // Intensidad relativa: el nivel con más errores es el más oscuro.
  const maxErr = Math.max(1, ...d.modulos.flatMap(x => x.niveles.map(n => n.errores)));
  cont.innerHTML = d.modulos.map(x => {
    const m = anModulo(x.modulo);
    const bloques = x.niveles.map(n => {
      const r = n.errores / maxErr;
      const bg = n.errores === 0 ? 'rgba(255,255,255,.04)' : r < .34 ? m.color + '55' : r < .67 ? m.color + '99' : m.color + 'ee';
      const border = n.errores > 0 ? m.color + '33' : 'rgba(255,255,255,.04)';
      const nombre = n.nivel === 6 ? 'Boss Fight' : ((m.levels[n.nivel - 1] || {}).name || 'Nivel ' + n.nivel);
      return `<div class="heatmap-block" title="${escD(nombre)}: ${n.errores} error(es)" style="background:${bg};border:1px solid ${border}"></div>`;
    }).join('');
    return `
      <div class="heatmap-row">
        <div class="heatmap-label">${m.icon} ${escD(m.name)}</div>
        <div class="heatmap-blocks">${bloques}</div>
        <div class="heatmap-val">${x.errores}</div>
      </div>`;
  }).join('');
}

function buildRadarChart(d){
  const wrap = document.getElementById('radar-wrap');
  const mods = d.modulos;
  const scores = mods.map(x => anPct(x.intentos - x.errores, x.intentos));
  if(!mods.length || scores.every(s => s === 0)){
    wrap.innerHTML = '<p class="chart-empty">Sin datos aún</p>';
    return;
  }
  const cx = 90, cy = 90, maxR = 72, n = mods.length;
  const ang = i => (Math.PI * 2 / n) * i - Math.PI / 2;
  const points = scores.map((s, i) => ({x: cx + (s / 100) * maxR * Math.cos(ang(i)), y: cy + (s / 100) * maxR * Math.sin(ang(i))}));

  const gridRings = [25, 50, 75, 100].map(pct => {
    const r = (pct / 100) * maxR;
    const pts = Array.from({length: n}, (_, i) => `${cx + r * Math.cos(ang(i))},${cy + r * Math.sin(ang(i))}`).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-width="1"></polygon>`;
  }).join('');

  const axes = mods.map((x, i) => {
    const m = anModulo(x.modulo), a = ang(i);
    const lx = cx + (maxR + 14) * Math.cos(a), ly = cy + (maxR + 14) * Math.sin(a);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + maxR * Math.cos(a)}" y2="${cy + maxR * Math.sin(a)}" stroke="var(--border)" stroke-width="1"></line><text class="radar-axis-label" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--muted)">${m.icon}</text>`;
  }).join('');

  const poly = points.map(p => `${p.x},${p.y}`).join(' ');
  wrap.innerHTML = `
    <svg width="180" height="180" viewBox="0 0 180 180">
      ${gridRings}${axes}
      <polygon points="${poly}" fill="rgba(79,142,247,.15)" stroke="var(--mod1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(79,142,247,.3))"></polygon>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--mod1)"></circle>`).join('')}
    </svg>
    <div class="radar-legend">
      ${mods.map((x, i) => { const m = anModulo(x.modulo); return `<div class="radar-legend-item">${m.icon} ${escD(m.name)}<strong>${scores[i]}%</strong></div>`; }).join('')}
    </div>`;
}

function buildErrorBarChart(d){
  const cont = document.getElementById('error-bar-chart');
  if(!d.preguntas_dificiles.length){
    cont.innerHTML = '<p class="chart-empty">Aún no hay errores registrados</p>';
    return;
  }
  cont.innerHTML = d.preguntas_dificiles.map(q => {
    const m = anModulo(q.modulo);
    const rate = anPct(q.errores, q.intentos);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escD(q.concepto)}">${m.icon} ${escD(q.concepto)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${rate}%;background:linear-gradient(90deg,${m.color},${m.color}99)">${rate > 15 ? rate + '%' : ''}</div>
        </div>
        <div class="bar-pct">${rate}%</div>
      </div>`;
  }).join('');
}

function buildDonut(d){
  const wrap = document.getElementById('donut-wrap');
  if(!d.respuestas){
    wrap.innerHTML = '<p class="chart-empty">Sin datos aún</p>';
    return;
  }
  const ok = d.aciertos, err = d.errores, tot = d.respuestas, r = 54, circ = 2 * Math.PI * r;
  const okD = circ * (ok / tot), errD = circ * (err / tot);
  wrap.innerHTML = `
    <div class="donut-svg-wrap">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="13"></circle>
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--green)" stroke-width="13" stroke-dasharray="${okD} ${circ - okD}" transform="rotate(-90 65 65)" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(34,197,94,.4))"></circle>
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--red)" stroke-width="13" stroke-dasharray="${errD} ${circ - errD}" stroke-dashoffset="${-okD}" transform="rotate(-90 65 65)" stroke-linecap="round"></circle>
      </svg>
      <div class="donut-center">
        <div class="donut-center-val">${anPct(ok, tot)}%</div>
        <div class="donut-center-lbl">precisión</div>
      </div>
    </div>
    <div class="donut-legend">
      <div class="donut-legend-item"><div class="donut-legend-dot" style="background:var(--green)"></div>Correctas<strong>${ok}</strong></div>
      <div class="donut-legend-item"><div class="donut-legend-dot" style="background:var(--red)"></div>Incorrectas<strong>${err}</strong></div>
      <div class="donut-legend-item"><div class="donut-legend-dot" style="background:var(--muted2)"></div>Total<strong>${tot}</strong></div>
    </div>`;
}

function buildPrecisionTimeline(d){
  const cont = document.getElementById('precision-timeline');
  if(!d.ultimas.length){
    cont.innerHTML = '<p class="chart-empty">Sin datos aún</p>';
    return;
  }
  const last = d.ultimas;
  cont.innerHTML = `
    <div class="precision-row">
      ${last.map(ok => `<div class="precision-cell ${ok ? 'ok' : 'err'}" title="${ok ? 'Correcta' : 'Incorrecta'}">${ok ? '✓' : '✗'}</div>`).join('')}
    </div>
    <div class="precision-footer">
      <span>↑ más reciente</span>
      <span>${last.filter(x => x).length}/${last.length} correctas</span>
    </div>`;
}

function buildModuleProgChart(d){
  const cont = document.getElementById('module-prog-chart');
  if(!d.modulos.some(x => x.niveles_hechos > 0)){
    cont.innerHTML = '<p class="chart-empty">Sin datos aún</p>';
    return;
  }
  cont.innerHTML = d.modulos.map(x => {
    const m = anModulo(x.modulo);
    const pct = anPct(x.niveles_hechos, x.niveles_posibles);
    return `
      <div class="mini-bar-row">
        <div class="mini-bar-label">${m.icon} ${escD(m.name)}</div>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${m.color},${m.color}88)"></div></div>
        <div class="mini-bar-val">${pct}%</div>
      </div>`;
  }).join('');
}

/* ───────────── historial ───────────── */
function anHace(iso){
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if(min < 1) return 'ahora';
  if(min < 60) return 'hace ' + min + ' min';
  const h = Math.floor(min / 60);
  if(h < 24) return 'hace ' + h + ' h';
  return 'hace ' + Math.floor(h / 24) + ' d';
}

function buildLog(d){
  const el = document.getElementById('attempt-log');
  if(!d.historial.length){
    el.innerHTML = '<p class="chart-empty">Sin actividad aún</p>';
    return;
  }
  el.innerHTML = d.historial.map(a => {
    const m = anModulo(a.modulo);
    const donde = a.nivel === 6 ? 'Boss Fight' : 'Nivel ' + a.nivel;
    const que = a.concepto ? escD(a.concepto) : escD(m.name) + ' · ' + donde;
    return `
      <div class="log-row">
        <div class="log-dot ${a.correcta ? 'ok' : 'err'}"></div>
        <div class="log-info"><b>${escD(a.alumno)}</b> · ${que}</div>
        <div class="log-time">${anHace(a.fecha)}</div>
      </div>`;
  }).join('');
}

/* ───────────── exportar ───────────── */
function showExportInfo(){
  document.getElementById('export-panel').classList.toggle('show');
}

// Descarga el CSV que arma el servidor (solo de las secciones del docente).
async function downloadCSV(){
  const sel = document.getElementById('section-select');
  const q = sel.value ? '?seccion_id=' + encodeURIComponent(sel.value) : '';
  try{
    const resp = await fetch(API_URL + '/docente/exportar' + q, {
      headers: { Authorization: 'Bearer ' + getToken() },
    });
    if(!resp.ok) throw new Error('No se pudo generar el archivo.');
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'codeflow_dataset.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Dataset descargado: codeflow_dataset.csv', 2800);
  }catch(e){
    showToast(e.message || 'No se pudo descargar el dataset.', 3000);
  }
}