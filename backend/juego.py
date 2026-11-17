import json
import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import usuario_actual
from db import conectar

router = APIRouter(prefix="/juego", tags=["juego"])

NIVEL_JEFE = 6                 # en la base, el Boss Fight es el "nivel 6"
NIVELES_NORMALES = 5           # niveles 1 al 5
XP_POR_ESTRELLA = 20           # se paga solo por MEJORAR las estrellas
XP_POR_PREGUNTA_JEFE = 40      # solo la primera vez que se vence al jefe
GRACIA_SEGUNDOS = 3            # margen por lo que tarda la red

# Tiempo límite del jefe por módulo (segundos). Debe coincidir con lo que
# se muestra en lacaceria-datos.js (boss.time).
TIEMPO_JEFE = {1: 60, 2: 60, 3: 55, 4: 65, 5: 70, 6: 90}


def estrellas_segun_errores(errores: int) -> int:
    return 3 if errores == 0 else 2 if errores <= 1 else 1


# ══════════════════════════════════════════════════════════
# PROGRESO (lo que el navegador pinta al entrar)
# ══════════════════════════════════════════════════════════
@router.get("/progreso")
def progreso(usuario=Depends(usuario_actual)):
    with conectar() as conn:
        xp_total = conn.execute(
            "SELECT COALESCE(SUM(cantidad), 0) FROM xp_movimientos WHERE usuario_id = %s",
            (usuario["id"],),
        ).fetchone()[0]
        filas = conn.execute(
            """SELECT modulo, nivel, mejor_resultado
               FROM progreso_nivel
               WHERE usuario_id = %s AND mejor_resultado > 0""",
            (usuario["id"],),
        ).fetchall()

        # Racha: aciertos seguidos. La actual cuenta desde la última respuesta
        # hacia atrás; la máxima es la mejor racha de toda la historia.
        racha_actual, racha_max = conn.execute(
            """WITH t AS (
                 SELECT correcta,
                        sum((NOT correcta)::int) OVER (ORDER BY creado_en, id) AS grp,
                        row_number() OVER (ORDER BY creado_en DESC, id DESC) AS rn
                 FROM intentos WHERE usuario_id = %s
               ), g AS (
                 SELECT grp, count(*) FILTER (WHERE correcta) AS n FROM t GROUP BY grp
               )
               SELECT
                 COALESCE((SELECT count(*) FROM t
                           WHERE rn <= COALESCE((SELECT min(rn) FROM t WHERE NOT correcta) - 1,
                                                (SELECT count(*) FROM t))), 0),
                 COALESCE((SELECT max(n) FROM g), 0)""",
            (usuario["id"],),
        ).fetchone()

        perfil = conn.execute(
            "SELECT tipo, puntajes FROM perfil_aprendizaje WHERE usuario_id = %s",
            (usuario["id"],),
        ).fetchone()

    return {
        "racha": int(racha_actual),
        "racha_max": int(racha_max),
        "perfil": {"tipo": perfil[0], "puntajes": perfil[1]} if perfil else None,
        "xp_total": int(xp_total),
        "niveles": [
            {"modulo": m, "nivel": n, "estrellas": e}
            for m, n, e in filas if n != NIVEL_JEFE
        ],
        "jefes": [m for m, n, _ in filas if n == NIVEL_JEFE],
    }


# ══════════════════════════════════════════════════════════
# EMPEZAR UN NIVEL O UN JEFE
# ══════════════════════════════════════════════════════════
class PartidaIn(BaseModel):
    modulo: int = Field(ge=1, le=6)
    nivel: int = Field(ge=1, le=6)


@router.post("/partidas", status_code=201)
def empezar_partida(datos: PartidaIn, usuario=Depends(usuario_actual)):
    """Abre una partida y entrega las preguntas SIN la respuesta correcta."""
    es_jefe = datos.nivel == NIVEL_JEFE

    with conectar() as conn:
        preguntas = conn.execute(
            """SELECT id, concepto, texto, opciones
               FROM preguntas
               WHERE modulo = %s AND nivel = %s
               ORDER BY orden""",
            (datos.modulo, datos.nivel),
        ).fetchall()
        if not preguntas:
            raise HTTPException(404, "Ese nivel aún no está disponible en el servidor.")

        # Reglas de desbloqueo: las manda el servidor, no la pantalla.
        hechos = {
            n for (n,) in conn.execute(
                """SELECT nivel FROM progreso_nivel
                   WHERE usuario_id = %s AND modulo = %s AND mejor_resultado > 0""",
                (usuario["id"], datos.modulo),
            ).fetchall()
        }
        if es_jefe:
            if not all(n in hechos for n in range(1, NIVELES_NORMALES + 1)):
                raise HTTPException(403, "Primero completa todos los niveles del módulo.")
        elif datos.nivel > 1 and (datos.nivel - 1) not in hechos:
            raise HTTPException(403, "Primero completa el nivel anterior.")

        # Si había una partida a medias en este mismo nivel, se descarta.
        conn.execute(
            """UPDATE partidas SET estado = 'abandonada', terminada_en = now()
               WHERE usuario_id = %s AND modulo = %s AND nivel = %s
                 AND estado = 'en_curso'""",
            (usuario["id"], datos.modulo, datos.nivel),
        )
        partida_id = conn.execute(
            """INSERT INTO partidas (usuario_id, modulo, nivel)
               VALUES (%s, %s, %s) RETURNING id""",
            (usuario["id"], datos.modulo, datos.nivel),
        ).fetchone()[0]

    # Las opciones se mezclan en cada partida para que la correcta no caiga
    # siempre en el mismo lugar. `orden[k]` = posición ORIGINAL de la opción
    # que se muestra en el lugar k; el navegador la devuelve al responder,
    # así el servidor corrige igual que siempre y no guarda nada extra.
    entregadas = []
    for pid, concepto, texto, opciones in preguntas:
        orden = list(range(len(opciones)))
        random.shuffle(orden)
        entregadas.append({
            "id": pid, "concepto": concepto, "texto": texto,
            "opciones": [opciones[i] for i in orden],
            "orden": orden,
        })

    return {
        "partida_id": partida_id,
        "tiempo_limite": TIEMPO_JEFE.get(datos.modulo) if es_jefe else None,
        "preguntas": entregadas,
    }


# ══════════════════════════════════════════════════════════
# RESPONDER
# ══════════════════════════════════════════════════════════
class RespuestaIn(BaseModel):
    pregunta_id: int
    opcion: int = Field(ge=0)


@router.post("/partidas/{partida_id}/responder")
def responder(partida_id: int, datos: RespuestaIn, usuario=Depends(usuario_actual)):
    with conectar() as conn:
        # FOR UPDATE: si llegan dos respuestas a la vez, se atienden una
        # tras otra (evita pagar el XP dos veces).
        partida = conn.execute(
            """SELECT modulo, nivel, estado, errores,
                      EXTRACT(EPOCH FROM (now() - iniciada_en))
               FROM partidas
               WHERE id = %s AND usuario_id = %s
               FOR UPDATE""",
            (partida_id, usuario["id"]),
        ).fetchone()
        if not partida:
            raise HTTPException(404, "Partida no encontrada.")
        modulo, nivel, estado, errores, segundos = partida
        es_jefe = nivel == NIVEL_JEFE

        if estado != "en_curso":
            raise HTTPException(409, "Esta partida ya terminó.")

        # Tiempo del jefe: lo mide el servidor.
        if es_jefe and segundos > TIEMPO_JEFE.get(modulo, 0) + GRACIA_SEGUNDOS:
            conn.execute(
                "UPDATE partidas SET estado = 'expirada', terminada_en = now() WHERE id = %s",
                (partida_id,),
            )
            return {"estado": "expirada", "errores": errores}

        pregunta = conn.execute(
            """SELECT orden, opciones, correcta, retro_ok, retro_error
               FROM preguntas
               WHERE id = %s AND modulo = %s AND nivel = %s""",
            (datos.pregunta_id, modulo, nivel),
        ).fetchone()
        if not pregunta:
            raise HTTPException(400, "Esa pregunta no pertenece a este nivel.")
        orden, opciones, correcta, retro_ok, retro_error = pregunta

        if datos.opcion >= len(opciones):
            raise HTTPException(400, "Opción inválida.")

        ya_acertada = conn.execute(
            """SELECT 1 FROM intentos
               WHERE partida_id = %s AND pregunta_id = %s AND correcta""",
            (partida_id, datos.pregunta_id),
        ).fetchone()
        if ya_acertada:
            raise HTTPException(409, "Ya acertaste esta pregunta.")

        acierto = datos.opcion == correcta
        conn.execute(
            """INSERT INTO intentos
                 (usuario_id, modulo, nivel, pregunta, es_boss, correcta,
                  partida_id, pregunta_id, opcion)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (usuario["id"], modulo, nivel, orden, es_jefe, acierto,
             partida_id, datos.pregunta_id, datos.opcion),
        )

        if not acierto:
            conn.execute(
                "UPDATE partidas SET errores = errores + 1 WHERE id = %s", (partida_id,)
            )
            # OJO: no se dice cuál era la correcta, solo la pista.
            return {"correcta": False, "pista": retro_error, "completado": False}

        # ¿Ya acertó todas las preguntas de este nivel?
        total = conn.execute(
            "SELECT count(*) FROM preguntas WHERE modulo = %s AND nivel = %s",
            (modulo, nivel),
        ).fetchone()[0]
        acertadas = conn.execute(
            """SELECT count(DISTINCT pregunta_id) FROM intentos
               WHERE partida_id = %s AND correcta""",
            (partida_id,),
        ).fetchone()[0]
        if acertadas < total:
            return {"correcta": True, "retro": retro_ok, "completado": False}

        # ── Nivel o jefe terminado: se calcula todo aquí ──
        previo = conn.execute(
            """SELECT mejor_resultado FROM progreso_nivel
               WHERE usuario_id = %s AND modulo = %s AND nivel = %s""",
            (usuario["id"], modulo, nivel),
        ).fetchone()
        previo = previo[0] if previo else 0

        if es_jefe:
            estrellas = 3
            xp_ganado = total * XP_POR_PREGUNTA_JEFE if previo == 0 else 0
            motivo = f"boss {modulo}"
        else:
            estrellas = estrellas_segun_errores(errores)
            xp_ganado = (estrellas - previo) * XP_POR_ESTRELLA if estrellas > previo else 0
            motivo = f"nivel {modulo}-{nivel}"

        if xp_ganado > 0:
            conn.execute(
                "INSERT INTO xp_movimientos (usuario_id, cantidad, motivo) VALUES (%s, %s, %s)",
                (usuario["id"], xp_ganado, motivo),
            )
        conn.execute(
            """INSERT INTO progreso_nivel (usuario_id, modulo, nivel, mejor_resultado)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (usuario_id, modulo, nivel) DO UPDATE
               SET mejor_resultado = GREATEST(progreso_nivel.mejor_resultado, EXCLUDED.mejor_resultado),
                   actualizado_en = now()""",
            (usuario["id"], modulo, nivel, estrellas),
        )
        conn.execute(
            "UPDATE partidas SET estado = 'completada', terminada_en = now() WHERE id = %s",
            (partida_id,),
        )

        xp_total = conn.execute(
            "SELECT COALESCE(SUM(cantidad), 0) FROM xp_movimientos WHERE usuario_id = %s",
            (usuario["id"],),
        ).fetchone()[0]
        niveles_hechos = conn.execute(
            """SELECT count(*) FROM progreso_nivel
               WHERE usuario_id = %s AND modulo = %s AND nivel <= %s AND mejor_resultado > 0""",
            (usuario["id"], modulo, NIVELES_NORMALES),
        ).fetchone()[0]

    return {
        "correcta": True,
        "retro": retro_ok,
        "completado": True,
        "estrellas": estrellas,
        "errores": errores,
        "xp_ganado": xp_ganado,
        "xp_total": int(xp_total),
        "modulo_completo": niveles_hechos >= NIVELES_NORMALES,
    }


# ══════════════════════════════════════════════════════════
# PERFIL DE APRENDIZAJE (resultado del cuestionario del Hub)
# ══════════════════════════════════════════════════════════
PREGUNTAS_HUB = 5
TIPOS_HUB = ("logic", "visual", "action")     # en caso de empate gana el primero


class PerfilIn(BaseModel):
    logic: int = Field(ge=0, le=PREGUNTAS_HUB)
    visual: int = Field(ge=0, le=PREGUNTAS_HUB)
    action: int = Field(ge=0, le=PREGUNTAS_HUB)


@router.post("/perfil")
def guardar_perfil(datos: PerfilIn, usuario=Depends(usuario_actual)):
    """Guarda el resultado del cuestionario. El tipo lo calcula el servidor."""
    puntajes = {"logic": datos.logic, "visual": datos.visual, "action": datos.action}
    if sum(puntajes.values()) != PREGUNTAS_HUB:
        raise HTTPException(400, "Los puntajes no corresponden al cuestionario.")
    tipo = max(TIPOS_HUB, key=lambda k: (puntajes[k], -TIPOS_HUB.index(k)))

    with conectar() as conn:
        conn.execute(
            """INSERT INTO perfil_aprendizaje (usuario_id, tipo, puntajes)
               VALUES (%s, %s, %s::jsonb)
               ON CONFLICT (usuario_id) DO UPDATE
               SET tipo = EXCLUDED.tipo, puntajes = EXCLUDED.puntajes,
                   actualizado_en = now()""",
            (usuario["id"], tipo, json.dumps(puntajes)),
        )
    return {"tipo": tipo, "puntajes": puntajes}