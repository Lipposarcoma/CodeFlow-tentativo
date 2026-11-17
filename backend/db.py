import os

from dotenv import load_dotenv
from psycopg_pool import ConnectionPool

load_dotenv()

# Pool de conexiones: se abren una vez y se REUTILIZAN en cada petición.
# Conectarse a Neon desde cero cuesta varios viajes por internet; con el
# pool eso se paga solo al arrancar el servidor.
#   - check: antes de prestar una conexión comprueba que siga viva (Neon
#     corta las conexiones cuando suspende la base por inactividad).
#   - max_idle: cierra las que llevan 4 minutos sin usarse.
pool = ConnectionPool(
    os.environ["DATABASE_URL"],
    min_size=1,
    max_size=5,
    max_idle=240,
    check=ConnectionPool.check_connection,
    open=False,            # se abre en main.py al arrancar el servidor
)


def abrir_pool():
    pool.open(wait=True, timeout=30)


def cerrar_pool():
    pool.close()


def conectar():
    """Presta una conexión del pool. Se usa igual que antes:
    `with conectar() as conn:` (al salir sin errores guarda los cambios;
    con error los deshace, y la conexión vuelve al pool)."""
    return pool.connection()