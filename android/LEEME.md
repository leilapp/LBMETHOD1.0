# LB METHOD · App de Android (APK)

App pequeña (unos 40 KB) que abre LB METHOD, publicado en Cloudflare, en su propia ventana, con el ícono de LB METHOD.
Se descarga desde el inicio de sesión de la app, en un teléfono Android: botón «Descargar app para Android (APK)».

## Qué hace

- Abre el link de la app (`AppConfig.URL`, que pone `build-apk.sh`) a pantalla completa, sin barra del navegador.
- Solo navega dentro de ese dominio. Otros enlaces, como un video de YouTube, se abren en su propia app.
- Permite elegir fotos y archivos para subirlos (fotos de progreso, imágenes de ejercicios, Excel).
- Guarda los PDF y Excel en **Descargas** y los abre. Usa el puente `window.LBAndroid.saveFile`, en `frontend/src/lib/saveFile.ts`.
- Pone los videos a pantalla completa, y el botón «atrás» regresa a la pantalla anterior.
- Usa la misma sesión segura que el navegador (cookie HttpOnly). No guarda contraseñas ni datos propios.
- Requiere Android 10 o más nuevo.

## Instalarla en el teléfono

1. En Chrome del teléfono, abre el link de la app y toca «Descargar app para Android (APK)».
2. Abre el archivo descargado (`LB-METHOD.apk`).
3. Android pedirá permitir instalar apps de Chrome: actívalo. Es normal, porque la app no viene de la Play Store.
4. Si aparece Play Protect con «App desconocida», toca «Más detalles → Instalar de todas formas».

## Volver a armarla (por ejemplo, si cambia el link)

En Linux o WSL (Ubuntu), una sola vez, instala las herramientas:

```bash
sudo apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 openjdk-21-jdk-headless
```

Después arma la APK:

```bash
LB_KEYSTORE=/ruta/lbmethod.keystore LB_KEYSTORE_PASS='…' android/build-apk.sh https://lbmethod1-0.<subdominio>.workers.dev
```

- El resultado queda en `frontend/public/descargar/lbmethod.apk`. Se publica con el siguiente push.
- Para una versión nueva, sube `android:versionCode` en `AndroidManifest.xml`. Android solo actualiza encima si el número es mayor.

## Llave de firma

- Android solo acepta actualizaciones firmadas con **la misma llave**.
- La llave está en los archivos del proyecto, fuera de Git: `android/lbmethod.keystore`. Su contraseña está en `android/llave-firma.txt`.
- Guarda copia de ambos en un lugar seguro. Si se pierden, habrá que desinstalar la app y volver a instalarla con una llave nueva.
