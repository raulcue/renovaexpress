#!/usr/bin/env bash
# ============================================================================
# Renova Express — build de preview cifrado con StatiCrypt para GitHub Pages
# ----------------------------------------------------------------------------
# Genera la carpeta docs/ con todos los HTML cifrados con contraseña.
# Uso:
#   ./encrypt.sh                   → usa la contraseña por defecto
#   PASSWORD="mipass" ./encrypt.sh → usa una contraseña personalizada
# ============================================================================
set -euo pipefail

PASSWORD="${PASSWORD:-renova2026}"
OUT_DIR="docs"
STAGE_DIR=".staticrypt-stage"

echo ""
echo "🔒 Renova Express — cifrando con StatiCrypt"
echo "    Contraseña: $PASSWORD"
echo "    Salida:     ./$OUT_DIR"
echo ""

# Limpiar artefactos previos
rm -rf "$OUT_DIR" "$STAGE_DIR"
mkdir -p "$OUT_DIR" "$STAGE_DIR"

# 1. Copiar assets y archivos estáticos directamente al destino final
cp -r assets "$OUT_DIR/"
cp sitemap.xml robots.txt "$OUT_DIR/" 2>/dev/null || true

# 2. Construir un staging con solo los HTML, preservando estructura
HTML_FILES=()
while IFS= read -r line; do HTML_FILES+=("$line"); done < <(find . -type f -name "*.html" \
  -not -path "./$OUT_DIR/*" \
  -not -path "./$STAGE_DIR/*" \
  -not -path "./api/*" \
  -not -path "./node_modules/*")

echo "📄 ${#HTML_FILES[@]} archivos HTML detectados, copiando a staging…"
for f in "${HTML_FILES[@]}"; do
  rel="${f#./}"
  mkdir -p "$STAGE_DIR/$(dirname "$rel")"
  cp "$f" "$STAGE_DIR/$rel"
done

# 3. Cifrar recursivo el staging completo → docs/
echo ""
echo "🔐 Cifrando…"
npx -y staticrypt "$STAGE_DIR" \
  --recursive \
  --password "$PASSWORD" \
  --directory "$OUT_DIR" \
  --remember 365 \
  --short \
  --template-title       "Renova Express · Acceso privado" \
  --template-color-primary   "#007E85" \
  --template-color-secondary "#143036" \
  --template-button      "Acceder" \
  --template-placeholder "Contraseña" \
  --template-remember    "Recordarme en este dispositivo" \
  --template-error       "Contraseña incorrecta" \
  --template-instructions "Vista previa privada de la nueva web de Renova Express. Solicita la contraseña al equipo del proyecto." \
  > /dev/null

# 4. StatiCrypt anida bajo $STAGE_DIR; lo aplanamos
if [ -d "$OUT_DIR/$STAGE_DIR" ]; then
  cp -R "$OUT_DIR/$STAGE_DIR/." "$OUT_DIR/"
  rm -rf "$OUT_DIR/$STAGE_DIR"
fi

# 5. Limpiar staging
rm -rf "$STAGE_DIR"

echo ""
echo "✅ Build cifrado en $OUT_DIR/"
echo "📂 Estructura:"
find "$OUT_DIR" -name "*.html" -maxdepth 3 | sort | head -30
echo ""
echo "Próximos pasos:"
echo "  git add docs encrypt.sh .gitignore"
echo "  git commit -m 'Build StatiCrypt $(date +%Y-%m-%d)'"
echo "  git push"
echo ""
echo "Después: en GitHub → Settings → Pages → Source: main → Folder: /docs"
