import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from auth import requiere_rol
from db import conectar

router = APIRouter(prefix="/docente", tags=["docente"])

MIN_RESPUESTAS_TOP = 5   # para entrar al Top hay que haber respondido al menos esto
LIMITE_TOP = 5

# Una consulta trae a los alumnos de las secciones del docente, con su
# progreso, sus aciertos y su XP. "%s::int IS NULL" permite pedir una
# sección en particular o todas las suyas.
SQL_ALUMNOS = """
WITH total AS (
  SELECT count(*) AS n FROM (SELECT DISTINCT modulo, nivel FROM preguntas) t
), prog AS (
  SELECT usuario_id, count(*) AS hechos
  FROM progreso_nivel WHERE mejor_resultado > 0 GROUP BY usuario_id
), act AS (
  SELECT usuario_id,
         count(*) AS respuestas,
         count(*) FILTER (WHERE correcta) AS aciertos,
         max(creado_en) AS ultima
  FROM intentos GROUP BY usuario_id
), xp AS (
  SELECT usuario_id, SUM(cantidad) AS xp FROM xp_movimientos GROUP BY usuario_id
)
SELECT u.id, u.nombre, u.correo, s.nombre,
       COALESCE(prog.hechos, 0), (SELECT n FROM total),
       COALESCE(act.respuestas, 0), COALESCE(act.aciertos, 0), act.ultima,
       COALESCE(xp.xp, 0)
FROM usuarios u
JOIN secciones s ON s.id = u.seccion_id
LEFT JOIN prog ON prog.usuario_id = u.id
LEFT JOIN act  ON act.usuario_id  = u.id
LEFT JOIN xp   ON xp.usuario_id   = u.id
WHERE u.rol = 'estudiante'
  AND s.docente_id = %s
  AND (%s::int IS NULL OR s.id = %s)
ORDER BY s.nombre, u.nombre
"""


def validar_seccion(conn, docente_id: int, seccion_id: int | None):
    """Si pide una sección en particular, tiene que ser suya."""
    if seccion_id is not None:
        propia = conn.execute(
            "SELECT 1 FROM secciones WHERE id = %s AND docente_id = %s",
            (seccion_id, docente_id),
        ).fetchone()
        if not propia:
            raise HTTPException(403, "Esa sección no es tuya.")


def leer_alumnos(conn, docente_id: int, seccion_id: int | None):
    """Alumnos de las secciones del docente (todas, o solo una)."""
    validar_seccion(conn, docente_id, seccion_id)

    filas = conn.execute(SQL_ALUMNOS, (docente_id, seccion_id, seccion_id)).fetchall()

    alumnos = []
    for uid, nombre, correo, seccion, hechos, total, respuestas, aciertos, ultima, xp in filas:
        ratio = aciertos / respuestas if respuestas else None
        pct_aciertos = round(ratio * 100) if ratio is not None else None
        alumnos.append({
            "id": uid,
            "nombre": nombre,
            "correo": correo,
            "seccion": seccion,
            "progreso": min(100, round(hechos * 100 / total)) if total else 0,
            "niveles_hechos": hechos,
            "niveles_totales": total,
            "respuestas": respuestas,
            "aciertos": pct_aciertos,                                  # % de respuestas correctas
            "fallos": 100 - pct_aciertos if pct_aciertos is not None else None,
            "xp": int(xp),
            "ultima_actividad": ultima.isoformat() if ultima else None,
            "_ratio": ratio,
        })
    return alumnos


# ══════════════════════════════════════════════════════════
# SECCIONES DEL DOCENTE
# ══════════════════════════════════════════════════════════
@router.get("/secciones")
def mis_secciones(docente=Depends(requiere_rol("docente"))):
    """Las secciones que tiene asignadas este docente, con su cantidad de alumnos."""
    with conectar() as conn:
        filas = conn.execute(
            """SELECT s.id, s.nombre, count(u.id)
               FROM secciones s
               LEFT JOIN usuarios u ON u.seccion_id = s.id AND u.rol = 'estudiante'
               WHERE s.docente_id = %s
               GROUP BY s.id, s.nombre
               ORDER BY s.nombre""",
            (docente["id"],),
        ).fetchall()
    return [{"id": i, "nombre": n, "alumnos": a} for i, n, a in filas]


# ══════════════════════════════════════════════════════════
# ALUMNOS (lista con progreso individual)
# ══════════════════════════════════════════════════════════
@router.get("/alumnos")
def alumnos(seccion_id: int | None = None, docente=Depends(requiere_rol("docente"))):
    with conectar() as conn:
        lista = leer_alumnos(conn, docente["id"], seccion_id)
    for a in lista:
        a.pop("_ratio")
    return lista


# ══════════════════════════════════════════════════════════
# TOP (mejores alumnos por porcentaje de aciertos)
# ══════════════════════════════════════════════════════════
@router.get("/top")
def top(
    seccion_id: int | None = None,
    limite: int = Query(LIMITE_TOP, ge=1, le=20),
    docente=Depends(requiere_rol("docente")),
):
    """Mejores alumnos por % de aciertos. Para evitar que gane quien respondió
    una sola vez, hay que tener al menos MIN_RESPUESTAS_TOP respuestas.
    Si empatan en aciertos: gana el de más progreso, luego el de más respuestas."""
    with conectar() as conn:
        lista = leer_alumnos(conn, docente["id"], seccion_id)

    candidatos = [a for a in lista if a["respuestas"] >= MIN_RESPUESTAS_TOP]
    candidatos.sort(key=lambda a: (-a["_ratio"], -a["progreso"], -a["respuestas"]))

    ranking = []
    for puesto, a in enumerate(candidatos[:limite], start=1):
        a.pop("_ratio")
        ranking.append({"puesto": puesto, **a})
    return {"minimo_respuestas": MIN_RESPUESTAS_TOP, "alumnos": ranking}


# ══════════════════════════════════════════════════════════
# ANALÍTICA (agregados de la sección: tarjetas y gráficos)
# ══════════════════════════════════════════════════════════
# "al" = los alumnos de las secciones del docente (todas o una sola).
CTE_AL = """
WITH al AS (
  SELECT u.id, u.nombre
  FROM usuarios u JOIN secciones s ON s.id = u.seccion_id
  WHERE u.rol = 'estudiante' AND s.docente_id = %(d)s
    AND (%(s)s::int IS NULL OR s.id = %(s)s)
)
"""


@router.get("/analitica")
def analitica(seccion_id: int | None = None, docente=Depends(requiere_rol("docente"))):
    prm = {"d": docente["id"], "s": seccion_id}
    with conectar() as conn:
        validar_seccion(conn, docente["id"], seccion_id)

        alumnos = conn.execute(CTE_AL + "SELECT count(*) FROM al", prm).fetchone()[0]

        # niveles posibles por módulo (5 niveles + jefe = 6)
        posibles = dict(conn.execute(
            "SELECT modulo, count(DISTINCT nivel) FROM preguntas GROUP BY modulo"
        ).fetchall())

        hechos = conn.execute(
            CTE_AL + """SELECT p.modulo, p.nivel, count(*)
                        FROM progreso_nivel p JOIN al ON al.id = p.usuario_id
                        WHERE p.mejor_resultado > 0 GROUP BY p.modulo, p.nivel""", prm
        ).fetchall()

        por_nivel = conn.execute(
            CTE_AL + """SELECT i.modulo, i.nivel, count(*),
                               count(*) FILTER (WHERE NOT i.correcta)
                        FROM intentos i JOIN al ON al.id = i.usuario_id
                        GROUP BY i.modulo, i.nivel""", prm
        ).fetchall()

        activos = conn.execute(
            CTE_AL + """SELECT count(DISTINCT i.usuario_id)
                        FROM intentos i JOIN al ON al.id = i.usuario_id
                        WHERE i.creado_en > now() - interval '7 days'""", prm
        ).fetchone()[0]

        # racha más larga de aciertos seguidos de un mismo alumno
        racha = conn.execute(
            CTE_AL + """SELECT COALESCE(max(n), 0) FROM (
                          SELECT count(*) FILTER (WHERE correcta) AS n
                          FROM (
                            SELECT i.usuario_id, i.correcta,
                                   sum((NOT i.correcta)::int) OVER (
                                     PARTITION BY i.usuario_id ORDER BY i.creado_en, i.id) AS grp
                            FROM intentos i JOIN al ON al.id = i.usuario_id
                          ) t GROUP BY usuario_id, grp
                        ) r""", prm
        ).fetchone()[0]

        dificiles = conn.execute(
            CTE_AL + """SELECT q.modulo, q.nivel, q.concepto, count(*),
                               count(*) FILTER (WHERE NOT i.correcta) AS errores
                        FROM intentos i
                        JOIN al ON al.id = i.usuario_id
                        JOIN preguntas q ON q.id = i.pregunta_id
                        GROUP BY q.id, q.modulo, q.nivel, q.concepto
                        HAVING count(*) FILTER (WHERE NOT i.correcta) > 0
                        ORDER BY (count(*) FILTER (WHERE NOT i.correcta))::float / count(*) DESC,
                                 count(*) DESC
                        LIMIT 7""", prm
        ).fetchall()

        recientes = conn.execute(
            CTE_AL + """SELECT al.nombre, i.modulo, i.nivel, q.concepto, i.correcta, i.creado_en
                        FROM intentos i
                        JOIN al ON al.id = i.usuario_id
                        LEFT JOIN preguntas q ON q.id = i.pregunta_id
                        ORDER BY i.creado_en DESC, i.id DESC
                        LIMIT 15""", prm
        ).fetchall()

    # ── se arma la respuesta ──
    modulos = {
        m: {"modulo": m, "niveles_hechos": 0, "niveles_posibles": alumnos * n,
            "jefes": 0, "intentos": 0, "errores": 0,
            "niveles": {k: 0 for k in range(1, n + 1)}}
        for m, n in sorted(posibles.items())
    }
    for m, n, c in hechos:
        if m in modulos:
            modulos[m]["niveles_hechos"] += c
            if n == 6:
                modulos[m]["jefes"] += c
    for m, n, tot, err in por_nivel:
        if m in modulos:
            modulos[m]["intentos"] += tot
            modulos[m]["errores"] += err
            modulos[m]["niveles"][n] = modulos[m]["niveles"].get(n, 0) + err

    intentos = sum(x["intentos"] for x in modulos.values())
    errores = sum(x["errores"] for x in modulos.values())
    ultimas = [bool(r[4]) for r in reversed(recientes[:10])]   # de la más antigua a la más reciente

    return {
        "alumnos": alumnos,
        "activos_7d": activos,
        "respuestas": intentos,
        "aciertos": intentos - errores,
        "errores": errores,
        "racha_max": racha,
        "niveles_hechos": sum(x["niveles_hechos"] for x in modulos.values()),
        "niveles_posibles": sum(x["niveles_posibles"] for x in modulos.values()),
        "modulos": [
            {**x, "niveles": [{"nivel": k, "errores": v} for k, v in x["niveles"].items()]}
            for x in modulos.values()
        ],
        "preguntas_dificiles": [
            {"modulo": m, "nivel": n, "concepto": c, "intentos": t, "errores": e}
            for m, n, c, t, e in dificiles
        ],
        "ultimas": ultimas,
        "historial": [
            {"alumno": nom, "modulo": m, "nivel": n, "concepto": c,
             "correcta": ok, "fecha": f.isoformat()}
            for nom, m, n, c, ok, f in recientes
        ],
    }


# ══════════════════════════════════════════════════════════
# EXPORTAR (CSV para Power BI / Tableau, sin nombres ni correos)
# ══════════════════════════════════════════════════════════
@router.get("/exportar")
def exportar(seccion_id: int | None = None, docente=Depends(requiere_rol("docente"))):
    prm = {"d": docente["id"], "s": seccion_id}
    with conectar() as conn:
        validar_seccion(conn, docente["id"], seccion_id)
        filas = conn.execute(
            """SELECT s.nombre, u.id, i.modulo, i.nivel, q.concepto, i.es_boss, i.correcta, i.creado_en
               FROM intentos i
               JOIN usuarios u ON u.id = i.usuario_id
               JOIN secciones s ON s.id = u.seccion_id
               LEFT JOIN preguntas q ON q.id = i.pregunta_id
               WHERE u.rol = 'estudiante' AND s.docente_id = %(d)s
                 AND (%(s)s::int IS NULL OR s.id = %(s)s)
               ORDER BY i.creado_en""", prm
        ).fetchall()

    def seguro(v):
        # evita que Excel interprete un texto como fórmula
        v = "" if v is None else str(v)
        return "'" + v if v[:1] in ("=", "+", "-", "@") else v

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["seccion", "alumno_id", "modulo", "nivel", "concepto",
                "es_boss", "es_correcta", "fecha_iso"])
    for sec, uid, m, n, c, boss, ok, f in filas:
        w.writerow([seguro(sec), uid, m, n, seguro(c), boss, ok, f.isoformat()])

    return Response(
        content="\ufeff" + buf.getvalue(),       # BOM: Excel respeta las tildes
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="codeflow_dataset.csv"'},
    )