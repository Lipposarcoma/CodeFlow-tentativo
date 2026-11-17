import json
import re
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field

from auth import usuario_actual
from db import conectar

router = APIRouter(prefix="/accesibilidad", tags=["accesibilidad"])

COLOR_HEX = re.compile(r"#[0-9a-fA-F]{6}")


class ColoresPropios(BaseModel):
    fondo: str
    texto: str
    acento: str


class AccesibilidadIn(BaseModel):
    texto: int = Field(default=100, ge=80, le=160)        # % del tamaño de letra
    botones: int = Field(default=100, ge=100, le=150)     # % del tamaño de controles
    fuente: Literal["defecto", "legible", "dislexia"] = "defecto"
    espaciado: Literal["normal", "amplio", "muy_amplio"] = "normal"
    paleta: Literal["original", "alto", "calido", "daltonismo", "propia"] = "original"
    propia: Optional[ColoresPropios] = None               # colores de "Configuración propia"
    sin_movimiento: bool = False
    foco: bool = False


@router.get("")
def leer_preferencias(usuario=Depends(usuario_actual)):
    """Devuelve la configuración guardada del usuario (o null si nunca guardó)."""
    with conectar() as conn:
        fila = conn.execute(
            "SELECT config FROM preferencias_accesibilidad WHERE usuario_id = %s",
            (usuario["id"],),
        ).fetchone()
    return {"config": fila[0] if fila else None}


@router.post("")
def guardar_preferencias(datos: AccesibilidadIn, usuario=Depends(usuario_actual)):
    """Guarda (o reemplaza) la configuración del usuario."""
    if datos.propia is not None:
        for color in (datos.propia.fondo, datos.propia.texto, datos.propia.acento):
            if not COLOR_HEX.fullmatch(color):
                raise HTTPException(400, "Los colores deben tener el formato #RRGGBB.")
    if datos.paleta == "propia" and datos.propia is None:
        raise HTTPException(400, "Falta definir los colores de la configuración propia.")

    config = jsonable_encoder(datos)
    with conectar() as conn:
        conn.execute(
            """INSERT INTO preferencias_accesibilidad (usuario_id, config)
               VALUES (%s, %s::jsonb)
               ON CONFLICT (usuario_id) DO UPDATE
               SET config = EXCLUDED.config, actualizado_en = now()""",
            (usuario["id"], json.dumps(config)),
        )
    return {"config": config}
