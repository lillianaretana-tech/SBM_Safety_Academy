# SBM Safety Academy

LMS mobile-first de microcapacitaciones EHS para colaboradores operativos de SBM. Usa HTML, CSS y JavaScript vanilla, Supabase JS v2 desde CDN y GitHub Pages.

## Archivos

- `index.html`: estructura de la aplicacion LMS.
- `styles.css`: diseno mobile-first con colores SBM.
- `app.js`: registro, dashboard, progreso, reproductor, admin y gestion basica de capacitaciones.
- `supabase_setup.sql`: estructura sugerida de tablas `ehs_*`, datos iniciales, RLS y policies.
- `supabase_seed_q3_vimeo.sql`: carga opcional de videos Q3 desde Vimeo.
- `assets/Logo_SBM.png`: logo usado en el encabezado y referencia visual de marca.

## Funcionalidad principal

- Registro por nombre, cedula y proyecto/site.
- Dashboard del colaborador con nombre, proyecto, porcentaje, completados y pendientes.
- Seccion `Tu siguiente capacitacion` con el primer video pendiente segun `sort_order`.
- Biblioteca de videos con estado: pendiente, en progreso o completado.
- Vista dedicada de video con reproductor de tamano controlado.
- Soporte para MP4 locales en `/videos/` y enlaces externos Vimeo en `file_path`.
- Los enlaces Vimeo se abren en una pestana nueva; al terminar, el colaborador regresa a la app para marcar completado.
- Los videos Vimeo pueden firmarse juntos en una sola hoja regular de capacitacion.
- Guardado de avance parcial en `ehs_video_views.progress_percent`.
- Boton `Marcar como completado` habilitado solo al llegar al 95%.
- Felicitacion al completar toda la ruta.
- Recordatorio permanente de firma fisica RH-F-05.

## Puesta en marcha en GitHub Pages

1. Suba `index.html`, `styles.css`, `app.js` y las carpetas necesarias al repositorio.
2. Cree o mantenga estas carpetas:

```text
assets/
videos/
docs/
```

3. Coloque el PDF en:

```text
docs/RH-F-05-Control-de-asistencia-a-capacitaciones.pdf
```

4. Coloque los MP4 con las rutas exactas guardadas en Supabase. Ejemplos actuales:

```text
videos/EHS-I-05-Decapado-y-encerado-de-pisos.mp4
videos/EHS-I-12-Limpieza-de-Banos.mp4
videos/EHS-I-15-Limpieza-de-Pisos-con-Mopa.mp4
videos/EHS-I-18-Colocacion-de-barricadas.mp4
videos/EHS-I-20-Recoleccion-Segura-de-Basura.mp4
videos/EHS-I-23-Traslado-de-objetos.mp4
videos/EHS-I-24-Uso-de-estaciones-de-dilucion-y-piletas-de-lavado.mp4
```

GitHub Pages distingue mayusculas, minusculas y guiones. El valor `file_path` de Supabase debe coincidir exactamente.

## Videos Vimeo Q3

El archivo `supabase_seed_q3_vimeo.sql` agrega una categoria Q3 y 13 videos externos. Los enlaces marcados como acceso `si` quedan activos; los marcados `no` quedan inactivos como prevista para activarlos cuando funcionen.

Para liberar 2 videos por semana, use el panel administrador y active solamente los dos videos de esa semana. Tambien puede cambiar `active` directamente en Supabase.

## Panel administrador

El PIN temporal esta en `app.js`:

```js
const ADMIN_PIN = "2580";
```

Incluye:

- Resumen de registros: total, completados y pendientes.
- Tabla con colaborador, cedula, proyecto, video, fecha y porcentaje.
- Filtros por nombre/cedula, proyecto parcial y video.
- Exportacion CSV.
- Pestana de capacitaciones para listar, crear, editar datos basicos y activar/desactivar videos.

Nota importante: el PIN local no es seguridad fuerte. El modulo de crear/editar videos usa la anon key del proyecto. Para que funcione, Supabase debe permitir `insert` y `update` en `ehs_training_videos` para el rol/policy correspondiente. El archivo `supabase_setup.sql` ya incluye policies anon para este uso operativo; si RLS lo bloquea, la app mostrara un error claro.

## Agregar capacitaciones

1. Suba manualmente el MP4 a `/videos/` en GitHub.
2. En el panel administrador, use `Agregar capacitacion`.
3. Complete:

- categoria
- codigo
- titulo
- descripcion
- `file_path`
- orden
- activo

No se suben archivos MP4 desde la app; solo se registra la metadata en Supabase.

## Recomendaciones futuras

- Cambiar el PIN local por autenticacion real de Supabase.
- Separar policies de lectura publica y administracion privada.
- Agregar una tabla de auditoria si se requiere trazabilidad formal de cambios de videos.
