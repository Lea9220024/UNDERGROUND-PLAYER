# UNDERGROUND OFFLINE PLAYER

Reproductor musical PWA local, sin streaming, cuentas ni backend.

## Desarrollo
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Publicación e instalación Android

El workflow `.github/workflows/pages.yml` publica automáticamente la PWA en GitHub Pages al actualizar `main`.

1. En GitHub, abrir **Settings → Pages** y seleccionar **GitHub Actions** como fuente de publicación.
2. Esperar que termine correctamente el workflow **Deploy PWA to GitHub Pages**.
3. Abrir en Chrome Android: https://lea9220024.github.io/UNDERGROUND-PLAYER/
4. Abrir el menú ⋮ y elegir **Instalar aplicación** o tocar **Instalar app** dentro del reproductor.
5. Confirmar la instalación. La app aparecerá en el launcher de Android.

La primera apertura requiere conexión para descargar la aplicación. Después, la interfaz se puede abrir sin conexión. La música importada se almacena localmente en IndexedDB y no se sube a ningún servidor.

## Android

- Diseño táctil adaptable y respeto por las áreas seguras del sistema.
- Media Session para mostrar título, artista y controles en la pantalla bloqueada y panel multimedia cuando Chrome/Android lo permiten.
- La reproducción de fondo depende de las políticas de batería, navegador y sistema operativo.
- Los archivos permanecen en el almacenamiento del navegador; borrar los datos de Chrome puede eliminarlos.
- La compatibilidad de formatos depende de los codecs disponibles en Android/Chrome.

## Limitaciones actuales

Los metadatos editados se guardan en la biblioteca de la app, no se escriben todavía dentro del archivo original. La PWA no equivale a un servicio nativo Android para control absoluto de reproducción en segundo plano.
