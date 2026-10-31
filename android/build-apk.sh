#!/usr/bin/env bash
# Arma la APK de LB METHOD sin Android Studio, con las herramientas de Ubuntu:
#   sudo apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 openjdk-21-jdk-headless
# Uso:
#   LB_KEYSTORE=/ruta/lbmethod.keystore LB_KEYSTORE_PASS=... android/build-apk.sh https://lbmethod1-0.<subdominio>.workers.dev
# Resultado: frontend/public/descargar/lbmethod.apk (el Worker la sirve en /descargar/lbmethod.apk).
#
# La llave de firma (keystore) NO va en Git. Guárdala: Android solo acepta actualizaciones firmadas con la misma llave.
# Si no existe, este script crea una nueva en la ruta de LB_KEYSTORE.
set -euo pipefail

URL="${1:?Indica el link de la app, por ejemplo https://lbmethod1-0.tu-subdominio.workers.dev}"
URL="${URL%/}"
[[ "$URL" =~ ^https://[a-z0-9.-]+$ ]] || { echo "El link debe empezar con https:// y no llevar ruta." >&2; exit 1; }
: "${LB_KEYSTORE:?Indica la ruta de la llave de firma en LB_KEYSTORE}"
: "${LB_KEYSTORE_PASS:?Indica la contraseña de la llave en LB_KEYSTORE_PASS}"

HERE="$(cd "$(dirname "$0")" && pwd)"
ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
OUT="$HERE/../frontend/public/descargar/lbmethod.apk"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/gen/mx/lbmethod/app" "$WORK/classes" "$(dirname "$OUT")"
cat > "$WORK/gen/mx/lbmethod/app/AppConfig.java" <<JAVA
package mx.lbmethod.app;
/** Generado por build-apk.sh. */
final class AppConfig {
    static final String URL = "$URL/";
    private AppConfig() {}
}
JAVA

# 1. Recursos y R.java
aapt package -f -m -J "$WORK/gen" -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -I "$ANDROID_JAR"
# 2. Java → .class (Java 8, el formato que entiende dx)
javac -nowarn -Xlint:-options -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d "$WORK/classes" \
  $(find "$HERE/src" "$WORK/gen" -name '*.java')
# 3. .class → classes.dex
dalvik-exchange --dex --min-sdk-version=26 --output="$WORK/classes.dex" "$WORK/classes"
# 4. Empaquetar, alinear y firmar
aapt package -f -M "$HERE/AndroidManifest.xml" -S "$HERE/res" -I "$ANDROID_JAR" -F "$WORK/sin-firmar.apk"
(cd "$WORK" && aapt add sin-firmar.apk classes.dex >/dev/null)
zipalign -f -p 4 "$WORK/sin-firmar.apk" "$WORK/alineada.apk"
if [ ! -f "$LB_KEYSTORE" ]; then
  keytool -genkeypair -keystore "$LB_KEYSTORE" -storepass "$LB_KEYSTORE_PASS" -keypass "$LB_KEYSTORE_PASS" \
    -alias lbmethod -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=LB METHOD, O=LB METHOD, C=MX" >/dev/null
  echo "Llave de firma nueva creada en $LB_KEYSTORE (guárdala; sin ella no se puede actualizar la app)."
fi
apksigner sign --ks "$LB_KEYSTORE" --ks-pass "env:LB_KEYSTORE_PASS" --ks-key-alias lbmethod \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "$OUT" "$WORK/alineada.apk"
apksigner verify "$OUT"
echo "APK lista: $OUT ($(wc -c < "$OUT") bytes) → abre $URL"
