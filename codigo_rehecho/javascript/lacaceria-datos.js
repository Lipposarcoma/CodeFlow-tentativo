/* ══════════════════════════════════════════════════════════
   LA CACERÍA — DATOS DE LOS MÓDULOS
   Solo contenido (nombres, preguntas, boss): sin lógica.
   El motor que usa estos datos vive en lacaceria.js.

   Para agregar un módulo nuevo: solo se agrega una entrada más
   a este objeto (ej: "2:{...}"), con el mismo formato que el
   Módulo 1. No hace falta tocar lacaceria.js para eso.

   IMPORTANTE: este archivo debe cargarse ANTES que lacaceria.js
   en el HTML, porque el motor lo necesita disponible desde que
   arranca (construye el camino de niveles del primer módulo
   apenas carga la página).
   ══════════════════════════════════════════════════════════ */

/* — Prólogo general de la narrativa (usado por el banner de Ren Kaster). — */
const LORE_PROLOGUE=`Existe una capa oculta bajo el mundo de siempre: la Red. Ahí opera el Gremio del Nodo, una organización clandestina de Cazatalentos que recorre ciudades buscando algo muy específico — personas con un don crudo para el pensamiento lógico. Les llaman Lógicos.

Si un Lógico crece sin entrenar su don, dos cosas pueden pasar: se apaga, convertido en un Bucle Roto que repite el mismo error para siempre... o algo peor lo encuentra primero.

Esa "cosa peor" es La Estática: una corriente que corrompe mentes brillantes y las convierte en Centinelas, guardianes obedientes de un caos perfectamente ordenado.

Tú acabas de firmar como aprendiz de Cazatalentos. Tu mentor es Ren Kaster, y tu primera misión son seis Nodos, seis candidatos, seis Centinelas — y una pregunta que solo tú puedes responder al final: ¿de qué lado vas a certificarte?`;

/* — Datos de Ren Kaster, el mentor (usado por el modal de historia). — */
const REN={
  emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">person_search</span>',
  name:'Ren Kaster',
  role:'Cazatalentos Senior · Tu mentor',
  quote:'"No busco a los que ya lo saben todo. Busco a los que preguntan por qué."',
};

const MODS={
  1:{
    name:'Secuencias',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">extension</span>',
    color:'#4F8EF7',
    nodo:'Nodo del Reloj',
    candidateName:'Tick',
    candidateEmoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">extension</span>',
    candidateRole:'Candidato · Nodo del Reloj',
    candidateQuote:'"Si el orden se rompe una vez, ¿cómo confías en que no se rompa siempre?"',
    story:'Ren te guía a un taller de relojería que huele a aceite y metal frío. Ahí vive Tick, un chico que cuenta cada paso que da en voz baja. "El Nodo del Reloj no perdona el desorden", dice Ren. "Certifícalo, o el Desfase lo va a hacer tartamudear ideas para siempre."',
    // Módulo 1: las preguntas, opciones y respuestas viven en la base de datos
    // (servidor). Aquí solo queda el nombre del nivel y el concepto, que usa
    // la Analítica Docente.
    levels:[
      {name:'Introducción',q:[{concept:'M1 · Orden Lógico'}]},
      {name:'Acciones digitales',q:[{concept:'M1 · Paso a Paso'}]},
      {name:'Algoritmos cotidianos',q:[{concept:'M1 · Secuencia'}]},
      {name:'Error en la cadena',q:[{concept:'M1 · Detección'}]},
      {name:'Secuencia avanzada',q:[{concept:'M1 · Consolidación'}]},
    ],
    boss:{
      name:'El Desfase',
      time:60,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">sync</span>',quote:'"a-a-antes... des-después... ¿cuál fue primero?"'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
  2:{
    name:'Condicionales',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">balance</span>',
    color:'#A855F7',
    nodo:'Nodo del Espejo',
    candidateName:'Duala',
    candidateEmoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">balance</span>',
    candidateRole:'Candidata · Nodo del Espejo',
    candidateQuote:'"Dame una condición y te muestro sus dos caras — o las cuatro, si me dejas pensar dos segundos más."',
    story:'El Nodo del Espejo está lleno de superficies que reflejan dos versiones de todo. Duala te recibe discutiendo consigo misma sobre si vale la pena recibirte. "Es su don", murmura Ren. "Ve ambos lados de cada condición. El problema es que a veces se queda ahí, atrapada, como el Indeciso."',
    // Las preguntas, opciones y respuestas viven en la base de datos (servidor).
    // Aquí solo queda el nombre del nivel y el concepto (lo usa la Analítica Docente).
    levels:[
      {name:'Si / Entonces',q:[{concept:'M2 · If/Else'}]},
      {name:'Condición AND',q:[{concept:'M2 · AND'}]},
      {name:'Valor de verdad',q:[{concept:'M2 · Booleano'}]},
      {name:'Condicional anidado',q:[{concept:'M2 · Else If'}]},
      {name:'Lógica OR',q:[{concept:'M2 · Consolidación'}]},
    ],
    boss:{
      name:'El Indeciso',
      time:60,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">monetization_on</span>',quote:'"Verdadero... falso... verdadero... falso..."'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
  3:{
    name:'Bucles',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">sync</span>',
    color:'#F97316',
    nodo:'Nodo del Laberinto',
    candidateName:'Eco',
    candidateEmoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">sync</span>',
    candidateRole:'Candidata · Nodo del Laberinto',
    candidateQuote:'"Llevo bailando esta misma rutina no sé cuántas veces. Hoy la vamos a romper, ¿o de nuevo no?"',
    story:'Llegas a una plaza donde la misma canción suena en bucle. Eco baila la misma coreografía por enésima vez, sonriendo como si fuera la primera. "Lleva atrapada aquí más tiempo del que admite", te dice Ren. "Ayúdala a encontrar la condición de salida antes de que el Bucle Sin Fin la alcance."',
    // Las preguntas, opciones y respuestas viven en la base de datos (servidor).
    // Aquí solo queda el nombre del nivel y el concepto (lo usa la Analítica Docente).
    levels:[
      {name:'Primer ciclo',q:[{concept:'M3 · Iteraciones'}]},
      {name:'Contadores',q:[{concept:'M3 · Variable contador'}]},
      {name:'Bucle infinito',q:[{concept:'M3 · Condición de parada'}]},
      {name:'For vs While',q:[{concept:'M3 · Tipos de bucle'}]},
      {name:'Bucles anidados',q:[{concept:'M3 · Consolidación'}]},
    ],
    boss:{
      name:'El Bucle Sin Fin',
      time:55,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">pest_control</span>',quote:'"...y vuelvo a empezar, y vuelvo a empezar, y vuelvo a empe—"'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
  4:{
    name:'Programación',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">computer</span>',
    color:'#10B981',
    nodo:'Nodo del Taller',
    candidateName:'Forja',
    candidateEmoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">build</span>',
    candidateRole:'Candidata · Nodo del Taller',
    candidateQuote:'"Dame una variable y un plano. Te construyo lo que quieras — pero primero dime exactamente qué necesitas."',
    story:'El Taller retumba con martillazos. Forja suelda un autómata mientras discute planos que parecen mitad dibujo, mitad instrucciones. "Tiene el don crudo de traducir ideas en pasos exactos", dice Ren. "Pero el Chatarrero colecciona código a medio terminar. No dejes que el de ella termine en su carro."',
    // Las preguntas, opciones y respuestas viven en la base de datos (servidor).
    // Aquí solo queda el nombre del nivel y el concepto (lo usa la Analítica Docente).
    levels:[
      {name:'Variables y tipos',q:[{concept:'M4 · Variables'}]},
      {name:'Funciones',q:[{concept:'M4 · Funciones'}]},
      {name:'Parámetros',q:[{concept:'M4 · Parámetros'}]},
      {name:'Traza de código',q:[{concept:'M4 · Traza'}]},
      {name:'Algoritmo completo',q:[{concept:'M4 · Consolidación'}]},
    ],
    boss:{
      name:'El Chatarrero',
      time:65,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">delete</span>',quote:'"Bonito código... lástima que nunca lo optimizaste."'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
  5:{
    name:'Algoritmos',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">psychology</span>',
    color:'#6366F1',
    nodo:'Nodo de la Biblioteca',
    candidateName:'Aria',
    candidateEmoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">psychology</span>',
    candidateRole:'Candidata · Nodo de la Biblioteca',
    candidateQuote:'"No busco LA solución. Busco la solución que menos me cueste encontrar."',
    story:'Entre estanterías infinitas, Aria traza árboles de decisión en silencio absoluto. "Puede calcular el camino más eficiente entre miles de posibilidades", susurra Ren. "El riesgo es la Entropía: la voz que le dice que da lo mismo optimizar o no."',
    // Las preguntas, opciones y respuestas viven en la base de datos (servidor).
    // Aquí solo queda el nombre del nivel y el concepto (lo usa la Analítica Docente).
    levels:[
      {name:'Algoritmo voraz',q:[{concept:'M5 · Greedy'}]},
      {name:'Búsqueda lineal',q:[{concept:'M5 · Búsqueda'}]},
      {name:'Divide y vencerás',q:[{concept:'M5 · Descomposición'}]},
      {name:'Optimización',q:[{concept:'M5 · Eficiencia'}]},
      {name:'Vecino más cercano',q:[{concept:'M5 · Consolidación'}]},
    ],
    boss:{
      name:'La Entropía',
      time:70,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">foggy</span>',quote:'"¿Para qué optimizar, si al final todo se desordena igual?"'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
  6:{
    name:'POO — El Jefe Final',
    icon:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span>',
    color:'#EC4899',
    nodo:'La Ciudadela',
    // Sin candidateName a propósito: este módulo no tiene un candidato
    // que certificar — es la confrontación final contra El Arquitecto.
    story:'Ren se detiene frente a las puertas de la Ciudadela y por primera vez no bromea. "Ahí adentro está el Arquitecto. Fue mi compañero antes de que decidiera que las personas son mejores encapsuladas en un molde perfecto que libres para crecer." Respira hondo. "Los cinco candidatos que certificaste confían en que tú pienses distinto. Vamos a demostrárselo."',
    // Las preguntas, opciones y respuestas viven en la base de datos (servidor).
    // Aquí solo queda el nombre del nivel y el concepto (lo usa la Analítica Docente).
    levels:[
      {name:'Clases y objetos',q:[{concept:'M6 · POO · Clases'}]},
      {name:'Encapsulamiento',q:[{concept:'M6 · POO · Encapsulamiento'}]},
      {name:'Herencia',q:[{concept:'M6 · POO · Herencia'}]},
      {name:'Polimorfismo',q:[{concept:'M6 · POO · Polimorfismo'}]},
      {name:'Abstracción',q:[{concept:'M6 · POO · Abstracción'}]},
    ],
    boss:{
      name:'El Arquitecto',
      time:90,
      centinela:{emoji:'<span class="material-icons" style="font-size: 1em; vertical-align: middle;">emoji_events</span>',role:'Líder de La Estática · Jefe Final',quote:'"Ren cree que cada mente merece crecer libre. Yo creo que cada mente merece un molde perfecto. Solo uno de los dos tiene razón."'},
      numPreguntas:2,   // las preguntas viven en el servidor (tabla preguntas)
    },
  },
};