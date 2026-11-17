import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from accesibilidad import router as accesibilidad_router
from auth import router as auth_router
from db import abrir_pool, cerrar_pool, conectar
from desafio import router as desafio_router
from docente import router as docente_router
from juego import router as juego_router


@asynccontextmanager
async def ciclo_de_vida(app):
    abrir_pool()       # abre las conexiones a la base una sola vez, al arrancar
    yield
    cerrar_pool()      # y las cierra al apagar el servidor


app = FastAPI(title="CodeFlow API", lifespan=ciclo_de_vida)

# CORS: permite que el frontend (Live Server) le hable al backend.
# Solo se aceptan estos orígenes. Si tu Live Server usa otro puerto,
# agrégalo en el .env:  CORS_ORIGINS=http://127.0.0.1:5500,http://127.0.0.1:5501
ORIGENES = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500"
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(juego_router)
app.include_router(docente_router)
app.include_router(desafio_router)
app.include_router(accesibilidad_router)


@app.get("/")
def raiz():
    return {"mensaje": "CodeFlow API funcionando"}


@app.get("/db-test")
def db_test():
    with conectar() as conn:
        total = conn.execute("SELECT count(*) FROM secciones").fetchone()[0]
    return {"conexion": "ok", "secciones": total}