# Genshin +

Planificador personal de materiales para Genshin Impact: elige un personaje, marca nivel y talentos objetivo y mira cuántos materiales y cuánta resina te faltan.

Es una página estática (HTML, CSS y JavaScript sin dependencias de compilación). Todo tu progreso se guarda en el navegador (`localStorage`); no hay cuentas ni servidor.

## Páginas

| Página | Qué hace |
|---|---|
| `index.html` | Inicio, resumen de metas y notas |
| `personajes.html` | Catálogo con filtros, favoritos y orden |
| `detalle.html?char=<id>` | Plan de un personaje |
| `tracker.html` | Personajes en seguimiento, equipos, total y exportar/importar |
| `hoy.html` | Qué farmear hoy según tu tracker |
| `materiales.html` | Página de diagnóstico para consultar materiales de genshin-db |

## Cómo usarla en local

Abre `index.html` con un servidor estático (por ejemplo, la extensión Live Server de VS Code, o `python -m http.server`) y entra a `http://localhost:8000`.

## Datos e imágenes

- Datos de personajes y materiales: [genshin-db](https://github.com/theBowja/genshin-db) (API pública `genshin-db-api.vercel.app`).
- Iconos: CDN de Enka Network y Yatta, y las imágenes propias en `includes/images/`.
- Bootstrap 5.3.3 y SweetAlert2 11.14.5 se cargan desde jsDelivr.
- Los personajes que genshin-db aún no tiene usan cifras provisionales (ver `LEAK` en `includes/scripts.js`) y se reemplazan solos cuando la base de datos los agrega.

## Estructura

```
includes/
  api.js       cliente de genshin-db e imágenes
  scripts.js   navegación, tema, catálogo y utilidades
  plan.js      cálculo de materiales y progreso
  extras.js    resina, dominios de talentos, exportar/importar
  detalle.js   página de personaje
  tracker.js   tracker y equipos
  hoy.js       planificador diario
  jefes.js     jefes de mundo y semanales
  slides.js    galería de emojis del inicio
  styles.css   estilos
  images/      imágenes propias
imagenes/placeholder.png   imagen de respaldo
```

## Aviso

Proyecto de fans sin fines de lucro. No está afiliado ni respaldado por HoYoverse. Genshin Impact, sus personajes e imágenes son propiedad de HoYoverse.
