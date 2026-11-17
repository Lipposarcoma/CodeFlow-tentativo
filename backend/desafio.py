import random

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import usuario_actual
from db import conectar

router = APIRouter(prefix="/desafio", tags=["desafio"])

MAX_INTENTOS_DIA = 3     # respuestas por día (después se cierra hasta mañana)

# "Hoy" siempre según la hora de Chile, no la del servidor.
SQL_HOY = "(now() AT TIME ZONE 'America/Santiago')::date"


def _publico(fila, orden):
    """El desafío tal como lo ve el alumno: SIN la respuesta correcta.
    Las opciones van mezcladas; `orden` dice qué opción original es cada una."""
    did, titulo, desc, modulo, dif, tiempo, xp, texto, opciones = fila
    return {
        "id": did, "titulo": titulo, "descripcion": desc, "modulo": modulo,
        "dificultad": dif, "tiempo": tiempo, "xp": xp, "texto": texto,
        "opciones": [opciones[i] for i in orden],
        "orden": orden,
    }


def _mezclar(n):
    orden = list(range(n))
    random.shuffle(orden)
    return orden


def _estado_hoy(conn, usuario_id):
    """(¿ya acertó hoy?, respuestas dadas hoy, ids de desafíos ya respondidos hoy)"""
    filas = conn.execute(
        f"""SELECT desafio_id, correcta FROM desafios_intentos
            WHERE usuario_id = %s AND fecha = {SQL_HOY}""",
        (usuario_id,),
    ).fetchall()
    return any(c for _, c in filas), len(filas), [d for d, _ in filas]


@router.get("/hoy")
def desafio_de_hoy(usuario=Depends(usuario_actual)):
    """El desafío que le toca al alumno ahora. El primero del día depende de
    la fecha; si ya falló, se entrega otro distinto de los ya intentados."""
    with conectar() as conn:
        completado, usados, ya = _estado_hoy(conn, usuario["id"])
        if completado:
            return {"completado": True, "intentos_restantes": 0, "desafio": None}
        if usados >= MAX_INTENTOS_DIA:
            return {"completado": False, "intentos_restantes": 0, "desafio": None}

        todos = conn.execute(
            f"""SELECT id, titulo, descripcion, modulo, dificultad, tiempo, xp, texto, opciones
                FROM desafios ORDER BY id"""
        ).fetchall()
        if not todos:
            raise HTTPException(404, "Aún no hay desafíos cargados.")
        dow = conn.execute(f"SELECT extract(dow FROM {SQL_HOY})::int").fetchone()[0]

        elegido = todos[dow % len(todos)]
        if elegido[0] in ya:                     # ese ya lo respondió: otro distinto
            libres = [d for d in todos if d[0] not in ya] or todos
            elegido = libres[0]

    return {
        "completado": False,
        "intentos_restantes": MAX_INTENTOS_DIA - usados,
        "desafio": _publico(elegido, _mezclar(len(elegido[8]))),
    }


class RespuestaDesafio(BaseModel):
    desafio_id: int
    opcion: int = Field(ge=0)       # índice ORIGINAL de la opción (el que viene en `orden`)


@router.post("/responder")
def responder_desafio(datos: RespuestaDesafio, usuario=Depends(usuario_actual)):
    with conectar() as conn:
        # Bloquea al alumno mientras se procesa: dos clics a la vez no cobran doble.
        conn.execute("SELECT id FROM usuarios WHERE id = %s FOR UPDATE", (usuario["id"],))

        completado, usados, _ = _estado_hoy(conn, usuario["id"])
        if completado:
            raise HTTPException(409, "Ya completaste el desafío de hoy.")
        if usados >= MAX_INTENTOS_DIA:
            raise HTTPException(409, "Ya usaste tus intentos de hoy. Vuelve mañana.")

        fila = conn.execute(
            "SELECT opciones, correcta, retro_ok, retro_error, xp FROM desafios WHERE id = %s",
            (datos.desafio_id,),
        ).fetchone()
        if not fila:
            raise HTTPException(404, "Desafío no encontrado.")
        opciones, correcta, retro_ok, retro_error, xp = fila
        if datos.opcion >= len(opciones):
            raise HTTPException(400, "Opción inválida.")

        acierto = datos.opcion == correcta
        conn.execute(
            f"""INSERT INTO desafios_intentos (usuario_id, desafio_id, fecha, opcion, correcta)
                VALUES (%s, %s, {SQL_HOY}, %s, %s)""",
            (usuario["id"], datos.desafio_id, datos.opcion, acierto),
        )

        if not acierto:
            return {
                "correcta": False,
                "pista": retro_error,
                "intentos_restantes": MAX_INTENTOS_DIA - usados - 1,
            }

        conn.execute(
            """INSERT INTO xp_movimientos (usuario_id, cantidad, motivo)
               VALUES (%s, %s, %s)""",
            (usuario["id"], xp, f"desafio {datos.desafio_id}"),
        )
        xp_total = conn.execute(
            "SELECT COALESCE(SUM(cantidad), 0) FROM xp_movimientos WHERE usuario_id = %s",
            (usuario["id"],),
        ).fetchone()[0]

    return {"correcta": True, "retro": retro_ok, "xp_ganado": xp, "xp_total": int(xp_total)}
