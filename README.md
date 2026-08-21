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
- El avance se mide en SEGUNDOS REALMENTE REPRODUCIDOS, no en la posicion de
  la barra. Cada segundo distinto que suena se marca como visto; adelantar la
  barra no suma. La cobertura es segundos vistos / duracion.
- Al terminar el video se marca completado automaticamente, siempre que la
  cobertura llegue al umbral `COMPLETION_THRESHOLD` (90% por defecto, en
  `app.js`). Si llego al final adelantando, se le avisa cuanto le falta.
- Boton `Marcar como completado` habilitado desde ese mismo 90%, como respaldo
  para quien cierra el video justo antes del final.
- El detalle de segundos vistos se guarda en localStorage por cedula, y la
  cobertura resultante se sincroniza a `ehs_video_views.progress_percent`.
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


## Capacitaciones en PDF (documentos)

La app ahora soporta capacitaciones de lectura, sin cambiar la base de datos.
Se detectan automaticamente: si `file_path` termina en `.pdf`, la capacitacion se
muestra como documento en vez de video.

Flujo:

1. Suba el PDF al repositorio en la carpeta `docs/`, por ejemplo:

```text
docs/OP-P-01-Nombre-del-procedimiento.pdf
```

2. En el panel administrador use `Agregar capacitacion` y escriba en `file_path`:

```text
docs/OP-P-01-Nombre-del-procedimiento.pdf
```

3. El colaborador ve la tarjeta con la etiqueta `PDF` y el boton `Leer documento`.
4. El PDF se muestra embebido; si el celular no lo renderiza, hay boton para abrirlo
   en una pestana nueva.
5. Debe marcar la casilla `Confirmo que lei el documento completo` para habilitar
   el boton `Marcar como leido`.
6. Al completarlo se guarda en `ehs_video_views` con `progress_percent = 100`,
   igual que un video, asi que cuenta en el porcentaje y en los reportes del admin.

No hace falta migracion en Supabase: se reutilizan `ehs_training_videos` y
`ehs_video_views` tal como estan.

Nombres de archivo: sin espacios, sin tildes y respetando mayusculas/minusculas,
porque GitHub Pages distingue.


## Videos en Supabase Storage

Para no llenar el repositorio, los videos nuevos van a Supabase Storage en vez
de la carpeta `videos/`.

La app decide por la extension del `file_path`, no por el dominio:

- Termina en `.mp4`, `.webm`, `.mov`, `.m4v` (sea ruta local o URL) -> se
  reproduce en el reproductor embebido, con seguimiento real de avance y la
  regla del 95% para poder completar.
- Es una URL a una pagina (Vimeo, YouTube) -> se abre en pestana nueva y el
  colaborador marca completado a mano.
- Termina en `.pdf` -> se abre como documento de lectura con confirmacion.

Puesta en marcha del bucket:

1. En Supabase: Storage -> New bucket -> nombre `capacitaciones`, marcar Public.
2. Subir los MP4 al bucket.
3. Copiar la URL publica de cada archivo. Tiene esta forma:

```text
https://vgkyoyosjewdygxtnqvu.supabase.co/storage/v1/object/public/capacitaciones/archivo.mp4
```

4. Guardar esa URL en `file_path`, desde el panel administrador o por SQL.

Los videos que ya estan en `videos/` siguen funcionando igual; no hay que
moverlos.

## Recomendaciones futuras

- Cambiar el PIN local por autenticacion real de Supabase.
- Separar policies de lectura publica y administracion privada.
- Agregar una tabla de auditoria si se requiere trazabilidad formal de cambios de videos.
