/* ══════════════════════════════════════════════════════════
   DESAFÍO DEL DÍA — JS específico de esta sección
   Requiere que index.js ya esté cargado antes que este archivo
   (usa S, y las utilidades compartidas showXp/updateXpBar/
   animateStat/checkLevelUp/launchConfetti) y auth.js (authFetch).

   El desafío, su respuesta y el XP viven en el SERVIDOR: el navegador
   recibe la pregunta sin la respuesta correcta y el servidor decide
   si acertó, paga el XP (una sola vez al día) y limita los intentos.
   ══════════════════════════════════════════════════════════ */

/* — Estado del desafío. Se agrega al objeto S de index.js. — */
S.challengeSel=null;    // posición de la opción marcada (tal como se ve en pantalla)
S.challenge=null;       // desafío actual que entregó el servidor
S.challengeBusy=false;  // evita doble clic mientras se espera al servidor

// Construye la vista: pide a qué desafío le toca hoy al alumno y lo
// dibuja, o muestra "ya completado" / "sin intentos" según corresponda.
async function buildChallenge(){
  const cont=document.getElementById('challenge-content');
  if(!cont)return;
  S.challengeSel=null;
  cont.innerHTML='<p class="chart-empty">Cargando desafío…</p>';

  const res=await authFetch('/desafio/hoy');
  if(!res.ok){
    cont.innerHTML='<p class="chart-empty">'+esc(mensajeError(res))+'</p>';
    return;
  }
  const d=res.datos;

  if(d.completado){
    cont.innerHTML=`
      <div class="challenge-done">
        <div class="challenge-done-icon"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span></div>
        <h3>¡Desafío completado hoy!</h3>
        <p>Ya ganaste tu XP bonus de hoy. Vuelve mañana para un nuevo reto.</p>
      </div>`;
    return;
  }
  if(!d.desafio){
    cont.innerHTML=`
      <div class="challenge-done">
        <div class="challenge-done-icon"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">schedule</span></div>
        <h3>Ya usaste tus intentos de hoy</h3>
        <p>Vuelve mañana para un nuevo reto.</p>
      </div>`;
    return;
  }

  const ch=d.desafio;
  S.challenge=ch;
  cont.innerHTML=`
    <div class="challenge-hero">
      <div class="challenge-badge"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">track_changes</span> Desafío del Día</div>
      <div class="challenge-title">${esc(ch.titulo)}</div>
      <div class="challenge-desc">${esc(ch.descripcion)}</div>
      <div class="challenge-meta">
        <div class="challenge-tag"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">menu_book</span> ${esc(ch.modulo)}</div>
        <div class="challenge-tag"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">bolt</span> ${esc(ch.dificultad)}</div>
        <div class="challenge-tag">⏱ ${esc(ch.tiempo)}</div>
        <div class="challenge-tag"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">star</span> +${Number(ch.xp)} XP</div>
      </div>
    </div>
    <div class="challenge-q-wrap">
      <div class="challenge-q">${esc(ch.texto)}</div>
      <div class="challenge-opts" id="ch-opts">
        ${ch.opciones.map((o,i)=>`
          <button type="button" class="challenge-opt" onclick="selChallengeOpt(this,${i})">
            <span class="challenge-opt-radio"></span><span>${esc(o)}</span>
          </button>`).join('')}
      </div>
    </div>
    <button type="button" class="btn-challenge" id="btn-challenge" onclick="checkChallenge()" disabled>Comprobar →</button>
    <div class="challenge-result" id="ch-result">
      <div class="challenge-result-title" id="ch-res-title"></div>
      <div class="challenge-result-text" id="ch-res-text"></div>
    </div>`;
}

// Marca la alternativa seleccionada.
function selChallengeOpt(el,i){
  document.querySelectorAll('.challenge-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  S.challengeSel=i;
  document.getElementById('btn-challenge').disabled=false;
}

// "Otra pregunta": el servidor entrega un desafío distinto al que falló.
function retryChallenge(){
  buildChallenge();
}

// Envía la respuesta al servidor, que corrige y paga el XP.
async function checkChallenge(){
  if(S.challengeSel===null||S.challengeBusy||!S.challenge)return;
  S.challengeBusy=true;
  const btn=document.getElementById('btn-challenge');
  btn.disabled=true;

  // Se envía la posición ORIGINAL de la opción (las opciones vienen mezcladas).
  const res=await authFetch('/desafio/responder',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({desafio_id:S.challenge.id,opcion:S.challenge.orden[S.challengeSel]}),
  });
  S.challengeBusy=false;
  if(!res.ok){
    showToast(mensajeError(res));
    btn.disabled=false;
    return;
  }
  const r=res.datos;
  const ok=r.correcta;

  document.querySelectorAll('.challenge-opt').forEach((o,i)=>{
    o.disabled=true;
    if(i===S.challengeSel)o.classList.add(ok?'correct-anim':'wrong-anim');
  });

  const out=document.getElementById('ch-result');
  out.className='challenge-result show '+(ok?'ok':'err');
  document.getElementById('ch-res-title').innerHTML=ok?'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">auto_awesome</span> ¡Correcto!':'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">close</span> No exactamente…';
  document.getElementById('ch-res-text').innerHTML=ok?esc(r.retro):'Pista: '+esc(r.pista);

  if(ok){
    const oldXp=S.xp;
    S.xp=r.xp_total;
    showXp('+'+r.xp_ganado+' XP Bonus!');
    updateXpBar();
    animateStat('total-xp',S.xp);
    checkLevelUp(oldXp,S.xp);
    launchConfetti();
    setTimeout(buildChallenge,2600);
  }else if(r.intentos_restantes>0){
    out.insertAdjacentHTML('beforeend','<button type="button" class="btn-challenge challenge-retry-btn" onclick="retryChallenge()"><span class="material-icons" style="font-size: 1em; vertical-align: middle;">sync</span> Otra pregunta →</button>');
  }else{
    out.insertAdjacentHTML('beforeend','<p class="challenge-result-text">Ya usaste tus intentos de hoy. Vuelve mañana.</p>');
  }
}