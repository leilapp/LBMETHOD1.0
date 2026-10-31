package mx.lbmethod.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.OutputStream;

/**
 * LB METHOD para Android. Muestra la app web publicada (AppConfig.URL) a pantalla completa.
 * - Solo navega dentro del dominio de la app; cualquier otro enlace (por ejemplo, un video de YouTube) se abre fuera.
 * - Permite elegir fotos y archivos para subirlos.
 * - Guarda en Descargas los PDF y Excel que genera la app (puente window.LBAndroid.saveFile).
 * No guarda contraseñas ni datos propios: la sesión es la misma cookie segura que usa el navegador.
 */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 1;
    private static final String DARK = "#07060B";
    private static final String LIGHT = "#F3F1F9";
    // View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR (Android 8); se compila contra API 23, por eso el número.
    private static final int LIGHT_NAVIGATION_BAR = 0x10;

    private WebView web;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private ValueCallback<Uri[]> pendingUpload;
    private String appHost;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        appHost = Uri.parse(AppConfig.URL).getHost();
        String background = systemIsDark() ? DARK : LIGHT;

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor(background));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor(background));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " LBMETHODAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.addJavascriptInterface(new Bridge(), "LBAndroid");
        web.setWebViewClient(new AppClient());
        web.setWebChromeClient(new AppChrome());

        applyBars(!systemIsDark());
        if (state != null) web.restoreState(state);
        else web.loadUrl(AppConfig.URL);
    }

    private boolean systemIsDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Barras del sistema del color de la app: claras con íconos oscuros, u oscuras con íconos claros. */
    private void applyBars(boolean light) {
        int color = Color.parseColor(light ? LIGHT : DARK);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        View decor = getWindow().getDecorView();
        int flags = decor.getSystemUiVisibility();
        if (light) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | LIGHT_NAVIGATION_BAR;
        else flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | LIGHT_NAVIGATION_BAR);
        decor.setSystemUiVisibility(flags);
        if (web != null) web.setBackgroundColor(color);
        if (root != null) root.setBackgroundColor(color);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush(); // conservar la sesión si Android cierra la app
    }

    @Override
    public void onBackPressed() {
        if (fullscreenView != null) {
            exitFullscreen();
        } else if (web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private boolean isAppUrl(Uri uri) {
        return "https".equals(uri.getScheme()) && appHost != null && appHost.equalsIgnoreCase(uri.getHost());
    }

    private void openOutside(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir este enlace.", Toast.LENGTH_SHORT).show();
        }
    }

    private class AppClient extends WebViewClient {
        // Existe desde Android 7 (API 24); se compila contra API 23, por eso sin @Override. Android la llama igual.
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAppUrl(uri)) return false;
            openOutside(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (!request.isForMainFrame()) return;
            String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style='background:" + DARK + ";color:#F4F1FA;font-family:sans-serif;display:flex;"
                + "flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center;padding:24px'>"
                + "<h2 style='color:#B89B5E'>LB METHOD</h2><p>No hay conexión con el servidor.<br>Revisa tu internet.</p>"
                + "<p><a style='color:#B89B5E' href='" + AppConfig.URL + "'>Reintentar</a></p></body></html>";
            view.loadDataWithBaseURL(AppConfig.URL, html, "text/html", "UTF-8", null);
        }
    }

    private class AppChrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingUpload != null) pendingUpload.onReceiveValue(null);
            pendingUpload = callback;
            try {
                startActivityForResult(params.createIntent(), PICK_FILE);
            } catch (ActivityNotFoundException e) {
                pendingUpload = null;
                Toast.makeText(MainActivity.this, "No se encontró una app para elegir archivos.", Toast.LENGTH_SHORT).show();
                return false;
            }
            return true;
        }

        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            // Videos a pantalla completa.
            if (fullscreenView != null) {
                callback.onCustomViewHidden();
                return;
            }
            fullscreenView = view;
            fullscreenCallback = callback;
            root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web.setVisibility(View.GONE);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        web.setVisibility(View.VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE && pendingUpload != null) {
            pendingUpload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            pendingUpload = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** Lo usa la página: saveFile (frontend/src/lib/saveFile.ts) y setTheme (frontend/src/lib/theme.ts). */
    private class Bridge {
        /** La página avisa qué tema muestra («light» o «dark», incluso si la persona lo fijó en la app). */
        @JavascriptInterface
        public void setTheme(final String theme) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (web.getUrl() == null || !isAppUrl(Uri.parse(web.getUrl()))) return;
                    applyBars("light".equals(theme));
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String base64, final String mimeType, final String fileName) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    // Solo la página de la app puede guardar archivos.
                    if (web.getUrl() == null || !isAppUrl(Uri.parse(web.getUrl()))) return;
                    saveToDownloads(base64, mimeType, fileName);
                }
            });
        }
    }

    private void saveToDownloads(String base64, String mimeType, String fileName) {
        String safeName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safeName.isEmpty()) safeName = "archivo";
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            ContentValues values = new ContentValues();
            values.put("_display_name", safeName);   // MediaStore.MediaColumns.DISPLAY_NAME
            values.put("mime_type", mimeType);       // MediaStore.MediaColumns.MIME_TYPE
            values.put("relative_path", "Download/"); // MediaStore.MediaColumns.RELATIVE_PATH (Android 10+)
            ContentResolver resolver = getContentResolver();
            Uri item = resolver.insert(Uri.parse("content://media/external/downloads"), values); // MediaStore.Downloads
            if (item == null) throw new IllegalStateException("sin destino");
            try (OutputStream out = resolver.openOutputStream(item)) {
                if (out == null) throw new IllegalStateException("sin destino");
                out.write(bytes);
            }
            Toast.makeText(this, "Guardado en Descargas: " + safeName, Toast.LENGTH_LONG).show();
            Intent open = new Intent(Intent.ACTION_VIEW);
            open.setDataAndType(item, mimeType);
            open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            try {
                startActivity(open);
            } catch (ActivityNotFoundException ignored) {
                // Sin visor instalado: el archivo queda en Descargas.
            }
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo guardar el archivo.", Toast.LENGTH_LONG).show();
        }
    }
}
