#!/usr/bin/env python3
"""
Prepara el sitio para el control "Tamaño del texto" del panel de accesibilidad.

Qué hace: en todos los .css de la carpeta que le indiques, cambia
    font-size: 13px;      ->   font-size: calc(13px * var(--a11y-fs, 1));
y hace lo mismo con los font-size en px escritos en línea (style="..." y
estilos creados desde JavaScript) dentro de los .html y .js.
Sin esto, el slider de texto no cambia las letras que están fijas en px.

Es seguro repetirlo: lo que ya está convertido no se toca.
Antes de cambiar nada muestra un resumen; con --aplicar escribe los cambios.

Uso (desde la carpeta del proyecto):
    python convertir_css_accesibilidad.py codigo_rehecho            # solo muestra
    python convertir_css_accesibilidad.py codigo_rehecho --aplicar  # aplica
"""
import re
import sys
from pathlib import Path

# font-size:13px  /  font-size: 13.5px  (con o sin !important). No toca em/rem/%/calc.
PATRON = re.compile(r"(font-size\s*:\s*)(\d+(?:\.\d+)?)px(\s*!important)?", re.IGNORECASE)
EXTENSIONES = {".css", ".html", ".js"}
IGNORAR = {"node_modules", ".git", "venv", "__pycache__"}
NO_TOCAR = {"accesibilidad.css", "accesibilidad.js"}   # estos ya manejan la escala solos


def convertir(texto):
    n = 0

    def cambiar(m):
        nonlocal n
        n += 1
        return f"{m.group(1)}calc({m.group(2)}px * var(--a11y-fs, 1)){m.group(3) or ''}"

    return PATRON.sub(cambiar, texto), n


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    aplicar = "--aplicar" in sys.argv
    if not args:
        print(__doc__)
        sys.exit(1)

    raiz = Path(args[0])
    if not raiz.is_dir():
        print(f"No encuentro la carpeta: {raiz}")
        sys.exit(1)

    total = 0
    archivos = 0
    for ruta in sorted(raiz.rglob("*")):
        if (not ruta.is_file() or ruta.suffix.lower() not in EXTENSIONES
                or ruta.name in NO_TOCAR or IGNORAR & set(ruta.parts)):
            continue
        try:
            original = ruta.read_bytes().decode("utf-8")
        except UnicodeDecodeError:
            print(f"  (salto {ruta}: no es UTF-8)")
            continue
        nuevo, n = convertir(original)
        if n == 0:
            continue
        archivos += 1
        total += n
        print(f"  {ruta}: {n} cambios")
        if aplicar:
            ruta.write_bytes(nuevo.encode("utf-8"))   # conserva los saltos de línea

    if total == 0:
        print("Nada que convertir: todo está listo.")
    elif aplicar:
        print(f"\nListo: {total} font-size convertidos en {archivos} archivos.")
    else:
        print(f"\nHabría {total} cambios en {archivos} archivos. Repite con --aplicar para hacerlos.")


if __name__ == "__main__":
    main()
