/* ══════════════════════════════════════════════════════════
   docente.js — vistas del docente: "Alumnos" y "Top 5"
   Los datos vienen del backend (/docente/...), que además
   comprueba que las secciones sean realmente del docente.
   Se carga ANTES de auth.js (usa authFetch y mensajeError).
   ══════════════════════════════════════════════════════════ */

// Texto que viene de la base → siempre escapado antes de usar innerHTML.
function escD(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

let DOC_SECCIONES = null;      // secciones del docente (se piden una vez por sesión)

async function docLeerSecciones(){
  if(DOC_SECCIONES) return DOC_SECCIONES;
  const res = await authFetch('/docente/secciones');
  if(!res.ok) throw new Error(mensajeError(res));
  DOC_SECCIONES = res.datos;
  return DOC_SECCIONES;
}

// Rellena el <select> de sección conservando lo que estaba elegido.
function docPintarSelector(sel, secciones){
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todas mis secciones</option>' +
    secciones.map(s =>
      `<option value="${s.id}">Sección ${escD(s.nombre)} · ${s.alumnos} alumno${s.alumnos === 1 ? '' : 's'}</option>`
    ).join('');
  if([...sel.options].some(o => o.value === actual)) sel.value = actual;
}

function docEstado(cont, texto){
  cont.innerHTML = `<div class="doc-estado">${escD(texto)}</div>`;
}

function docUltima(iso){
  if(!iso) return 'Sin actividad';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if(dias <= 0) return 'Hoy';
  if(dias === 1) return 'Ayer';
  return 'Hace ' + dias + ' días';
}

// Barra partida: verde = aciertos, rojo = fallos
function docBarraAciertos(a){
  if(a.aciertos == null) return '<span class="doc-muted">Sin respuestas</span>';
  return `
    <div class="doc-split" title="${a.aciertos}% aciertos · ${a.fallos}% fallos">
      <span class="doc-split-ok"  style="width:${a.aciertos}%"></span>
      <span class="doc-split-bad" style="width:${a.fallos}%"></span>
    </div>
    <div class="doc-split-txt"><b class="doc-ok">${a.aciertos}%</b> aciertos · <b class="doc-bad">${a.fallos}%</b> fallos</div>`;
}

/* ───────────── ALUMNOS ───────────── */
async function cargarAlumnos(){
  const sel = document.getElementById('alumnos-seccion');
  const cont = document.getElementById('alumnos-contenido');
  docEstado(cont, 'Cargando…');
  try{
    const secciones = await docLeerSecciones();
    docPintarSelector(sel, secciones);
    if(!secciones.length){
      docEstado(cont, 'Aún no tienes secciones asignadas.');
      return;
    }
    const q = sel.value ? '?seccion_id=' + encodeURIComponent(sel.value) : '';
    const res = await authFetch('/docente/alumnos' + q);
    if(!res.ok) throw new Error(mensajeError(res));
    const lista = res.datos;

    document.getElementById('alumnos-total').textContent =
      lista.length + (lista.length === 1 ? ' alumno' : ' alumnos');

    if(!lista.length){
      docEstado(cont, 'Todavía no hay alumnos registrados en esta sección.');
      return;
    }
    cont.innerHTML = `
      <div class="doc-tabla-wrap"><table class="doc-tabla">
        <thead><tr>
          <th>Alumno</th><th>Sección</th><th>Progreso</th>
          <th>Aciertos / fallos</th><th>XP</th><th>Última actividad</th>
        </tr></thead>
        <tbody>${lista.map(a => `
          <tr>
            <td><div class="doc-nombre">${escD(a.nombre)}</div><div class="doc-correo">${escD(a.correo)}</div></td>
            <td>${escD(a.seccion)}</td>
            <td>
              <div class="doc-prog"><span style="width:${a.progreso}%"></span></div>
              <div class="doc-prog-txt"><b>${a.progreso}%</b> · ${a.niveles_hechos}/${a.niveles_totales} niveles</div>
            </td>
            <td>${docBarraAciertos(a)}</td>
            <td>${a.xp}</td>
            <td>${docUltima(a.ultima_actividad)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }catch(e){
    docEstado(cont, e.message || 'No se pudo cargar.');
  }
}

/* ───────────── TOP 5 ───────────── */
async function cargarTop5(){
  const sel = document.getElementById('top-seccion');
  const cont = document.getElementById('top-contenido');
  docEstado(cont, 'Cargando…');
  try{
    const secciones = await docLeerSecciones();
    docPintarSelector(sel, secciones);
    if(!secciones.length){
      docEstado(cont, 'Aún no tienes secciones asignadas.');
      return;
    }
    const q = sel.value ? '?seccion_id=' + encodeURIComponent(sel.value) : '';
    const res = await authFetch('/docente/top' + q);
    if(!res.ok) throw new Error(mensajeError(res));
    const { minimo_respuestas, alumnos } = res.datos;

    if(!alumnos.length){
      docEstado(cont, `Aún no hay alumnos con al menos ${minimo_respuestas} respuestas.`);
      return;
    }
    cont.innerHTML = `
      <ol class="doc-top">${alumnos.map(a => `
        <li class="doc-top-item doc-top-${a.puesto}">
          <div class="doc-top-puesto">${a.puesto}</div>
          <div class="doc-top-info">
            <div class="doc-nombre">${escD(a.nombre)}</div>
            <div class="doc-correo">Sección ${escD(a.seccion)} · ${a.respuestas} respuestas · ${a.progreso}% de progreso</div>
          </div>
          <div class="doc-top-barra">${docBarraAciertos(a)}</div>
        </li>`).join('')}
      </ol>
      <p class="doc-nota">Ranking por % de aciertos. Entran alumnos con al menos ${minimo_respuestas} respuestas.</p>`;
  }catch(e){
    docEstado(cont, e.message || 'No se pudo cargar.');
  }
}
