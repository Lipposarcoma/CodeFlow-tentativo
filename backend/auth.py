import os
from datetime import datetime, timedelta, timezone

import jwt
import psycopg
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from db import conectar

VERSION_TERMINOS = "1.0"          # súbela cuando cambien los T&C
DOMINIO_ESTUDIANTE = "@duocuc.cl"

JWT_SECRET = os.environ["JWT_SECRET"]   # va en el .env, nunca en el código
JWT_ALGORITMO = "HS256"
JWT_HORAS = 8

hasher = PasswordHasher()
# Hash de relleno: se usa cuando el correo no existe, para que login tarde
# lo mismo exista o no el correo (evita adivinar qué correos están registrados).
HASH_RELLENO = hasher.hash("relleno-no-es-una-clave-real")
bearer = HTTPBearer()
router = APIRouter(prefix="/auth", tags=["auth"])


class RegistroIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    correo: EmailStr
    contrasena: str = Field(min_length=8, max_length=128)
    seccion_id: int | None = None
    acepta_terminos: bool
    # OJO: no existe campo "rol". El rol lo decide SOLO el servidor.


@router.post("/registro", status_code=201)
def registro(datos: RegistroIn):
    if not datos.acepta_terminos:
        raise HTTPException(400, "Debes aceptar los términos y condiciones.")

    correo = datos.correo.strip().lower()
    nombre = datos.nombre.strip()

    with conectar() as conn:
        # 1) ¿Está en la lista de docentes autorizados?
        es_docente = conn.execute(
            "SELECT 1 FROM docentes_autorizados WHERE lower(correo) = %s",
            (correo,),
        ).fetchone() is not None

        if es_docente:
            rol, seccion_id = "docente", None
        elif correo.endswith(DOMINIO_ESTUDIANTE):
            rol = "estudiante"
            if datos.seccion_id is None:
                raise HTTPException(400, "Debes elegir tu sección.")
            existe = conn.execute(
                "SELECT 1 FROM secciones WHERE id = %s", (datos.seccion_id,)
            ).fetchone()
            if not existe:
                raise HTTPException(400, "La sección elegida no existe.")
            seccion_id = datos.seccion_id
        else:
            raise HTTPException(
                400, "Solo se permiten correos institucionales (@duocuc.cl)."
            )

        # 2) Guardar usuario (con contraseña hasheada) + aceptación de T&C
        try:
            usuario_id = conn.execute(
                """INSERT INTO usuarios (nombre, correo, hash_contrasena, rol, seccion_id)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (nombre, correo, hasher.hash(datos.contrasena), rol, seccion_id),
            ).fetchone()[0]
            conn.execute(
                """INSERT INTO aceptaciones_terminos (usuario_id, version_terminos)
                   VALUES (%s, %s)""",
                (usuario_id, VERSION_TERMINOS),
            )
        except psycopg.errors.UniqueViolation:
            raise HTTPException(409, "Ese correo ya está registrado.")

    return {"id": usuario_id, "nombre": nombre, "rol": rol}


@router.get("/secciones")
def listar_secciones():
    """Lista pública de secciones (id y nombre) para el formulario de registro."""
    with conectar() as conn:
        filas = conn.execute(
            "SELECT id, nombre FROM secciones ORDER BY nombre"
        ).fetchall()
    return [{"id": f[0], "nombre": f[1]} for f in filas]


# ══════════════════════════════════════════════════════════
# LOGIN
# ══════════════════════════════════════════════════════════
class LoginIn(BaseModel):
    correo: EmailStr
    contrasena: str = Field(min_length=1, max_length=128)


@router.post("/login")
def login(datos: LoginIn):
    correo = datos.correo.strip().lower()

    with conectar() as conn:
        fila = conn.execute(
            """SELECT id, nombre, rol, hash_contrasena
               FROM usuarios WHERE correo = %s""",
            (correo,),
        ).fetchone()

    hash_guardado = fila[3] if fila else HASH_RELLENO
    try:
        hasher.verify(hash_guardado, datos.contrasena)
        clave_ok = True
    except VerifyMismatchError:
        clave_ok = False

    # Mismo mensaje si falla el correo o la clave: no revelamos cuál fue.
    if not fila or not clave_ok:
        raise HTTPException(401, "Correo o contraseña incorrectos.")

    usuario_id, nombre, rol, _ = fila
    token = jwt.encode(
        {
            "sub": str(usuario_id),
            "rol": rol,
            "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_HORAS),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITMO,
    )
    return {
        "token": token,
        "usuario": {"id": usuario_id, "nombre": nombre, "rol": rol},
    }


# ══════════════════════════════════════════════════════════
# PROTECCIÓN DE RUTAS
# ══════════════════════════════════════════════════════════
def usuario_actual(cred: HTTPAuthorizationCredentials = Depends(bearer)):
    """Lee el token, lo valida y devuelve al usuario DESDE LA BASE
    (el rol se toma de la base, no de lo que diga el token)."""
    try:
        datos = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGORITMO])
        usuario_id = int(datos["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Sesión inválida o expirada.")

    with conectar() as conn:
        fila = conn.execute(
            """SELECT id, nombre, correo, rol, seccion_id
               FROM usuarios WHERE id = %s""",
            (usuario_id,),
        ).fetchone()
    if not fila:
        raise HTTPException(401, "Sesión inválida o expirada.")

    return {
        "id": fila[0], "nombre": fila[1], "correo": fila[2],
        "rol": fila[3], "seccion_id": fila[4],
    }


def requiere_rol(*roles):
    """Uso: Depends(requiere_rol("docente")) en cualquier ruta."""
    def comprobar(usuario=Depends(usuario_actual)):
        if usuario["rol"] not in roles:
            raise HTTPException(403, "No tienes permiso para esto.")
        return usuario
    return comprobar


@router.get("/yo")
def yo(usuario=Depends(usuario_actual)):
    """Devuelve quién eres según tu token (el frontend lo usará al cargar)."""
    return usuario

