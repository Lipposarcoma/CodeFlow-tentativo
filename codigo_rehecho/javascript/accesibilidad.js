/* ══════════════════════════════════════════════════════════
   ACCESIBILIDAD — panel de preferencias (estudiantes y docentes)

   Opciones: tamaño de texto, tamaño de botones, fuente, espaciado,
   paleta de color (original, alto contraste, cálido, daltonismo y
   configuración propia), reducir animaciones y resaltar el foco.

   Guardado:
   - En el equipo (localStorage) para que se vea al instante, incluso en
     la pantalla de acceso.
   - En la cuenta (POST /accesibilidad) para que siga a la persona a
     cualquier computador. Al iniciar sesión manda la de la cuenta.

   Requiere accesibilidad.css. Usa authFetch, getToken y S de auth.js e
   index.js, pero solo cuando ya hay sesión.
   ══════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ══════════════════════════════════════════════════════════
   1. VALORES Y LÍMITES
   ══════════════════════════════════════════════════════════ */
const LS_KEY = 'codeflow_a11y';
const TEXTO_MIN = 80,  TEXTO_MAX = 160,  TEXTO_PASO = 5;
const BOTON_MIN = 100, BOTON_MAX = 150,  BOTON_PASO = 5;

const FUENTES   = ['defecto', 'legible', 'dislexia'];
const ESPACIADOS= ['normal', 'amplio', 'muy_amplio'];
const PALETAS   = ['original', 'alto', 'calido', 'daltonismo', 'propia'];

// Las fuentes especiales se descargan solo si se usan.
const FUENTE_CSS = {
  legible:  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
  dislexia: 'https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5/index.css'
};

const COLORES_PROPIOS = {
  oscuro: { fondo: '#0F1016', texto: '#EEEEF5', acento: '#4F8EF7' },
  claro:  { fondo: '#F4F5FB', texto: '#111218', acento: '#2F6DB5' }
};

function porDefecto(){
  let sinMov = false;
  try { sinMov = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}
  return {
    texto: 100, botones: 100,
    fuente: 'defecto', espaciado: 'normal', paleta: 'original',
    propia: { ...COLORES_PROPIOS.oscuro },
    sin_movimiento: sinMov, foco: false
  };
}

/* ══════════════════════════════════════════════════════════
   2. UTILIDADES (validación y color)
   ══════════════════════════════════════════════════════════ */
const esHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const acotar = (n, min, max, paso, def) => {
  n = Number(n);
  if(!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n / paso) * paso));
};

// Acepta cualquier cosa (caché, servidor) y devuelve una configuración válida.
function limpiar(c){
  const d = porDefecto();
  if(!c || typeof c !== 'object') return d;
  const p = c.propia && typeof c.propia === 'object' ? c.propia : {};
  return {
    texto:    acotar(c.texto,    TEXTO_MIN, TEXTO_MAX, TEXTO_PASO, d.texto),
    botones:  acotar(c.botones,  BOTON_MIN, BOTON_MAX, BOTON_PASO, d.botones),
    fuente:   FUENTES.includes(c.fuente) ? c.fuente : d.fuente,
    espaciado:ESPACIADOS.includes(c.espaciado) ? c.espaciado : d.espaciado,
    paleta:   PALETAS.includes(c.paleta) ? c.paleta : d.paleta,
    propia: {
      fondo:  esHex(p.fondo)  ? p.fondo  : d.propia.fondo,
      texto:  esHex(p.texto)  ? p.texto  : d.propia.texto,
      acento: esHex(p.acento) ? p.acento : d.propia.acento
    },
    sin_movimiento: typeof c.sin_movimiento === 'boolean' ? c.sin_movimiento : d.sin_movimiento,
    foco: typeof c.foco === 'boolean' ? c.foco : d.foco
  };
}

const aRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const aHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const mezclar = (a, b, t) => {                 // t = cuánto de b
  const x = aRgb(a), y = aRgb(b);
  return aHex(x.map((v, i) => v + (y[i] - v) * t));
};
const rgba = (hex, a) => 'rgba(' + aRgb(hex).join(',') + ',' + a + ')';
const luminancia = hex => {
  const [r, g, b] = aRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* ══════════════════════════════════════════════════════════
   3. ESTADO Y CACHÉ LOCAL
   uid = de qué usuario es la configuración que hay en este equipo
   (null = se cambió antes de iniciar sesión).
   ══════════════════════════════════════════════════════════ */
let cfg = porDefecto();
let uid = null;

try {
  const guardado = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  if(guardado && guardado.cfg){
    cfg = limpiar(guardado.cfg);
    uid = guardado.uid == null ? null : guardado.uid;
  }
} catch(e){}

function guardarCache(){
  try { localStorage.setItem(LS_KEY, JSON.stringify({ uid, cfg })); } catch(e){}
}

const hayCambios = () => JSON.stringify(cfg) !== JSON.stringify(porDefecto());
const haySesion = () => {
  try { return typeof getToken === 'function' && !!getToken() && typeof S !== 'undefined' && !!S.usuario; }
  catch(e){ return false; }
};

/* ══════════════════════════════════════════════════════════
   4. APLICAR LA CONFIGURACIÓN AL SITIO
   ══════════════════════════════════════════════════════════ */
const raiz = document.documentElement;
const CLAVES_PROPIAS = ['--bg','--surface','--surface2','--surface3','--border','--border-h',
  '--text','--text2','--muted','--muted2','--shadow','--mod1','--g1'];
let temaPrevio = null;          // tema claro/oscuro que había antes de que una paleta lo fijara

function cargarFuente(clave){
  const url = FUENTE_CSS[clave];
  if(!url || document.querySelector('link[data-a11y-fuente="' + clave + '"]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = url;
  l.setAttribute('data-a11y-fuente', clave);
  document.head.appendChild(l);
}

function atributo(nombre, valor){
  if(valor == null) raiz.removeAttribute(nombre);
  else raiz.setAttribute(nombre, valor);
}

function coloresPropios(p){
  const f = p.fondo, t = p.texto, a = p.acento;
  const oscuro = luminancia(f) < 0.4;
  return {
    '--bg': f,
    '--surface': mezclar(f, t, 0.05),
    '--surface2': mezclar(f, t, 0.09),
    '--surface3': mezclar(f, t, 0.14),
    '--border': rgba(t, 0.18),
    '--border-h': rgba(t, 0.36),
    '--text': t,
    '--text2': mezclar(t, f, 0.18),
    '--muted': mezclar(t, f, 0.42),
    '--muted2': mezclar(t, f, 0.68),
    '--shadow': oscuro ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.15)',
    '--mod1': a,
    '--g1': rgba(a, 0.18)
  };
}

// Las paletas con fondo propio fijan el tema base (claro u oscuro) para
// que las reglas que dependen de data-theme no choquen con los colores.
function fijarTema(){
  let forzado = null;
  if(cfg.paleta === 'alto') forzado = 'dark';
  else if(cfg.paleta === 'calido') forzado = 'light';
  else if(cfg.paleta === 'propia') forzado = luminancia(cfg.propia.fondo) < 0.4 ? 'dark' : 'light';

  if(forzado){
    if(temaPrevio === null) temaPrevio = raiz.getAttribute('data-theme') || 'dark';
    raiz.setAttribute('data-theme', forzado);
  } else if(temaPrevio !== null){
    raiz.setAttribute('data-theme', temaPrevio);
    temaPrevio = null;
  }

  const boton = document.getElementById('theme-toggle');
  if(boton){
    if(forzado){
      boton.setAttribute('aria-disabled', 'true');
      boton.title = 'La paleta elegida define el tema. Cámbiala en Accesibilidad.';
    } else {
      boton.removeAttribute('aria-disabled');
      boton.title = 'Cambiar tema';
    }
  }
}

function aplicar(){
  raiz.style.setProperty('--a11y-fs', (cfg.texto / 100).toString());
  raiz.style.setProperty('--a11y-btn', (cfg.botones / 100).toString());
  atributo('data-a11y-btn', cfg.botones > 100 ? 'on' : null);

  if(cfg.fuente !== 'defecto') cargarFuente(cfg.fuente);
  atributo('data-a11y-fuente', cfg.fuente === 'defecto' ? null : cfg.fuente);
  atributo('data-a11y-esp', cfg.espaciado === 'normal' ? null : cfg.espaciado);
  atributo('data-a11y-paleta', cfg.paleta === 'original' ? null : cfg.paleta);
  atributo('data-a11y-mov', cfg.sin_movimiento ? 'off' : null);
  atributo('data-a11y-foco', cfg.foco ? 'on' : null);

  CLAVES_PROPIAS.forEach(k => raiz.style.removeProperty(k));
  if(cfg.paleta === 'propia'){
    const tokens = coloresPropios(cfg.propia);
    Object.keys(tokens).forEach(k => raiz.style.setProperty(k, tokens[k]));
  }
  fijarTema();
}

// Si una paleta fija el tema, el botón de tema claro/oscuro no hace nada
// (se corta el clic antes de que llegue a toggleTheme).
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#theme-toggle');
  if(b && b.getAttribute('aria-disabled') === 'true'){
    e.stopPropagation();
    e.preventDefault();
    if(typeof showToast === 'function')
      showToast('El tema lo define la paleta de colores. Cámbiala en Accesibilidad.', 2600);
  }
}, true);

/* ══════════════════════════════════════════════════════════
   5. GUARDAR EN LA CUENTA
   ══════════════════════════════════════════════════════════ */
let temporizador = null;
let panel = null;

function avisar(texto){
  const el = panel && panel.querySelector('#a11y-estado');
  if(el) el.textContent = texto;
}

async function enviarAlServidor(){
  if(!haySesion()) return;
  const res = await authFetch('/accesibilidad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg)
  });
  if(res.ok) avisar('Guardado en tu cuenta.');
  else avisar('No se pudo guardar en tu cuenta. Quedó guardado en este equipo.');
}

function guardar(){
  guardarCache();
  if(haySesion()){
    uid = S.usuario.id;
    guardarCache();
    avisar('Guardando…');
    clearTimeout(temporizador);
    temporizador = setTimeout(enviarAlServidor, 700);
  } else {
    avisar('Guardado en este equipo. Se asociará a tu cuenta al iniciar sesión.');
  }
}

// auth.js la llama al entrar. Decide qué configuración manda.
window.cargarAccesibilidad = async function(){
  if(!haySesion()) return;
  const miId = S.usuario.id;
  const res = await authFetch('/accesibilidad');
  if(!res.ok) return;                                  // sin conexión: se queda lo local

  const delServidor = res.datos && res.datos.config;
  if(delServidor){
    cfg = limpiar(delServidor);                         // la de la cuenta manda
    uid = miId;
    guardarCache();
    aplicar();
  } else if(uid === null || uid === miId){
    uid = miId;                                         // lo hecho antes de entrar pasa a la cuenta
    guardarCache();
    if(hayCambios()) enviarAlServidor();
  } else {
    cfg = porDefecto();                                 // era de otra persona en este equipo
    uid = miId;
    guardarCache();
    aplicar();
  }
  sincronizarPanel();
  actualizarBotones();
};

/* ══════════════════════════════════════════════════════════
   6. PANEL (HTML)
   ══════════════════════════════════════════════════════════ */
const ICONO = n => '<span class="material-icons" aria-hidden="true">' + n + '</span>';

function tarjetaRadio(nombre, valor, titulo, detalle, extra){
  return '<label class="a11y-card' + (extra && extra.clase ? ' ' + extra.clase : '') + '">' +
    '<input type="radio" name="' + nombre + '" value="' + valor + '">' +
    (extra && extra.antes ? extra.antes : '') +
    '<span>' + titulo + (detalle ? '<br><small>' + detalle + '</small>' : '') + '</span>' +
    ICONO('check').replace('class="material-icons"', 'class="material-icons a11y-check"') +
    '</label>';
}

const muestras = (a, b, c) =>
  '<span class="a11y-muestras" aria-hidden="true">' +
  [a, b, c].map(x => '<i style="background:' + x + '"></i>').join('') + '</span>';

function construirPanel(){
  const el = document.createElement('div');
  el.className = 'a11y-panel';
  el.id = 'a11y-panel';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'a11y-titulo');

  el.innerHTML =
    '<div class="a11y-head">' + ICONO('accessibility_new') +
      '<h2 class="a11y-title" id="a11y-titulo">Accesibilidad</h2>' +
      '<button type="button" class="a11y-close" id="a11y-cerrar" aria-label="Cerrar accesibilidad">' + ICONO('close') + '</button>' +
    '</div>' +

    // Texto
    '<div class="a11y-sec">' +
      '<div class="a11y-sec-top"><label class="a11y-label" for="a11y-texto">Tamaño del texto</label>' +
      '<span class="a11y-valor" id="a11y-texto-v" aria-hidden="true"></span></div>' +
      '<p class="a11y-desc">Letras más grandes o más pequeñas.</p>' +
      '<div class="a11y-slider-fila">' +
        '<button type="button" class="a11y-paso" id="a11y-texto-menos" aria-label="Texto más pequeño">A−</button>' +
        '<input class="a11y-slider" id="a11y-texto" type="range" min="' + TEXTO_MIN + '" max="' + TEXTO_MAX + '" step="' + TEXTO_PASO + '">' +
        '<button type="button" class="a11y-paso" id="a11y-texto-mas" aria-label="Texto más grande">A+</button>' +
      '</div>' +
    '</div>' +

    // Botones
    '<div class="a11y-sec">' +
      '<div class="a11y-sec-top"><label class="a11y-label" for="a11y-botones">Tamaño de los botones</label>' +
      '<span class="a11y-valor" id="a11y-botones-v" aria-hidden="true"></span></div>' +
      '<p class="a11y-desc">Botones y controles más fáciles de tocar.</p>' +
      '<div class="a11y-slider-fila">' +
        '<button type="button" class="a11y-paso" id="a11y-botones-menos" aria-label="Botones más pequeños">−</button>' +
        '<input class="a11y-slider" id="a11y-botones" type="range" min="' + BOTON_MIN + '" max="' + BOTON_MAX + '" step="' + BOTON_PASO + '">' +
        '<button type="button" class="a11y-paso" id="a11y-botones-mas" aria-label="Botones más grandes">+</button>' +
      '</div>' +
    '</div>' +

    // Fuente
    '<div class="a11y-sec" role="radiogroup" aria-labelledby="a11y-fuente-t">' +
      '<div class="a11y-sec-top"><span class="a11y-label" id="a11y-fuente-t">Fuente</span></div>' +
      '<p class="a11y-desc">Cambia el tipo de letra de todo el sitio.</p>' +
      '<div class="a11y-grid una-col">' +
        tarjetaRadio('a11y-fuente', 'defecto', 'Predeterminada', 'La del sitio', { clase: 'fila', antes: '<span class="a11y-aa" aria-hidden="true">Aa</span>' }) +
        tarjetaRadio('a11y-fuente', 'legible', 'Alta legibilidad', 'Atkinson Hyperlegible', { clase: 'fila', antes: '<span class="a11y-aa" aria-hidden="true" style="font-family:\'Atkinson Hyperlegible\',sans-serif">Aa</span>' }) +
        tarjetaRadio('a11y-fuente', 'dislexia', 'Para dislexia', 'OpenDyslexic', { clase: 'fila', antes: '<span class="a11y-aa" aria-hidden="true" style="font-family:\'OpenDyslexic\',sans-serif">Aa</span>' }) +
      '</div>' +
    '</div>' +

    // Espaciado
    '<div class="a11y-sec" role="radiogroup" aria-labelledby="a11y-esp-t">' +
      '<div class="a11y-sec-top"><span class="a11y-label" id="a11y-esp-t">Espaciado del texto</span></div>' +
      '<p class="a11y-desc">Más aire entre líneas, letras y palabras.</p>' +
      '<div class="a11y-grid tres">' +
        tarjetaRadio('a11y-esp', 'normal', 'Normal', '') +
        tarjetaRadio('a11y-esp', 'amplio', 'Amplio', '') +
        tarjetaRadio('a11y-esp', 'muy_amplio', 'Muy amplio', '') +
      '</div>' +
    '</div>' +

    // Paleta
    '<div class="a11y-sec" role="radiogroup" aria-labelledby="a11y-pal-t">' +
      '<div class="a11y-sec-top"><span class="a11y-label" id="a11y-pal-t">Colores del sitio</span></div>' +
      '<p class="a11y-desc">Elige una paleta.</p>' +
      '<div class="a11y-grid">' +
        tarjetaRadio('a11y-paleta', 'original', 'Original', '', { antes: muestras('#4F8EF7', '#A855F7', '#F97316') }) +
        tarjetaRadio('a11y-paleta', 'alto', 'Alto contraste', '', { antes: muestras('#000000', '#FFFFFF', '#FFE600') }) +
        tarjetaRadio('a11y-paleta', 'calido', 'Cálido', '', { antes: muestras('#F4EADB', '#B8530F', '#2F6DB5') }) +
        tarjetaRadio('a11y-paleta', 'daltonismo', 'Daltonismo', '', { antes: muestras('#0072B2', '#E69F00', '#CC79A7') }) +
        tarjetaRadio('a11y-paleta', 'propia', 'Configuración propia', 'Elige tus colores', { clase: 'ancha', antes: '<span id="a11y-muestras-propia"></span>' }) +
      '</div>' +
      '<div class="a11y-propia" id="a11y-propia" hidden>' +
        '<label class="a11y-color-fila" for="a11y-c-fondo">Fondo<input type="color" id="a11y-c-fondo"></label>' +
        '<label class="a11y-color-fila" for="a11y-c-texto">Texto<input type="color" id="a11y-c-texto"></label>' +
        '<label class="a11y-color-fila" for="a11y-c-acento">Acento<input type="color" id="a11y-c-acento"></label>' +
        '<div class="a11y-contraste" id="a11y-contraste" role="status" aria-live="polite"></div>' +
      '</div>' +
    '</div>' +

    // Interruptores
    '<div class="a11y-sec">' +
      '<label class="a11y-switch"><span class="a11y-switch-txt">Reducir animaciones<small>Quita movimientos, transiciones y el fondo animado.</small></span>' +
        '<input type="checkbox" role="switch" id="a11y-mov"></label>' +
      '<label class="a11y-switch"><span class="a11y-switch-txt">Resaltar el foco<small>Borde grueso al moverte con el teclado.</small></span>' +
        '<input type="checkbox" role="switch" id="a11y-foco"></label>' +
    '</div>' +

    '<div class="a11y-pie">' +
      '<p class="a11y-nota" id="a11y-nota"></p>' +
      '<button type="button" class="a11y-reset" id="a11y-reset">' + ICONO('restart_alt') + 'Restablecer todo</button>' +
      '<div class="a11y-estado" id="a11y-estado" role="status" aria-live="polite"></div>' +
    '</div>';

  document.body.appendChild(el);
  return el;
}

/* ══════════════════════════════════════════════════════════
   7. PANEL (comportamiento)
   ══════════════════════════════════════════════════════════ */
function marcar(nombre, valor){
  panel.querySelectorAll('input[name="' + nombre + '"]').forEach(i => { i.checked = i.value === valor; });
}

function pintarContraste(){
  const caja = panel.querySelector('#a11y-contraste');
  const rt = contraste(cfg.propia.texto, cfg.propia.fondo);
  const ra = contraste(cfg.propia.acento, cfg.propia.fondo);
  const num = rt.toFixed(1).replace('.', ',') + ':1';
  let txt, ok;
  if(rt >= 7){ txt = 'Contraste del texto excelente (' + num + ').'; ok = true; }
  else if(rt >= 4.5){ txt = 'Contraste del texto bueno (' + num + ').'; ok = true; }
  else { txt = 'Contraste del texto bajo (' + num + '). Se recomienda al menos 4,5:1 para leer bien.'; ok = false; }
  if(ra < 3){ txt += ' El acento se distingue poco del fondo.'; ok = false; }
  caja.className = 'a11y-contraste ' + (ok ? 'ok' : 'mal');
  caja.innerHTML = ICONO(ok ? 'check_circle' : 'warning') + '<span></span>';
  caja.querySelector('span:last-child').textContent = txt;
}

function actualizarBotones(){
  const menos = (id, v, min) => { const b = panel.querySelector(id); b.disabled = v <= min; };
  const mas = (id, v, max) => { const b = panel.querySelector(id); b.disabled = v >= max; };
  menos('#a11y-texto-menos', cfg.texto, TEXTO_MIN);
  mas('#a11y-texto-mas', cfg.texto, TEXTO_MAX);
  menos('#a11y-botones-menos', cfg.botones, BOTON_MIN);
  mas('#a11y-botones-mas', cfg.botones, BOTON_MAX);
}

function sincronizarPanel(){
  if(!panel) return;
  const t = panel.querySelector('#a11y-texto'), b = panel.querySelector('#a11y-botones');
  t.value = cfg.texto;  b.value = cfg.botones;
  t.setAttribute('aria-valuetext', cfg.texto + '%');
  b.setAttribute('aria-valuetext', cfg.botones + '%');
  panel.querySelector('#a11y-texto-v').textContent = cfg.texto + '%';
  panel.querySelector('#a11y-botones-v').textContent = cfg.botones + '%';

  marcar('a11y-fuente', cfg.fuente);
  marcar('a11y-esp', cfg.espaciado);
  marcar('a11y-paleta', cfg.paleta);

  panel.querySelector('#a11y-c-fondo').value = cfg.propia.fondo;
  panel.querySelector('#a11y-c-texto').value = cfg.propia.texto;
  panel.querySelector('#a11y-c-acento').value = cfg.propia.acento;
  panel.querySelector('#a11y-muestras-propia').outerHTML =
    '<span id="a11y-muestras-propia">' + muestras(cfg.propia.fondo, cfg.propia.texto, cfg.propia.acento) + '</span>';
  panel.querySelector('#a11y-propia').hidden = cfg.paleta !== 'propia';
  pintarContraste();

  panel.querySelector('#a11y-mov').checked = cfg.sin_movimiento;
  panel.querySelector('#a11y-foco').checked = cfg.foco;
  panel.querySelector('#a11y-nota').textContent = haySesion()
    ? 'Tu configuración se guarda en tu cuenta y te sigue a cualquier equipo.'
    : 'Inicia sesión y tu configuración se guardará en tu cuenta.';
  actualizarBotones();
}

function cambiar(cambios){
  cfg = limpiar({ ...cfg, ...cambios });
  aplicar();
  sincronizarPanel();
  guardar();
}

function enlazar(){
  const rango = (id, clave, paso, min, max) => {
    const el = panel.querySelector(id);
    el.addEventListener('input', () => cambiar({ [clave]: el.value }));
    panel.querySelector(id + '-menos').addEventListener('click', () => cambiar({ [clave]: Math.max(min, cfg[clave] - paso) }));
    panel.querySelector(id + '-mas').addEventListener('click', () => cambiar({ [clave]: Math.min(max, cfg[clave] + paso) }));
  };
  rango('#a11y-texto', 'texto', TEXTO_PASO, TEXTO_MIN, TEXTO_MAX);
  rango('#a11y-botones', 'botones', BOTON_PASO, BOTON_MIN, BOTON_MAX);

  panel.querySelectorAll('input[name="a11y-fuente"]').forEach(i =>
    i.addEventListener('change', () => cambiar({ fuente: i.value })));
  panel.querySelectorAll('input[name="a11y-esp"]').forEach(i =>
    i.addEventListener('change', () => cambiar({ espaciado: i.value })));
  panel.querySelectorAll('input[name="a11y-paleta"]').forEach(i =>
    i.addEventListener('change', () => {
      if(i.value === 'propia' && JSON.stringify(cfg.propia) === JSON.stringify(COLORES_PROPIOS.oscuro)){
        // primera vez: parte de los colores del tema que se está usando
        const claro = (temaPrevio || raiz.getAttribute('data-theme')) === 'light';
        cambiar({ paleta: 'propia', propia: { ...(claro ? COLORES_PROPIOS.claro : COLORES_PROPIOS.oscuro) } });
      } else cambiar({ paleta: i.value });
    }));

  ['fondo', 'texto', 'acento'].forEach(k => {
    panel.querySelector('#a11y-c-' + k).addEventListener('input', e =>
      cambiar({ paleta: 'propia', propia: { ...cfg.propia, [k]: e.target.value } }));
  });

  panel.querySelector('#a11y-mov').addEventListener('change', e => cambiar({ sin_movimiento: e.target.checked }));
  panel.querySelector('#a11y-foco').addEventListener('change', e => cambiar({ foco: e.target.checked }));

  panel.querySelector('#a11y-reset').addEventListener('click', () => {
    const d = porDefecto();
    cfg = d;
    aplicar();
    sincronizarPanel();
    guardar();
    avisar('Configuración restablecida.');
  });

  panel.querySelector('#a11y-cerrar').addEventListener('click', () => abrir(false));

  // Escape cierra; Tab se queda dentro del panel mientras está abierto
  panel.addEventListener('keydown', e => {
    if(e.key === 'Escape'){ e.stopPropagation(); abrir(false); return; }
    if(e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
      .filter(x => x.type === 'radio' ? x.checked || !panel.querySelector('input[name="' + x.name + '"]:checked') : true)
      .filter(x => x.offsetParent !== null || x === document.activeElement);
    if(!items.length) return;
    const primero = items[0], ultimo = items[items.length - 1];
    if(e.shiftKey && document.activeElement === primero){ e.preventDefault(); ultimo.focus(); }
    else if(!e.shiftKey && document.activeElement === ultimo){ e.preventDefault(); primero.focus(); }
  });
}

/* ══════════════════════════════════════════════════════════
   8. BOTONES QUE ABREN EL PANEL
   ══════════════════════════════════════════════════════════ */
let disparador = null;      // botón de la barra superior
let flotante = null;        // botón que se ve en la pantalla de acceso
let ultimoOrigen = null;

function abrir(mostrar){
  if(!panel) return;
  if(mostrar){
    ['legible', 'dislexia'].forEach(cargarFuente);        // para ver las muestras
    sincronizarPanel();
    panel.hidden = false;
    avisar('');
    const origen = document.activeElement;
    ultimoOrigen = origen && origen.classList && (origen.classList.contains('a11y-trigger') || origen.classList.contains('a11y-fab'))
      ? origen : (flotante && !flotante.hidden ? flotante : disparador);
    panel.querySelector('#a11y-texto').focus();
  } else {
    panel.hidden = true;
    if(ultimoOrigen && ultimoOrigen.getClientRects().length) ultimoOrigen.focus();
  }
  [disparador, flotante].forEach(b => b && b.setAttribute('aria-expanded', String(mostrar)));
}

function crearBoton(clase){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = clase;
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'a11y-panel');
  b.setAttribute('aria-label', 'Accesibilidad');
  b.title = 'Accesibilidad';
  b.innerHTML = ICONO('accessibility_new');
  b.addEventListener('click', () => abrir(panel.hidden));
  return b;
}

function sincronizarFlotante(){
  const auth = document.getElementById('auth-screen');
  if(flotante) flotante.hidden = !(auth && !auth.hidden);
}

/* ══════════════════════════════════════════════════════════
   9. ARRANQUE
   ══════════════════════════════════════════════════════════ */
function iniciar(){
  panel = construirPanel();
  enlazar();

  const acciones = document.querySelector('.topbar-actions');
  disparador = crearBoton('theme-toggle a11y-trigger');
  if(acciones) acciones.insertBefore(disparador, acciones.firstChild);

  flotante = crearBoton('a11y-fab');
  document.body.appendChild(flotante);
  const auth = document.getElementById('auth-screen');
  if(auth) new MutationObserver(sincronizarFlotante).observe(auth, { attributes: true, attributeFilter: ['hidden'] });
  sincronizarFlotante();

  sincronizarPanel();
  aplicar();
}

// Aplica la configuración guardada en el equipo lo antes posible,
// y arma el panel cuando ya existe el HTML.
aplicar();
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
else iniciar();

})();
