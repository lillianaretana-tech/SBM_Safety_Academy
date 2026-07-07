const SUPABASE_URL = 'https://vgkyoyosjewdygxtnqvu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna3lveW9zamV3ZHlneHRucXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTAxNDAsImV4cCI6MjA5ODIyNjE0MH0.oDxSWg61UFLqMh2MeEW6yxarZAjobhEA6TWm0KS_7CA';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FALLBACK_VIDEOS = [
  { code: 'EHS-I-05', title: 'Decapado y encerado de pisos', category: 'EHS', sort_order: 1, file_candidates: ['EHS-I-05- Decapado y encerado de pisos.mp4', 'EHS-I-05-Decapado-y-encerado-de-pisos.mp4', 'EHS-I-05- Decapado y encerado de pisos(1).mp4'] },
  { code: 'EHS-I-12', title: 'Limpieza de Baños', category: 'EHS', sort_order: 2, file_candidates: ['EHS-I-12 - Limpieza de Baños.mp4', 'EHS-I-12-Limpieza-de-Banos.mp4'] },
  { code: 'EHS-I-15', title: 'Limpieza de Pisos con Mopa', category: 'EHS', sort_order: 3, file_candidates: ['EHS-I-15 Limpieza de Pisos con Mopa.mp4', 'EHS-I-15-Limpieza-de-Pisos-con-Mopa.mp4'] },
  { code: 'EHS-I-18', title: 'Colocación de barricadas', category: 'EHS', sort_order: 4, file_candidates: ['EHS-I-18-Colocacion de barricadas.mp4', 'EHS-I-18-Colocacion-de-barricadas.mp4'] },
  { code: 'EHS-I-20', title: 'Recolección Segura de Basura', category: 'EHS', sort_order: 5, file_candidates: ['EHS-I-20-Recolección Segura de Basura.mp4', 'EHS-I-20-Recoleccion-Segura-de-Basura.mp4'] },
  { code: 'EHS-I-23', title: 'Traslado de objetos', category: 'EHS', sort_order: 6, file_candidates: ['EHS-I-23-Traslado de objetos.mp4', 'EHS-I-23-Traslado-de-objetos.mp4'] },
  { code: 'EHS-I-24', title: 'Uso de estaciones de dilución y piletas de lavado', category: 'EHS', sort_order: 7, file_candidates: ['EHS-1-24-Uso de estaciones de dilución y piletas de lavado.mp4', 'EHS-I-24-Uso-de-estaciones-de-dilucion-y-piletas-de-lavado.mp4'] },
];

let currentEmployee = null;
let videos = [];
let completedByVideo = new Map();
let adminRows = [];

const qs = (id) => document.getElementById(id);
const normalize = (value) => (value || '').toString().trim();
const pct = (num) => `${Math.round(num || 0)}%`;

function videoSources(video) {
  const list = Array.isArray(video.file_candidates) && video.file_candidates.length ? video.file_candidates : [video.video_file].filter(Boolean);
  return [...new Set(list.filter(Boolean))].map((file) => `videos/${file}`);
}

function saveEmployeeLocal(employee) {
  localStorage.setItem('sbm_ehs_employee', JSON.stringify(employee));
}
function getEmployeeLocal() {
  try { return JSON.parse(localStorage.getItem('sbm_ehs_employee') || 'null'); } catch { return null; }
}

async function upsertEmployee(form) {
  const cedula = normalize(form.cedula);
  const payload = {
    full_name: normalize(form.full_name),
    cedula,
    project_site: normalize(form.project_site),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from('ehs_employees')
    .upsert(payload, { onConflict: 'cedula' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function loadVideos() {
  const { data, error } = await client
    .from('ehs_training_videos')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error || !data || !data.length) return FALLBACK_VIDEOS;
  return data;
}

async function loadMyProgress() {
  completedByVideo = new Map();
  if (!currentEmployee?.id) return;
  const { data, error } = await client
    .from('ehs_video_views')
    .select('video_id, video_code, completed, watched_percent, completed_at, signature_ack')
    .eq('employee_id', currentEmployee.id);
  if (error) return;
  (data || []).forEach(row => {
    const key = row.video_id || row.video_code;
    completedByVideo.set(key, row);
  });
}

async function markCompleted(video, watchedPercent = 100) {
  if (!currentEmployee?.id) throw new Error('Debe registrar sus datos primero.');
  const payload = {
    employee_id: currentEmployee.id,
    video_id: video.id || null,
    video_code: video.code,
    watched_percent: Math.max(95, Math.round(watchedPercent)),
    completed: true,
    signature_ack: true,
    completed_at: new Date().toISOString(),
  };
  const { error } = await client
    .from('ehs_video_views')
    .upsert(payload, { onConflict: video.id ? 'employee_id,video_id' : 'employee_id,video_code' });
  if (error) throw error;
  completedByVideo.set(video.id || video.code, payload);
  renderVideos();
  updateProgress();
}

function showDashboard() {
  qs('loginPanel').classList.add('hidden');
  qs('dashboard').classList.remove('hidden');
  qs('welcomeName').textContent = currentEmployee.full_name;
  qs('welcomeMeta').textContent = `Cédula: ${currentEmployee.cedula} · Proyecto: ${currentEmployee.project_site}`;
}

function updateProgress() {
  const done = videos.filter(v => completedByVideo.has(v.id || v.code)).length;
  const total = videos.length || 1;
  const percent = (done / total) * 100;
  qs('progressText').textContent = `${done} de ${videos.length} completados`;
  qs('progressPercent').textContent = pct(percent);
  qs('progressFill').style.width = `${percent}%`;
}

function renderVideos() {
  const grid = qs('videoGrid');
  grid.innerHTML = '';
  videos.forEach((video) => {
    const key = video.id || video.code;
    const done = completedByVideo.get(key);
    const card = document.createElement('article');
    card.className = 'card video-card';

    const sources = videoSources(video);
    const sourcesHtml = sources.map(src => `<source src="${src}" type="video/mp4">`).join('');
    const firstSource = sources[0] || '#';

    card.innerHTML = `
      <div class="video-header">
        <div>
          <span class="video-code">${video.code}</span>
          <h3>${video.title}</h3>
          <p class="small-note">Categoría: ${video.category || 'EHS'}</p>
        </div>
        <span class="status ${done ? 'done' : ''}">${done ? 'Completado' : 'Pendiente'}</span>
      </div>
      <div class="video-wrap">
        <video preload="metadata" controls playsinline>${sourcesHtml}Su navegador no puede reproducir este video.</video>
      </div>
      <div class="video-actions">
        <a class="secondary-btn" href="${firstSource}" target="_blank" rel="noopener">Abrir video</a>
        <button class="primary-btn complete-btn" ${done ? '' : 'disabled'}>${done ? 'Completado registrado' : 'Complete el video para registrar'}</button>
      </div>
      <p class="small-note">Al completar este video, debe firmar la hoja RH-F-05 correspondiente.</p>
    `;

    const videoEl = card.querySelector('video');
    const completeBtn = card.querySelector('.complete-btn');
    let bestProgress = done ? 100 : 0;

    function enableButton() {
      completeBtn.disabled = false;
      if (!done) completeBtn.textContent = 'Registrar video visto';
    }
    videoEl.addEventListener('timeupdate', () => {
      if (videoEl.duration) {
        bestProgress = Math.max(bestProgress, (videoEl.currentTime / videoEl.duration) * 100);
        if (bestProgress >= 95) enableButton();
      }
    });
    videoEl.addEventListener('ended', () => { bestProgress = 100; enableButton(); });
    completeBtn.addEventListener('click', async () => {
      completeBtn.disabled = true;
      completeBtn.textContent = 'Guardando...';
      try { await markCompleted(video, bestProgress); }
      catch (err) { alert(`No se pudo guardar: ${err.message}`); completeBtn.disabled = false; }
    });
    grid.appendChild(card);
  });
}

async function initDashboard() {
  videos = await loadVideos();
  showDashboard();
  await loadMyProgress();
  renderVideos();
  updateProgress();
}

qs('employeeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = event.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  try {
    currentEmployee = await upsertEmployee({
      full_name: qs('employeeName').value,
      cedula: qs('employeeCedula').value,
      project_site: qs('employeeProject').value,
    });
    saveEmployeeLocal(currentEmployee);
    await initDashboard();
  } catch (err) {
    alert(`No se pudo iniciar: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Iniciar capacitación';
  }
});

qs('changeUserBtn').addEventListener('click', () => {
  localStorage.removeItem('sbm_ehs_employee');
  location.reload();
});

async function loadAdminRows() {
  const { data, error } = await client
    .from('ehs_video_views')
    .select('completed_at, watched_percent, signature_ack, video_code, ehs_employees(full_name, cedula, project_site), ehs_training_videos(title)')
    .order('completed_at', { ascending: false })
    .limit(1000);
  if (error) { alert(`No se pudo cargar el panel: ${error.message}`); return; }
  adminRows = data || [];
  renderAdminRows();
}
function renderAdminRows() {
  const filter = normalize(qs('adminFilter').value).toLowerCase();
  const tbody = qs('adminTableBody');
  tbody.innerHTML = '';
  adminRows
    .filter(row => JSON.stringify(row).toLowerCase().includes(filter))
    .forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.completed_at ? new Date(row.completed_at).toLocaleString('es-CR') : ''}</td>
        <td>${row.ehs_employees?.full_name || ''}</td>
        <td>${row.ehs_employees?.cedula || ''}</td>
        <td>${row.ehs_employees?.project_site || ''}</td>
        <td>${row.video_code} · ${row.ehs_training_videos?.title || ''}</td>
        <td>${row.watched_percent || 0}%</td>
        <td>${row.signature_ack ? 'Pendiente de firma física' : ''}</td>
      `;
      tbody.appendChild(tr);
    });
}
function exportCsv() {
  const rows = [['Fecha','Nombre','Cedula','Proyecto','Video','Avance','Firma']];
  adminRows.forEach(row => rows.push([
    row.completed_at ? new Date(row.completed_at).toLocaleString('es-CR') : '',
    row.ehs_employees?.full_name || '',
    row.ehs_employees?.cedula || '',
    row.ehs_employees?.project_site || '',
    `${row.video_code} ${row.ehs_training_videos?.title || ''}`,
    `${row.watched_percent || 0}%`,
    row.signature_ack ? 'Pendiente firma RH-F-05' : ''
  ]));
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `seguimiento_ehs_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
qs('refreshAdminBtn').addEventListener('click', loadAdminRows);
qs('adminFilter').addEventListener('input', renderAdminRows);
qs('exportCsvBtn').addEventListener('click', exportCsv);

(async function boot() {
  currentEmployee = getEmployeeLocal();
  if (currentEmployee?.id) await initDashboard();
})();
