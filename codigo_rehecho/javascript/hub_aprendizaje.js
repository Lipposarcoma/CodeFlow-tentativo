/* ══════════════════════════════════════════════════════════
   HUB DE APRENDIZAJE — JS específico de esta sección
   Requiere que index.js ya esté cargado antes que este archivo
   (usa y extiende S, y usa showView()/navTo()/showToast()/
   launchConfetti(), todas definidas ahí).
   ══════════════════════════════════════════════════════════ */

/* — Estado del cuestionario. Se agrega al objeto S de index.js. — */
S.hubQIdx=0;
S.hubSel=null;
S.hubScores={logic:0,visual:0,action:0};
S.hubResultType=null;

/* — Las 5 preguntas del cuestionario de estilo de aprendizaje. — */
const HUB_QUIZ=[
  {text:'Cuando aprendes algo nuevo, ¿qué te ayuda más?',opts:[
    {t:'Leer las reglas y resolverlo paso a paso',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">menu_book</span>',type:'logic'},
    {t:'Ver cómo encajan las piezas y patrones',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">extension</span>',type:'visual'},
    {t:'Probar rápido y aprender sobre la marcha',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">bolt</span>',type:'action'}]},
  {text:'Tu fin de semana ideal incluye…',opts:[
    {t:'Un buen acertijo o libro de lógica',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">psychology</span>',type:'logic'},
    {t:'Armar un rompecabezas o clasificar cosas',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">gesture</span>',type:'visual'},
    {t:'Un juego rápido que ponga a prueba tus reflejos',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">sports_esports</span>',type:'action'}]},
  {text:'En clase te concentras mejor cuando hay…',opts:[
    {t:'Preguntas claras y estructuradas',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">assignment</span>',type:'logic'},
    {t:'Colores, imágenes y relaciones visuales',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">palette</span>',type:'visual'},
    {t:'Movimiento y algo a lo que reaccionar',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">directions_run</span>',type:'action'}]},
  {text:'Elige a tu compañero de aventura ideal:',opts:[
    {t:'El Estratega, piensa cada movimiento',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">category</span>',type:'logic'},
    {t:'El Explorador, encuentra patrones ocultos',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">search</span>',type:'visual'},
    {t:'El Corredor, esquiva obstáculos veloz',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">speed</span>',type:'action'}]},
  {text:'Cuando tu código falla, tú…',opts:[
    {t:'Sigues la lógica línea por línea',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">link</span>',type:'logic'},
    {t:'Buscas visualmente qué no encaja',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">visibility</span>',type:'visual'},
    {t:'Pruebas rápido varias soluciones',e:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">track_changes</span>',type:'action'}]},
];

/* — Los 3 perfiles de aprendizaje posibles y a qué ruta llevan. — */
const HUB_TYPES={
  logic:{name:'Mente Lógica',icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_objects</span>',color:'#8B7CD8',desc:'Aprendes mejor con estructura, reglas claras y desafíos paso a paso. Tu ruta ideal: La Cacería de los Lógicos.',game:'view-map',cta:'Ir a La Cacería →'},
  visual:{name:'Mente Visual',icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">flutter_dash</span>',color:'#6FBF9B',desc:'Aprendes reconociendo patrones, formas y relaciones entre conceptos. Tu ruta ideal: el Memorama Lógico.',game:'view-game-memory',cta:'Jugar Memorama Lógico →'},
  action:{name:'Mente Veloz',icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">speed</span>',color:'#F0876B',desc:'Aprendes practicando, reaccionando y probando en movimiento. Tu ruta ideal: la Carrera de Código.',game:'view-game-racer',cta:'Jugar Carrera de Código →'},
};

/* ══════════════════════════════════════════════════════════
   CUESTIONARIO
   ══════════════════════════════════════════════════════════ */

// Punto de entrada "inteligente" al Hub — tiene 3 casos:
// 1. Ya completaste el cuestionario antes → muestra tu resultado
//    guardado (sin repetir preguntas ni el confetti).
// 2. Lo dejaste a medias (interrumpido) → retoma justo en la
//    pregunta donde quedaste, sin perder lo ya respondido.
// 3. Nunca lo empezaste → inicia el quiz desde la pregunta 1.
// Para repetir el cuestionario de todas formas, sigue disponible el
// botón "↺ Repetir el cuestionario" dentro del resultado (goHubQuiz()).
function openHub(){
  if(S.hubResultType){
    showHubResult(S.hubResultType,false);
  }else if(S.hubQIdx>0&&S.hubQIdx<HUB_QUIZ.length){
    showView('view-hub-quiz');
    renderHubQ();
  }else{
    startHub();
  }
}

// Resalta "Hub de Aprendizaje" en el sidebar y (re)inicia el quiz.
function goHubQuiz(){
  setActiveNavByView('view-hub-quiz');
  startHub();
}

// Reinicia e inicia el quiz de estilo de aprendizaje desde cero.
function startHub(){
  S.hubQIdx=0;
  S.hubSel=null;
  S.hubScores={logic:0,visual:0,action:0};
  S.hubResultType=null;
  showView('view-hub-quiz');
  if(typeof hideBanner==='function')hideBanner();
  renderHubQ();
}

// Renderiza la pregunta actual del quiz.
function renderHubQ(){
  const q=HUB_QUIZ[S.hubQIdx];
  document.getElementById('hub-q-text').innerHTML=q.text;
  document.getElementById('hub-progress-text').innerHTML='Pregunta '+(S.hubQIdx+1)+' de '+HUB_QUIZ.length;

  const wrap=document.getElementById('hub-opts');
  wrap.innerHTML='';
  q.opts.forEach((o,i)=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='hub-opt';
    btn.innerHTML=`<span class="hub-opt-emoji" aria-hidden="true">${o.e}</span><span class="hub-opt-text">${o.t}</span><span class="hub-opt-check" aria-hidden="true"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">check</span></span>`;
    btn.onclick=()=>selectHubOpt(btn,i);
    wrap.appendChild(btn);
  });

  S.hubSel=null;
  const nextBtn=document.getElementById('hub-next-btn');
  nextBtn.disabled=true;
  nextBtn.innerHTML=(S.hubQIdx===HUB_QUIZ.length-1)?'Ver mi resultado →':'Siguiente →';

  const dotsWrap=document.getElementById('hub-steps');
  dotsWrap.innerHTML='';
  HUB_QUIZ.forEach((_,i)=>{
    const dot=document.createElement('div');
    dot.className='hub-step-dot'+(i===S.hubQIdx?' active':(i<S.hubQIdx?' done':''));
    dotsWrap.appendChild(dot);
  });
}

// Registra la opción elegida en la pregunta actual.
function selectHubOpt(el,i){
  document.querySelectorAll('#hub-opts .hub-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  S.hubSel=i;
  document.getElementById('hub-next-btn').disabled=false;
}

// Avanza a la siguiente pregunta, o muestra el resultado si era la última.
function hubNext(){
  if(S.hubSel===null)return;
  const q=HUB_QUIZ[S.hubQIdx];
  S.hubScores[q.opts[S.hubSel].type]++;
  S.hubQIdx++;
  if(S.hubQIdx<HUB_QUIZ.length){
    renderHubQ();
  }else{
    finishHub();
  }
}

/* ══════════════════════════════════════════════════════════
   RESULTADO
   ══════════════════════════════════════════════════════════ */

// Calcula qué perfil de aprendizaje obtuvo más puntaje.
function finishHub(){
  let best='logic',bv=-1;
  Object.entries(S.hubScores).forEach(([k,v])=>{
    if(v>bv){bv=v;best=k;}
  });
  S.hubResultType=best;
  showHubResult(best);
  guardarPerfilHub();
}

// Guarda el resultado en el servidor para que no se pierda al cerrar sesión.
// El servidor calcula el tipo a partir de los puntajes (no se fía del navegador).
async function guardarPerfilHub(){
  if(typeof authFetch!=='function')return;
  const res=await authFetch('/juego/perfil',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(S.hubScores),
  });
  if(!res.ok)showToast('No se pudo guardar tu resultado. '+mensajeError(res));
}

// Muestra la pantalla de resultado con el perfil obtenido.
// celebrate=false evita el confetti cuando solo se está revisitando
// un resultado ya guardado (no una finalización nueva del quiz).
function showHubResult(type,celebrate){
  celebrate=celebrate!==false;
  const t=HUB_TYPES[type];
  showView('view-hub-result');
  document.getElementById('hub-res-icon').innerHTML=t.icon;
  document.getElementById('hub-res-name').innerHTML=t.name;
  document.getElementById('hub-res-desc').innerHTML=t.desc;

  const cta=document.getElementById('hub-res-cta');
  cta.innerHTML=t.cta;
  cta.onclick=()=>launchGame(t.game);

  renderHubBars();
  if(celebrate)launchConfetti();
}

// Anima las barras de puntaje por cada perfil (lógico/visual/veloz).
function renderHubBars(){
  const total=HUB_QUIZ.length;
  const wrap=document.getElementById('hub-bars');
  if(!wrap)return;
  wrap.innerHTML='';
  Object.entries(HUB_TYPES).forEach(([key,t])=>{
    const val=S.hubScores[key]||0;
    const pct=Math.round(val/total*100);
    const row=document.createElement('div');
    row.className='hub-bar-row';
    row.innerHTML=`<span class="hub-bar-label">${t.icon} ${t.name}</span><div class="hub-bar-track"><div class="hub-bar-fill" style="background:${t.color}"></div></div><span class="hub-bar-pct">${pct}%</span>`;
    wrap.appendChild(row);
    requestAnimationFrame(()=>{row.querySelector('.hub-bar-fill').style.width=pct+'%';});
  });
}

// Nota: launchGame() ahora vive en juegos.js — se usa arriba en
// showHubResult() y requiere que ese archivo esté cargado en la página.

/* ══════════════════════════════════════════════════════════
   INICIALIZACIÓN DE ESTA SECCIÓN
   ══════════════════════════════════════════════════════════ */
(function initHub(){
  openHub();
})();