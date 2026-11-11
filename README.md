# UNDERGROUND — Offline Player

Reproductor musical PWA local-first. No tiene streaming, cuentas, publicidad ni backend. Los archivos importados permanecen en el almacenamiento del navegador mediante IndexedDB.

## Primera versión funcional

- Importación de archivos de audio y selección de carpetas (según el navegador).
- Biblioteca persistente en IndexedDB, búsqueda, favoritos y filtro por carpetas.
- Reproducción, pausa, anterior/siguiente, aleatorio, repetir, volumen y posición.
- Ecualizador DSP de cinco bandas mediante Web Audio API.
- Visualizador de espectro mediante AnalyserNode y Canvas.
- Asociación de letras sincronizadas LRC por nombre de archivo.
- Edición local de título, artista y álbum. No sobrescribe los tags del archivo original.
- PWA instalable con service worker.

## Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Limitaciones conocidas

- La selección de carpetas depende del soporte del navegador; en Android puede ser necesario seleccionar archivos desde el gestor de archivos.
- La reproducción de MP3, AAC, WAV, FLAC, OGG y otros formatos depende de los codecs del navegador/dispositivo.
- La reproducción en segundo plano y los controles de pantalla bloqueada dependen de Android y del navegador. No equivale todavía a una app nativa.
- Los metadatos editados se guardan en la biblioteca local, no dentro del archivo original.
- Las letras LRC deben importarse como archivos `.lrc` con el mismo nombre base que la pista.
- El almacenamiento del navegador puede ser eliminado por el sistema si el usuario borra los datos del sitio; conviene implementar exportación/backup en una siguiente versión.

## Privacidad

El proyecto no implementa backend ni sube archivos. La música se guarda en IndexedDB del dispositivo donde se importa.
