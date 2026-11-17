/* ══════════════════════════════════════════════════════════
   AUTH — login, registro y sesión
   Requiere index.js cargado antes (usa S y showToast).
   Se carga AL FINAL, después de analitica_docente.js.

   IMPORTANTE: esta pantalla controla lo que SE VE. La seguridad real
   (quién es docente, quién puede pedir qué) la decide el backend.
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   1. CONFIGURACIÓN Y SESIÓN
   ══════════════════════════════════════════════════════════ */
const API_URL = 'http://127.0.0.1:8000';
const TOKEN_KEY = 'codeflow_token';

// El token vive en sessionStorage: se borra al cerrar la pestaña.
// (Pensado para computadores compartidos, como los laboratorios.)
function getToken(){
  try { return sessionStorage.getItem(TOKEN_KEY); } catch(e){ return null; }
}
function setToken(t){
  try { sessionStorage.setItem(TOKEN_KEY, t); } catch(e){}
}
function clearToken(){
  try { sessionStorage.removeItem(TOKEN_KEY); } catch(e){}
}

// Llama al backend. Siempre devuelve { ok, status, datos }.
// status 0 = no se pudo conectar con el servidor.
async function pedir(ruta, opciones = {}){
  try {
    const resp = await fetch(API_URL + ruta, opciones);
    let datos = null;
    try { datos = await resp.json(); } catch(e){}
    return { ok: resp.ok, status: resp.status, datos };
  } catch(e){
    return { ok: false, status: 0, datos: null };
  }
}

// Igual que pedir(), pero con el token de la sesión. Si el servidor dice
// que la sesión ya no es válida (401), cierra la sesión sola.
// Lo usarán las secciones cuando guarden progreso en el backend.
async function authFetch(ruta, opciones = {}){
  const headers = { ...(opciones.headers || {}), Authorization: 'Bearer ' + getToken() };
  const res = await pedir(ruta, { ...opciones, headers });
  if(res.status === 401) cerrarSesion();
  return res;
}

// Convierte la respuesta del servidor en un mensaje para la persona.
function mensajeError(res){
  if(res.status === 0) return 'No se pudo conectar con el servidor. Revisa que esté encendido.';
  const detalle = res.datos && res.datos.detail;
  if(typeof detalle === 'string') return detalle;
  if(res.status === 422) return 'Revisa los datos ingresados.';
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}

/* ══════════════════════════════════════════════════════════
   2. REFERENCIAS AL HTML
   ══════════════════════════════════════════════════════════ */
const authScreen   = document.getElementById('auth-screen');
const tabLogin     = document.getElementById('tab-login');
const tabRegistro  = document.getElementById('tab-registro');
const panelLogin   = document.getElementById('panel-login');
const panelRegistro= document.getElementById('panel-registro');
const loginError   = document.getElementById('login-error');
const regError     = document.getElementById('reg-error');
const modalTerminos= document.getElementById('terminos-modal');

/* ══════════════════════════════════════════════════════════
   3. PESTAÑAS (Ingresar / Registrarme)
   ══════════════════════════════════════════════════════════ */
function mostrarPestana(cual){
  const esLogin = cual === 'login';
  tabLogin.classList.toggle('active', esLogin);
  tabRegistro.classList.toggle('active', !esLogin);
  tabLogin.setAttribute('aria-selected', esLogin);
  tabRegistro.setAttribute('aria-selected', !esLogin);
  panelLogin.hidden = !esLogin;
  panelRegistro.hidden = esLogin;
  limpiarErrores();
  if(!esLogin) cargarSecciones();
}

function mostrarError(el, texto){
  el.textContent = texto;
}
function limpiarErrores(){
  loginError.textContent = '';
  regError.textContent = '';
}

tabLogin.addEventListener('click', () => mostrarPestana('login'));
tabRegistro.addEventListener('click', () => mostrarPestana('registro'));

/* ══════════════════════════════════════════════════════════
   4. VER / OCULTAR CONTRASEÑA
   ══════════════════════════════════════════════════════════ */
document.querySelectorAll('.auth-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    btn.setAttribute('aria-pressed', mostrar);
    btn.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
    btn.firstElementChild.textContent = mostrar ? 'visibility_off' : 'visibility';
  });
});

/* ══════════════════════════════════════════════════════════
   5. MODAL DE TÉRMINOS Y CONDICIONES
   ══════════════════════════════════════════════════════════ */
function abrirTerminos(){
  modalTerminos.hidden = false;
  document.getElementById('close-terminos').focus();
}
function cerrarTerminos(){
  modalTerminos.hidden = true;
  document.getElementById('open-terminos').focus();
}

document.getElementById('open-terminos').addEventListener('click', abrirTerminos);
document.getElementById('close-terminos').addEventListener('click', cerrarTerminos);
// Clic en el fondo oscuro (fuera de la caja) también cierra
modalTerminos.addEventListener('click', e => {
  if(e.target === modalTerminos) cerrarTerminos();
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !modalTerminos.hidden) cerrarTerminos();
});

/* ══════════════════════════════════════════════════════════
   6. SECCIONES (el desplegable del registro viene del backend)
   ══════════════════════════════════════════════════════════ */
let seccionesCargadas = false;

async function cargarSecciones(){
  if(seccionesCargadas) return;
  const res = await pedir('/auth/secciones');
  if(!res.ok || !Array.isArray(res.datos)){
    mostrarError(regError, 'No se pudieron cargar las secciones. ' + mensajeError(res));
    return;
  }
  const select = document.getElementById('reg-seccion');
  res.datos.forEach(s => {
    const op = document.createElement('option');
    op.value = s.id;
    op.textContent = 'Sección ' + s.nombre;
    select.appendChild(op);
  });
  seccionesCargadas = true;
}

// Solo los estudiantes (@duocuc.cl) eligen sección. Si el correo es de
// otro dominio, se esconde el desplegable (el servidor igual decide el rol).
document.getElementById('reg-correo').addEventListener('change', e => {
  const correo = e.target.value.trim().toLowerCase();
  const esOtroDominio = correo.includes('@') && !correo.endsWith('@duocuc.cl');
  document.getElementById('reg-seccion-wrap').hidden = esOtroDominio;
});

/* ── Avisos en vivo de la contraseña (registro) ── */
const MIN_CLAVE = 8;
const regClave   = document.getElementById('reg-clave');
const regClave2  = document.getElementById('reg-clave2');
const claveMeter = document.getElementById('reg-clave-meter');
const claveAviso = document.getElementById('reg-clave-aviso');
const clave2Aviso= document.getElementById('reg-clave2-aviso');

function ponerEstado(el, estado, texto){
  el.dataset.estado = estado;
  if(texto !== undefined) el.textContent = texto;
}

function actualizarAvisosClave(){
  const largo = regClave.value.length;

  // 1) Largo mínimo
  if(largo === 0){
    ponerEstado(claveMeter, 'vacio');
    ponerEstado(claveAviso, 'vacio', '');
    ponerEstado(regClave, 'vacio');
  } else if(largo < MIN_CLAVE){
    ponerEstado(claveMeter, 'mala');
    ponerEstado(claveAviso, 'mala', `Muy corta: faltan ${MIN_CLAVE - largo} caracteres (mínimo ${MIN_CLAVE}).`);
    ponerEstado(regClave, 'mala');
  } else {
    ponerEstado(claveMeter, 'buena');
    ponerEstado(claveAviso, 'buena', 'Contraseña válida ✓');
    ponerEstado(regClave, 'buena');
  }
  claveMeter.style.setProperty('--progreso', Math.min(largo / MIN_CLAVE, 1));

  // 2) Coincidencia con la confirmación
  if(regClave2.value.length === 0){
    ponerEstado(clave2Aviso, 'vacio', '');
    ponerEstado(regClave2, 'vacio');
  } else if(regClave2.value === regClave.value){
    ponerEstado(clave2Aviso, 'buena', 'Las contraseñas coinciden ✓');
    ponerEstado(regClave2, 'buena');
  } else {
    ponerEstado(clave2Aviso, 'mala', 'Las contraseñas no coinciden.');
    ponerEstado(regClave2, 'mala');
  }
}

regClave.addEventListener('input', actualizarAvisosClave);
regClave2.addEventListener('input', actualizarAvisosClave);

/* ══════════════════════════════════════════════════════════
   7. INICIAR SESIÓN
   ══════════════════════════════════════════════════════════ */
// Pide el token, lo guarda y entra a la app. Devuelve true si funcionó.
async function iniciarSesion(correo, contrasena, errorEl){
  const res = await pedir('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, contrasena }),
  });
  if(!res.ok){
    mostrarError(errorEl, mensajeError(res));
    return false;
  }
  setToken(res.datos.token);
  entrar(res.datos.usuario);
  return true;
}

panelLogin.addEventListener('submit', async e => {
  e.preventDefault();
  limpiarErrores();
  const correo = document.getElementById('login-correo').value.trim().toLowerCase();
  const clave  = document.getElementById('login-clave').value;
  if(!correo || !clave){
    mostrarError(loginError, 'Escribe tu correo y tu contraseña.');
    return;
  }
  const boton = panelLogin.querySelector('.auth-submit');
  boton.disabled = true;
  await iniciarSesion(correo, clave, loginError);
  boton.disabled = false;
});

/* ══════════════════════════════════════════════════════════
   8. REGISTRO
   ══════════════════════════════════════════════════════════ */
// Revisa el formulario ANTES de molestar al servidor.
// Devuelve un mensaje de error, o null si todo está bien.
function validarRegistro(d){
  if(d.nombre.length < 2) return 'Escribe tu nombre completo.';
  if(!document.getElementById('reg-correo').checkValidity()) return 'Escribe un correo válido.';
  if(d.contrasena.length < MIN_CLAVE) return 'La contraseña debe tener al menos 8 caracteres.';
  if(d.contrasena !== d.confirmacion) return 'Las contraseñas no coinciden.';
  if(d.esEstudiante && !d.seccion_id) return 'Selecciona tu sección.';
  if(!document.getElementById('reg-terminos').checked) return 'Debes aceptar los términos y condiciones.';
  return null;
}

panelRegistro.addEventListener('submit', async e => {
  e.preventDefault();
  limpiarErrores();

  const correo = document.getElementById('reg-correo').value.trim().toLowerCase();
  const seccionValor = document.getElementById('reg-seccion').value;
  const datos = {
    nombre: document.getElementById('reg-nombre').value.trim(),
    correo,
    contrasena: document.getElementById('reg-clave').value,
    confirmacion: document.getElementById('reg-clave2').value,
    esEstudiante: correo.endsWith('@duocuc.cl'),
    seccion_id: seccionValor ? Number(seccionValor) : null,
  };

  const error = validarRegistro(datos);
  if(error){
    mostrarError(regError, error);
    return;
  }

  const boton = panelRegistro.querySelector('.auth-submit');
  boton.disabled = true;

  const res = await pedir('/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: datos.nombre,
      correo: datos.correo,
      contrasena: datos.contrasena,
      seccion_id: datos.esEstudiante ? datos.seccion_id : null,
      acepta_terminos: true,
    }),
  });

  if(!res.ok){
    mostrarError(regError, mensajeError(res));
    boton.disabled = false;
    return;
  }

  // Cuenta creada: entramos directo, sin pedirle que haga login de nuevo.
  await iniciarSesion(datos.correo, datos.contrasena, regError);
  boton.disabled = false;
});

/* ══════════════════════════════════════════════════════════
   9. ENTRAR A LA APP / CERRAR SESIÓN
   ══════════════════════════════════════════════════════════ */
function entrar(usuario){
  S.usuario = usuario;                  // quién es, disponible para todas las secciones
  authScreen.hidden = true;

  document.getElementById('user-name').textContent = usuario.nombre;
  document.getElementById('user-role').textContent =
    usuario.rol === 'docente' ? 'Docente' : 'Estudiante';

  // Elementos marcados con data-solo-rol="docente" solo los ve ese rol.
  // (Esto es comodidad visual; el servidor es quien realmente protege.)
  document.querySelectorAll('[data-solo-rol]').forEach(el => {
    el.hidden = el.dataset.soloRol !== usuario.rol;
  });

  // El docente ve SOLO su menú: los ítems sin data-solo-rol (juegos, hub,
  // glosario...) y el bloque de XP se ocultan. Lo que importa de verdad
  // lo protege el servidor; esto es para que el menú sea limpio.
  const esDocente = usuario.rol === 'docente';
  document.querySelectorAll('.nav-item, .nav-section').forEach(el => {
    if(!el.dataset.soloRol) el.hidden = esDocente;
  });
  const xpBloque = document.querySelector('.xp-sidebar-wrap');
  if(xpBloque) xpBloque.hidden = esDocente;
  if(esDocente){
    const inicio = document.querySelector('.nav-item[data-view="view-analytics"]');
    if(inicio) navTo(inicio);          // su pantalla de inicio
  }

  // Limpia los formularios para que no quede la clave escrita
  panelLogin.reset();
  panelRegistro.reset();
  actualizarAvisosClave();

  // Trae del servidor el progreso guardado (XP, estrellas, jefes vencidos)
  if(typeof cargarProgresoServidor === 'function') cargarProgresoServidor();

  // Trae las preferencias de accesibilidad guardadas en la cuenta
  if(typeof cargarAccesibilidad === 'function') cargarAccesibilidad();

  showToast('Hola, ' + usuario.nombre.split(' ')[0]);
}

// Borra la sesión y recarga la página: así no queda nada del usuario
// anterior (XP, progreso) en memoria para quien entre después.
function cerrarSesion(){
  clearToken();
  location.reload();
}

document.getElementById('logout-btn').addEventListener('click', cerrarSesion);

/* ══════════════════════════════════════════════════════════
   10. INICIALIZACIÓN
   Si ya había una sesión en esta pestaña, la validamos con el servidor.
   Mientras tanto la pantalla de acceso sigue visible (no se filtra nada).
   ══════════════════════════════════════════════════════════ */
(async function iniciarAuth(){
  const token = getToken();
  if(!token) return;

  const res = await pedir('/auth/yo', { headers: { Authorization: 'Bearer ' + token } });
  if(res.ok){
    entrar(res.datos);
  } else if(res.status === 401){
    clearToken();                      // token vencido o inválido
  } else {
    mostrarError(loginError, mensajeError(res));
  }
})();