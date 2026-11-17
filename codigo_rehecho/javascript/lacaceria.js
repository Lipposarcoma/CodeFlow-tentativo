/* ══════════════════════════════════════════════════════════
   LA CACERÍA — JS específico de esta sección
   Requiere que se hayan cargado, en este orden, antes que este
   archivo:
     1. index.js            (declara y usa el objeto S compartido)
     2. lacaceria-datos.js  (declara el objeto MODS con el contenido)
   Además usa, en tiempo de ejecución, authFetch() y mensajeError()
   de auth.js (que se carga al final).
   ══════════════════════════════════════════════════════════ */

/* — Progreso dentro de los módulos de "La Cacería".
     Se agrega al objeto S ya declarado en index.js. — */
S.done={};       // ej: S.done['1-2'] = estrellas obtenidas en el nivel 2 del módulo 1
S.bossDone={};   // ej: S.bossDone[1] = true si venció al Centinela del módulo 1
S.seenStory={};  // reservado para cuando exista el modal de historia real

/* — Datos para Analítica Docente (se llenan en checkAnswer). — */
S.attempts=0;          // total de respuestas emitidas (todas las preguntas)
S.errors=0;            // total de respuestas incorrectas
S.maxStreak=0;         // racha de aciertos más larga alcanzada
S.qAttempts={};        // intentos por pregunta específica: '<mod>-<lvl>-<qIdx>'
S.qErrors={};          // errores por pregunta específica (misma clave)
S.precisionHistory=[]; // últimas ~20 respuestas (true=correcta), para la línea de tiempo
S.log=[];              // últimas ~30 respuestas con texto y hora, para el historial

/* ══════════════════════════════════════════════════════════
   MÓDULOS QUE YA USAN EL SERVIDOR (piloto)
   Para estos módulos las preguntas se piden al backend (sin la
   respuesta correcta) y es el servidor quien corrige, calcula
   estrellas y XP, y guarda el progreso. Los demás módulos siguen
   funcionando 100% en el navegador, como antes.
   Para migrar otro módulo: agregar su número aquí.
   ══════════════════════════════════════════════════════════ */
const MODULOS_SERVIDOR=[1,2,3,4,5,6];
function usaServidor(id){
  return MODULOS_SERVIDOR.includes(Number(id));
}

// Escapa texto que viene de la base de datos antes de usarlo con innerHTML.
function esc(t){
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

S.partidaId=null;   // partida abierta en el servidor (nivel o boss en curso)
S.srvFin=null;      // resultado final que el servidor calculó al terminar
S.lastOk=false;     // ¿la última respuesta fue correcta?
S.cargando=false;   // evita doble clic mientras se espera al servidor

// Pide al servidor tu progreso guardado y lo pinta en el mapa.
// auth.js la llama justo después de iniciar sesión.
async function cargarProgresoServidor(){
  const res=await authFetch('/juego/progreso');
  if(!res.ok){
    showToast('No se pudo cargar tu progreso. '+mensajeError(res));
    return;
  }
  const d=res.datos;
  d.niveles.forEach(n=>{
    if(usaServidor(n.modulo))S.done[`${n.modulo}-${n.nivel-1}`]=n.estrellas;
  });
  d.jefes.forEach(m=>{
    if(usaServidor(m))S.bossDone[m]=true;
  });
  S.xp=d.xp_total;
  // Racha de aciertos guardada (sigue desde donde quedó la última vez)
  S.streak=d.racha||0;
  S.maxStreak=Math.max(S.maxStreak,d.racha_max||0);
  animateStat('streak-val',S.streak);
  // Resultado del cuestionario del Hub, si ya lo había hecho
  if(d.perfil&&typeof HUB_QUIZ!=='undefined'){
    S.hubScores=d.perfil.puntajes;
    S.hubResultType=d.perfil.tipo;
    const hubActivo=document.getElementById('view-hub-quiz');
    if(hubActivo&&hubActivo.classList.contains('active')&&typeof openHub==='function')openHub();
  }
  Object.keys(MODS).forEach(id=>{
    buildPath(id);
    updateRing(id);
  });
  updateXpBar();
  animateStat('total-xp',S.xp);
}

// Abre una partida en el servidor (nivel 1-5, o 6 = boss).
// Devuelve {qs, tiempoLimite} con las preguntas ya en el formato que
// espera el motor, o null si el servidor la rechazó (ya avisó con un toast).
async function abrirPartida(modulo,nivel){
  const res=await authFetch('/juego/partidas',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({modulo:Number(modulo),nivel}),
  });
  if(!res.ok){
    showToast(mensajeError(res));
    return null;
  }
  const icono=nivel===6
    ?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">dangerous</span>'
    :MODS[modulo].icon;
  S.partidaId=res.datos.partida_id;
  return{
    qs:res.datos.preguntas.map(q=>({
      id:q.id,
      concept:esc(q.concepto),
      icon:icono,
      text:esc(q.texto),
      opts:q.opciones.map(esc),
      orden:q.orden,   // posición ORIGINAL de cada opción mostrada (las opciones vienen mezcladas)
    })),
    tiempoLimite:res.datos.tiempo_limite,
  };
}

// Envía una respuesta al servidor. Devuelve su veredicto, o null si falló.
async function responderServidor(q,opcion){
  const res=await authFetch(`/juego/partidas/${S.partidaId}/responder`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pregunta_id:q.id,opcion}),
  });
  if(!res.ok){
    showToast(mensajeError(res));
    return null;
  }
  return res.datos;
}

/* ══════════════════════════════════════════════════════════
   MÓDULOS DE "LA CACERÍA"
   Abrir/cerrar la tarjeta de un módulo, dibujar su camino de
   niveles, y actualizar su anillo de progreso.
   ══════════════════════════════════════════════════════════ */

// Abre o cierra (colapsa) la tarjeta de un módulo en el mapa.
function toggleMod(id){
  const blk=document.getElementById('blk-'+id);
  if(!blk)return;
  const wasOpen=blk.classList.contains('open');

  document.querySelectorAll('.module-block').forEach(b=>{
    b.classList.remove('open');
    const btn=b.querySelector('.module-toggle');
    if(btn)btn.setAttribute('aria-expanded','false');
  });

  if(!wasOpen){
    blk.classList.add('open');
    const btn=blk.querySelector('.module-toggle');
    if(btn)btn.setAttribute('aria-expanded','true');
  }
}

// Renderiza el camino de niveles (nodos) dentro de un módulo.
function buildPath(id){
  const path=document.getElementById('path-'+id);
  if(!path)return;
  path.innerHTML='';
  const m=MODS[id];

  m.levels.forEach((lvl,i)=>{
    const isDone=!!S.done[`${id}-${i}`];
    const isCurrent=!isDone&&(i===0||!!S.done[`${id}-${i-1}`]);
    const isLocked=!isDone&&!isCurrent;
    const cls=isDone?'done':isCurrent?'current':'locked';
    const stars=S.done[`${id}-${i}`]||0;
    const starHtml=[1,2,3].map(s=>`<span class="${stars>=s?'lit':''}">${stars>=s?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span>':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">star_border</span>'}</span>`).join('');
    const row=document.createElement('div');
    row.className='level-row';
    row.innerHTML=`
      <button type="button" class="level-node ${cls}" ${isLocked?'disabled':''} onclick="startLevel(${id},${i})">
        <div class="level-node-btn" style="${isCurrent?`background:${m.color};border-color:${m.color};`:isDone?`border-color:${m.color};color:${m.color};`:''}">${isDone?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">check</span>':isCurrent?String(i+1):'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">lock</span>'}</div>
        <div class="level-node-label">${lvl.name}</div>
        <div class="level-stars">${starHtml}</div>
      </button>`;
    path.appendChild(row);
  });

  if(m.boss){
    const allLevelsDone=m.levels.every((_,i)=>S.done[`${id}-${i}`]);
    const bossDone=!!S.bossDone[id];
    const bossClass=bossDone?'done':allLevelsDone?'current':'locked';
    const bossLocked=!bossDone&&!allLevelsDone;
    const row=document.createElement('div');
    row.className='level-row';
    row.innerHTML=`
      <button type="button" class="level-node boss-node ${bossClass}" ${bossLocked?'disabled':''} onclick="startBoss(${id})">
        <div class="level-node-btn" style="${bossDone?'background:rgba(220,38,38,.15);border-color:#DC2626;color:#f87171':allLevelsDone?'background:#DC2626;border-color:#DC2626;color:#fff;':''}">${bossDone?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span>':allLevelsDone?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">dangerous</span>':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">lock</span>'}</div>
        <div class="level-node-label" style="color:${bossDone||allLevelsDone?'#f87171':''}">Boss Fight<br>${m.boss.name}</div>
        <div class="level-stars">${bossDone?'<span class="lit"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span></span><span class="lit"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span></span><span class="lit"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span></span>':'<span><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star_border</span></span><span><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star_border</span></span><span><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star_border</span></span>'}</div>
      </button>`;
    path.appendChild(row);
  }
}

// Actualiza el anillo de progreso (SVG) de un módulo en su tarjeta.
function updateRing(id){
  const m=MODS[id];
  const total=m.levels.length+(m.boss?1:0);
  const done=m.levels.filter((_,i)=>S.done[`${id}-${i}`]).length+(S.bossDone[id]?1:0);
  const pct=Math.round(done/total*100),off=113.1-(pct/100)*113.1;
  const fill=document.querySelector(`#ring-${id} .ring-fill`);
  if(fill)fill.style.strokeDashoffset=off;
  const el=document.getElementById('rpct-'+id);
  if(el)el.innerHTML=pct+'%';
}

/* — Historia del candidato de un módulo —
   Placeholder temporal: el modal de historia real aún no está
   construido. Reemplazar cuando se agregue esa vista/modal. */
// Abre el modal con el prólogo general de la historia (Ren Kaster).
function openLore(){
  const el=document.getElementById('story-modal');
  document.getElementById('story-card').style.setProperty('--sc-color','#4F8EF7');
  document.getElementById('story-card-hero').style.setProperty('--sc-color','#4F8EF7');
  document.getElementById('story-card-portrait').innerHTML=REN.emoji;
  document.getElementById('story-card-nodo').innerHTML='GREMIO DEL NODO';
  document.getElementById('story-card-name').innerHTML=REN.name;
  document.getElementById('story-card-role').innerHTML=REN.role;
  document.getElementById('story-card-tag').innerHTML='Prólogo';
  document.getElementById('story-card-quote').innerHTML=REN.quote;
  document.getElementById('story-card-txt').innerHTML=LORE_PROLOGUE;
  document.getElementById('story-card-btn').innerHTML='Empezar la cacería →';
  el.classList.add('show');
}

// Abre el modal de historia del personaje asociado a un módulo:
// el candidato a certificar, o —si el módulo no tiene uno, como el
// Módulo 6— el propio Centinela como enfrentamiento final.
function openStory(id){
  const m=MODS[id];
  if(!m)return;

  const hasCandidate=!!m.candidateName;
  const emoji=hasCandidate?m.candidateEmoji:m.boss.centinela.emoji;
  const name=hasCandidate?m.candidateName:m.boss.name;
  const role=hasCandidate?m.candidateRole:m.boss.centinela.role;
  const quote=hasCandidate?m.candidateQuote:m.boss.centinela.quote;

  const el=document.getElementById('story-modal');
  document.getElementById('story-card').style.setProperty('--sc-color',m.color);
  document.getElementById('story-card-hero').style.setProperty('--sc-color',m.color);
  document.getElementById('story-card-portrait').innerHTML=emoji;
  document.getElementById('story-card-nodo').innerHTML=(m.nodo||'').toUpperCase();
  document.getElementById('story-card-name').innerHTML=name;
  document.getElementById('story-card-role').innerHTML=role;
  document.getElementById('story-card-tag').innerHTML=hasCandidate?'Nuevo candidato':'Enfrentamiento final';
  document.getElementById('story-card-quote').innerHTML=quote;
  document.getElementById('story-card-txt').innerHTML=m.story;
  document.getElementById('story-card-btn').innerHTML=hasCandidate?'Conocer a '+name+' →':'Entrar a la Ciudadela →';
  el.classList.add('show');
}

// Cierra el modal de historia.
function closeStory(){
  document.getElementById('story-modal').classList.remove('show');
}

/* ══════════════════════════════════════════════════════════
   MOTOR DE EJERCICIO
   Abre un nivel, muestra sus preguntas una a una, valida las
   respuestas y actualiza el progreso al terminar.

   NOTA: todavía no existe el banner de retroalimentación ni el
   modal de "nivel completado" (eso viene en una próxima ronda),
   así que por ahora se usa showToast() como aviso temporal de
   correcto/incorrecto, y el botón "Comprobar" se reutiliza para
   avanzar a la siguiente pregunta.
   ══════════════════════════════════════════════════════════ */

// Abre la vista de ejercicio y comienza el nivel elegido.
async function startLevel(id,lvlIdx){
  if(S.cargando)return;
  let qs;
  if(usaServidor(id)){
    S.cargando=true;
    const partida=await abrirPartida(id,lvlIdx+1);
    S.cargando=false;
    if(!partida)return;           // el servidor dijo que no (ya se avisó)
    qs=partida.qs;
  }else{
    S.partidaId=null;
    qs=MODS[id].levels[lvlIdx].q;
  }

  S.mod=id;
  S.lvl=lvlIdx;
  S.qIdx=0;
  S.qs=qs;
  S.sel=null;
  S.srvFin=null;
  S.levelErrors=0;
  S.isBoss=false;

  showView('view-exercise');

  // Limpia cualquier resto visual de un Boss Fight anterior (intro
  // no lanzada, pantalla de resultado previa, o el modo visual boss),
  // para que un nivel normal siempre arranque en un estado limpio.
  document.getElementById('boss-intro-container').innerHTML='';
  document.getElementById('boss-result-container').innerHTML='';
  document.getElementById('exercise-question-wrap').style.display='';
  document.getElementById('question-container').classList.remove('boss-mode');
  document.getElementById('boss-timer-wrap').style.display='none';

  const m=MODS[id];
  const badge=document.getElementById('ex-mod-badge');
  badge.innerHTML=`${m.icon} ${m.name}`;
  badge.style.cssText=`background:${m.color}1f;border:1px solid ${m.color}3d;color:${m.color};display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:100px;font-size:calc(11px * var(--a11y-fs, 1));font-weight:700;flex-shrink:0;`;
  document.getElementById('progress-bar').classList.remove('boss-fill');

  loadQ();
}

// Renderiza la pregunta actual del ejercicio en curso.
function loadQ(){
  hideBanner();
  const q=S.qs[S.qIdx];
  const pct=Math.round((S.qIdx/S.qs.length)*100);
  const bar=document.getElementById('progress-bar');
  bar.style.width=pct+'%';
  bar.parentElement.setAttribute('aria-valuenow',pct);

  document.getElementById('q-concept').innerHTML=q.concept;
  document.getElementById('q-concept').className='q-badge'+(S.isBoss?' boss':'');
  document.getElementById('q-icon').innerHTML=q.icon;
  document.getElementById('q-text').innerHTML=q.text;

  const container=document.getElementById('options-container');
  container.innerHTML='';
  q.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='option-item';
    btn.innerHTML=`<span class="option-radio"></span><span>${opt}</span>`;
    btn.onclick=()=>selOpt(btn,i);
    container.appendChild(btn);
  });

  const check=document.getElementById('btn-check');
  check.style.display='flex';
  check.className='btn-check'+(S.isBoss?' boss-check':'');
  check.innerHTML='Comprobar respuesta →';
  check.disabled=true;
  check.onclick=checkAnswer;
  S.sel=null;
}

// Marca la opción de respuesta elegida por el usuario.
function selOpt(el,i){
  document.querySelectorAll('.option-item').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  S.sel=i;
  document.getElementById('btn-check').disabled=false;
}

// Valida la respuesta seleccionada frente a la correcta.
async function checkAnswer(){
  if(S.sel===null)return;
  const q=S.qs[S.qIdx];
  const sel=S.sel;
  let ok,retro,pista,idxCorrecta;

  if(usaServidor(S.mod)){
    // El servidor corrige. El navegador ni siquiera conoce la respuesta.
    const btn=document.getElementById('btn-check');
    btn.disabled=true;
    const r=await responderServidor(q,q.orden[sel]);   // se envía la posición original, no la mostrada
    if(!r){btn.disabled=false;return;}
    if(r.estado==='expirada'){           // se acabó el tiempo del boss
      stopBossTimer();
      hideBanner();
      showBossResult(false);
      return;
    }
    ok=r.correcta;
    retro=esc(r.retro||'');
    pista=esc(r.pista||'');
    idxCorrecta=ok?sel:null;             // si falló, NO se revela cuál era
    S.srvFin=r.completado?r:null;
  }else{
    ok=sel===q.ok;
    retro=q.fb;
    pista=q.err;
    idxCorrecta=q.ok;
  }
  S.lastOk=ok;

  // — Registro para Analítica Docente —
  S.attempts++;
  S.precisionHistory.push(ok);
  if(S.precisionHistory.length>20)S.precisionHistory.shift();
  if(!ok)S.errors++;
  // Las preguntas de Boss Fight no se registran por pregunta específica
  // (S.qAttempts/S.qErrors): durante un boss, S.lvl conserva el valor
  // del último nivel regular jugado, así que usar esa clave aquí
  // contaminaría las estadísticas de ese nivel con datos del boss.
  // El desempeño del boss ya se refleja aparte en S.bossDone.
  if(!S.isBoss){
    const qKey=`${S.mod}-${S.lvl}-${S.qIdx}`;
    S.qAttempts[qKey]=(S.qAttempts[qKey]||0)+1;
    if(!ok)S.qErrors[qKey]=(S.qErrors[qKey]||0)+1;
  }
  S.log.unshift({
    ok,
    text:(MODS[S.mod]?MODS[S.mod].name:'—')+' · '+q.concept.split(' · ').pop()+' — '+(ok?'Correcta':'Incorrecta'),
    time:new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}),
  });
  if(S.log.length>30)S.log.pop();

  document.querySelectorAll('.option-item').forEach((o,i)=>{
    o.disabled=true;
    if(i===idxCorrecta)o.classList.add('correct-anim');
    else if(i===sel&&!ok)o.classList.add('wrong-anim');
  });

  document.getElementById('btn-check').style.display='none';

  const banner=document.getElementById('feedback-banner');
  banner.className='feedback-banner show '+(ok?'correct':'error');
  document.getElementById('fb-title').innerHTML=ok?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">auto_awesome</span> ¡Excelente deducción!':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">close</span> Detente a pensar';
  document.getElementById('fb-desc').innerHTML=ok?retro:'Pista: '+pista;
  const nextBtn=document.getElementById('btn-next');
  nextBtn.className='btn-next '+(ok?'success':'retry');
  nextBtn.innerHTML=ok?'Continuar →':'Reintentar →';

  if(ok){
    S.streak++;
    if(S.streak>S.maxStreak)S.maxStreak=S.streak;
    animateStat('streak-val',S.streak);
    if(S.isBoss)S.bossCorrect++;
  }else{
    S.streak=0;
    animateStat('streak-val',0);
    if(S.isBoss)S.bossErrors++;
    else S.levelErrors++;
  }
}

// Oculta el banner de retroalimentación.
function hideBanner(){
  document.getElementById('feedback-banner').className='feedback-banner';
}

// Avanza a la siguiente pregunta, o reintenta la misma si falló.
function nextQuestion(){
  if(!S.lastOk){
    loadQ();
    return;
  }
  S.qIdx++;
  if(S.qIdx>=S.qs.length){
    document.getElementById('progress-bar').style.width='100%';
    hideBanner();
    if(S.isBoss){
      stopBossTimer();
      showBossResult(true);
    }else{
      finishLevel();
    }
  }else{
    loadQ();
  }
}

// Marca el nivel como completado, otorga solo el XP correspondiente
// a la MEJORA respecto a tu mejor puntaje anterior (evita farmeo y
// permite ganar el XP restante si mejoras tus estrellas), actualiza
// el progreso del módulo y muestra el modal de "nivel superado".
function finishLevel(){
  const key=`${S.mod}-${S.lvl}`;
  const prevStars=S.done[key]||0;

  let stars,xpGained=0;
  const oldXp=S.xp;
  if(S.srvFin){
    // Módulo del servidor: estrellas y XP vienen ya calculados.
    stars=S.srvFin.estrellas;
    xpGained=S.srvFin.xp_ganado;
    S.srvFin=null;
  }else{
    stars=S.levelErrors===0?3:S.levelErrors<=1?2:1;
    if(stars>prevStars)xpGained=(stars-prevStars)*20;
  }
  if(xpGained>0){
    S.xp+=xpGained;
    updateXpBar();
    animateStat('total-xp',S.xp);
    showXp('+'+xpGained+' XP');
    checkLevelUp(oldXp,S.xp);
  }
  S.done[key]=Math.max(prevStars,stars);

  buildPath(S.mod);
  updateRing(S.mod);
  launchConfetti();

  const isWorldComplete=MODS[S.mod].levels.every((_,i)=>S.done[`${S.mod}-${i}`]);
  showModal(S.mod,S.lvl,stars,isWorldComplete,xpGained);
}

// Rellena y muestra el modal de nivel/módulo completado.
function showModal(id,lvlIdx,stars,worldComplete,xpGained){
  const lvl=MODS[id].levels[lvlIdx];
  document.getElementById('m-emoji').innerHTML=worldComplete?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">public</span>':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">celebration</span>';
  document.getElementById('m-title').innerHTML=worldComplete?`¡Mundo ${MODS[id].name} completado!`:`¡${lvl.name} superado!`;

  const starsEl=document.getElementById('m-stars');
  starsEl.innerHTML='';
  for(let i=1;i<=3;i++){
    const s=document.createElement('span');
    s.className=i<=stars?'star-anim':'';
    s.style.animationDelay=`${.2+i*.12}s`;
    s.style.color=i<=stars?'var(--yellow)':'var(--muted2)';
    s.innerHTML=i<=stars?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span>':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">star_border</span>';
    starsEl.appendChild(s);
  }

  document.getElementById('m-xp').innerHTML=xpGained>0
    ?`<span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span> +${xpGained} XP ganados`
    :'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">sync</span> Repetición — sin XP nuevo (ya tenías este puntaje o uno mejor)';
  document.getElementById('m-sub').innerHTML=worldComplete
    ?`¡Has completado todos los niveles de ${MODS[id].name}! Ahora enfrenta el Boss Fight para obtener tu certificado.`
    :'Métricas registradas en el motor de analítica.';

  const nextBtn=document.getElementById('modal-next-btn');
  const hasNextLevel=lvlIdx+1<MODS[id].levels.length;
  if(nextBtn)nextBtn.style.display=hasNextLevel?'block':'none';

  document.getElementById('lvl-modal').classList.add('show');
}

// Cierra el modal y salta directo al siguiente nivel del módulo,
// sin pasar por el mapa.
function goToNextLevel(){
  const id=S.mod,next=S.lvl+1;
  document.getElementById('lvl-modal').classList.remove('show');
  startLevel(id,next);
}

// Cierra el modal de nivel completado y vuelve al mapa.
function closeModal(){
  document.getElementById('lvl-modal').classList.remove('show');
  exitExercise();
}

// Sale del ejercicio actual y vuelve al mapa de "La Cacería".
function exitExercise(){
  stopBossTimer();
  showView('view-map');
  setActiveNavByView('view-map');
}

/* ══════════════════════════════════════════════════════════
   BOSS FIGHT
   Pantalla de introducción, temporizador, preguntas integradoras
   y resultado (victoria/derrota) contra el Centinela de un módulo.
   ══════════════════════════════════════════════════════════ */

// Muestra la pantalla de introducción antes de iniciar la pelea.
function startBoss(id){
  S.mod=id;
  S.isBoss=true;
  S.bossStarted=false;
  S.bossErrors=0;
  S.bossCorrect=0;
  // En módulos del servidor las preguntas se piden al pulsar "Enfrentar"
  // (así el reloj del boss no corre mientras lees la introducción).
  S.qs=usaServidor(id)?[]:MODS[id].boss.questions;
  S.srvFin=null;
  S.qIdx=0;
  S.sel=null;

  showView('view-exercise');
  hideBanner();

  const m=MODS[id];
  const boss=m.boss;
  const nPreg=boss.numPreguntas||boss.questions.length;

  const badge=document.getElementById('ex-mod-badge');
  badge.innerHTML='<span class="material-icons" style="font-size: 1em; vertical-align: middle;">dangerous</span> BOSS FIGHT';
  badge.style.cssText='background:rgba(220,38,38,.12);border:1px solid rgba(220,38,38,.3);color:#f87171;display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:100px;font-size:calc(11px * var(--a11y-fs, 1));font-weight:700;flex-shrink:0;';
  document.getElementById('exercise-question-wrap').style.display='none';
  document.getElementById('boss-result-container').innerHTML='';
  document.getElementById('progress-bar').classList.add('boss-fill');
  document.getElementById('progress-bar').style.width='0%';

  document.getElementById('boss-intro-container').innerHTML=`
    <div class="boss-intro">
      <span class="boss-intro-skull">${boss.centinela.emoji}</span>
      <h2>${boss.name}</h2>
      <p style="font-style:italic;color:var(--muted);margin-bottom:6px">${boss.centinela.quote}</p>
      <p>El Centinela del ${m.nodo} guarda la certificación de ${m.candidateName}. Es una <strong>evaluación integradora</strong> que combina todos los conceptos del módulo. Tienes <strong>${boss.time} segundos</strong> para responder ${nPreg} preguntas. Cada error cuenta. ¿Estás preparado?</p>
      <div class="boss-intro-rules">
        <div class="boss-rule">⏱ ${boss.time}s límite</div>
        <div class="boss-rule"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">help_outline</span> ${nPreg} preguntas</div>
        <div class="boss-rule"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span> +40 XP por pregunta</div>
        <div class="boss-rule"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span> Desbloquea certificado</div>
      </div>
      <button type="button" class="btn-boss-start" onclick="launchBoss(${id})"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">sports_martial_arts</span> Enfrentar a ${boss.name}</button>
    </div>`;
}

// Arranca la pelea: temporizador en cuenta regresiva y primera pregunta.
async function launchBoss(id){
  if(S.cargando)return;
  let limite=MODS[id].boss.time;
  if(usaServidor(id)){
    S.cargando=true;
    const partida=await abrirPartida(id,6);
    S.cargando=false;
    if(!partida)return;
    S.qs=partida.qs;
    if(partida.tiempoLimite)limite=partida.tiempoLimite;   // manda el servidor
  }

  S.bossStarted=true;
  document.getElementById('boss-intro-container').innerHTML='';
  document.getElementById('exercise-question-wrap').style.display='';
  document.getElementById('question-container').classList.add('boss-mode');
  document.getElementById('boss-timer-wrap').style.display='flex';

  S.bossTimeLeft=limite;
  updateBossTimerDisplay();
  S.bossTimer=setInterval(()=>{
    S.bossTimeLeft--;
    updateBossTimerDisplay();
    if(S.bossTimeLeft<=0){
      stopBossTimer();
      hideBanner();
      showBossResult(false);
    }
    if(S.bossTimeLeft<=10){
      const t=document.getElementById('boss-timer');
      if(t)t.classList.add('urgent');
    }
  },1000);

  loadQ();
}

// Refresca el número del cronómetro del jefe.
function updateBossTimerDisplay(){
  const el=document.getElementById('boss-timer');
  if(el)el.innerHTML=String(S.bossTimeLeft).padStart(2,'0')+'s';
}

// Detiene el intervalo del temporizador de la pelea.
function stopBossTimer(){
  if(S.bossTimer){
    clearInterval(S.bossTimer);
    S.bossTimer=null;
  }
  document.getElementById('boss-timer-wrap').style.display='none';
}

// Muestra la pantalla de victoria o derrota contra el jefe.
// Si el jefe ya había sido vencido antes, no se vuelve a otorgar XP
// (mismo criterio anti-farmeo que usamos en los niveles normales).
function showBossResult(victory){
  document.getElementById('exercise-question-wrap').style.display='none';
  hideBanner();

  const m=MODS[S.mod];
  const boss=m.boss;
  const timeUsed=boss.time-S.bossTimeLeft;

  let xpGained=0;
  if(victory){
    const alreadyDone=!!S.bossDone[S.mod];
    if(S.srvFin)xpGained=S.srvFin.xp_ganado;       // módulo del servidor
    else if(!alreadyDone)xpGained=S.bossCorrect*40;
    S.srvFin=null;
    if(xpGained>0){
      const oldXp=S.xp;
      S.xp+=xpGained;
      updateXpBar();
      animateStat('total-xp',S.xp);
      showXp('+'+xpGained+' XP');
      checkLevelUp(oldXp,S.xp);
    }
    S.bossDone[S.mod]=true;
    buildPath(S.mod);
    updateRing(S.mod);
    launchConfetti();
  }

  document.getElementById('boss-result-container').innerHTML=`
    <div class="boss-result ${victory?'victory':'defeat'}">
      <span class="boss-result-emoji">${victory?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span>':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">heart_broken</span>'}</span>
      <h2>${victory?'¡Boss Vencido!':'Derrota. Inténtalo de nuevo.'}</h2>
      <p>${victory
        ?(m.candidateName
          ?`Certificaste a <strong>${m.candidateName}</strong>. El Centinela del ${m.nodo} se disuelve en estática — un Lógico más a salvo.`
          :`¡Has vencido a <strong>${boss.name}</strong>! Todos los Lógicos que certificaste ahora pueden crecer libres. La Cacería ha terminado.`)
        :'El Centinela resiste esta vez. El tiempo se agotó o los errores fueron demasiados. Repasa los conceptos del módulo y vuelve a intentarlo — ¡puedes con esto!'}</p>
      <div class="boss-result-stats">
        <div class="boss-stat"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">check_circle</span> ${S.bossCorrect}/${S.qs.length} correctas</div>
        <div class="boss-stat"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">close</span> ${S.bossErrors} errores</div>
        <div class="boss-stat">⏱ ${timeUsed}s usados</div>
        <div class="boss-stat"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span> +${xpGained} XP</div>
      </div>
      ${victory
        ?'<button type="button" class="btn-boss-map" onclick="exitExercise()">Volver al mapa →</button>'
        :`<button type="button" class="btn-boss-retry" onclick="startBoss(${S.mod})"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">autorenew</span> Reintentar Boss</button>
          <button type="button" class="btn-boss-map" onclick="exitExercise()">Volver al mapa →</button>`}
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   INICIALIZACIÓN DE ESTA SECCIÓN
   ══════════════════════════════════════════════════════════ */
(function initLaCaceria(){
  // Recorre todos los módulos definidos en lacaceria-datos.js y arma
  // su camino de niveles. Así, agregar un módulo nuevo (3, 4, 5, 6...)
  // no requiere tocar esta inicialización nunca más.
  Object.keys(MODS).forEach(id=>{
    buildPath(id);
    updateRing(id);
  });
})();