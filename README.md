# SBM Safety Academy

Plataforma web mobile-first de microcapacitaciones EHS para colaboradores operativos de SBM. Usa HTML, CSS y JavaScript vanilla, se publica en GitHub Pages y guarda datos en Supabase.

## Archivos

- `index.html`: estructura de la aplicacion.
- `styles.css`: diseno responsive alineado a colores SBM.
- `app.js`: conexion Supabase, registro, progreso, videos y panel administrador.
- `supabase_setup.sql`: tablas, llaves foraneas, datos iniciales, RLS y policies.

## Puesta en marcha

1. En Supabase, abra el SQL Editor y ejecute `supabase_setup.sql` si necesita recrear o actualizar la estructura.
2. Suba estos archivos al repositorio de GitHub Pages.
3. Cree las carpetas:

```text
videos/
docs/
```

4. Coloque el PDF en:

```text
docs/RH-F-05-Control-de-asistencia-a-capacitaciones.pdf
```

5. Coloque los videos con los nombres exactos configurados en Supabase:

```text
videos/EHS-I-05-Decapado-y-encerado-de-pisos.mp4
videos/EHS-I-12-Limpieza-de-Banos.mp4
videos/EHS-I-15-Limpieza-de-Pisos-con-Mopa.mp4
videos/EHS-I-18-Colocacion-de-barricadas.mp4
videos/EHS-I-20-Recoleccion-Segura-de-Basura.mp4
videos/EHS-I-23-Traslado-de-objetos.mp4
videos/EHS-I-24-Uso-de-estaciones-de-dilucion-y-piletas-de-lavado.mp4
```

La anon key del proyecto Supabase ya esta configurada en `app.js` como constante editable.

## Uso

El colaborador registra nombre, cedula y proyecto/site libre. La app crea o actualiza el registro en `ehs_employees`, carga videos activos desde `ehs_training_videos` y muestra progreso personal.

El boton `Marcar como completado` se activa cuando el colaborador ha visto al menos 95% del video. Al completar, se guarda en `ehs_video_views` con:

- `employee_id`
- `video_id`
- `started_at`
- `completed_at`
- `progress_percent`
- `completed = true`
- `signature_required = true`
- `signature_reminder_ack = true`

La app muestra siempre el recordatorio de que el registro digital no sustituye la firma fisica del formato RH-F-05.

## Panel administrador

El boton `Panel administrador` usa una clave local temporal definida en `app.js`:

```js
const ADMIN_PIN = "2026";
```

El panel muestra registros completados, filtros por nombre/cedula, proyecto parcial y video, ademas de exportacion CSV.

Nota: este PIN es una barrera operativa simple para GitHub Pages, no seguridad fuerte. Para un panel realmente privado conviene agregar autenticacion Supabase o mover reportes a una herramienta interna con credenciales.

## Escalabilidad

Para agregar nuevas categorias o videos no hay que cambiar el frontend. Inserte nuevas filas en:

- `ehs_training_categories`
- `ehs_training_videos`

Use `active = true` y un `file_path` relativo al repositorio, por ejemplo:

```text
videos/NUEVO-CODIGO-Nombre-del-video.mp4
```

Respete mayusculas, guiones y nombres exactos, especialmente en GitHub Pages.
