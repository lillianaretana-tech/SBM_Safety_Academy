const SUPABASE_URL = "https://vgkyoyosjewdygxtnqvu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna3lveW9zamV3ZHlneHRucXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTAxNDAsImV4cCI6MjA5ODIyNjE0MH0.oDxSWg61UFLqMh2MeEW6yxarZAjobhEA6TWm0KS_7CA";
const ADMIN_PIN = "2026";

const STORAGE_EMPLOYEE_KEY = "sbmSafetyAcademyEmployee";
const STORAGE_PROGRESS_PREFIX = "sbmSafetyAcademyProgress:";

const state = {
  supabase: null,
  employee: null,
  videos: [],
  views: new Map(),
  localProgress: {},
  adminRows: [],
  adminAuthenticated: false
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  bindEvents();
  boot();
});

function cacheDom() {
  Object.assign(dom, {
    appAlert: document.getElementById("appAlert"),
    employeeForm: document.getElementById("employeeForm"),
    fullName: document.getElementById("fullName"),
    cedula: document.getElementById("cedula"),
    projectSite: document.getElementById("projectSite"),
    sessionBadge: document.getElementById("sessionBadge"),
    progressSummary: document.getElementById("progressSummary"),
    progressBar: document.getElementById("progressBar"),
    progressPercent: document.getElementById("progressPercent"),
    videoList: document.getElementById("videoList"),
    emptyState: document.getElementById("emptyState"),
    reloadBtn: document.getElementById("reloadBtn"),
    adminOpenBtn: document.getElementById("adminOpenBtn"),
    adminModal: document.getElementById("adminModal"),
    adminCloseBtn: document.getElementById("adminCloseBtn"),
    adminPinForm: document.getElementById("adminPinForm"),
    adminPin: document.getElementById("adminPin"),
    adminContent: document.getElementById("adminContent"),
    filterPerson: document.getElementById("filterPerson"),
    filterProject: document.getElementById("filterProject"),
    filterVideo: document.getElementById("filterVideo"),
    adminRows: document.getElementById("adminRows"),
    adminEmpty: document.getElementById("adminEmpty"),
    exportCsvBtn: document.getElementById("exportCsvBtn")
  });
}

function bindEvents() {
  dom.employeeForm.addEventListener("submit", saveEmployee);
  dom.reloadBtn.addEventListener("click", refreshAll);
  dom.adminOpenBtn.addEventListener("click", openAdmin);
  dom.adminCloseBtn.addEventListener("click", closeAdmin);
  dom.adminModal.addEventListener("click", (event) => {
    if (event.target === dom.adminModal) closeAdmin();
  });
  dom.adminPinForm.addEventListener("submit", unlockAdmin);
  [dom.filterPerson, dom.filterProject, dom.filterVideo].forEach((control) => {
    control.addEventListener("input", renderAdminRows);
    control.addEventListener("change", renderAdminRows);
  });
  dom.exportCsvBtn.addEventListener("click", exportCsv);
}

async function boot() {
  initSupabase();
  restoreEmployee();
  await refreshAll();
}

function initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    showAlert("No se pudo cargar Supabase JS. Revise la conexión a internet o el CDN configurado.");
    return;
  }

  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("PEGA_AQUI")) {
    showAlert("Falta configurar SUPABASE_ANON_KEY en app.js. Pegue la anon key del proyecto Supabase para activar la conexión.");
    return;
  }

  state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function restoreEmployee() {
  const saved = safeJsonParse(localStorage.getItem(STORAGE_EMPLOYEE_KEY), null);
  if (!saved || !saved.id) return;

  state.employee = saved;
  dom.fullName.value = saved.full_name || "";
  dom.cedula.value = saved.cedula || "";
  dom.projectSite.value = saved.project_site || "";
  loadLocalProgress();
  updateSessionBadge();
}

async function refreshAll() {
  clearAlert();
  await loadVideos();
  if (state.employee) {
    await loadViews();
  }
  renderVideos();
  renderProgress();
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!requireSupabase()) return;

  const payload = {
    full_name: dom.fullName.value.trim(),
    cedula: dom.cedula.value.trim(),
    project_site: dom.projectSite.value.trim(),
    updated_at: new Date().toISOString()
  };

  if (!payload.full_name || !payload.cedula || !payload.project_site) {
    showAlert("Complete nombre, cédula y proyecto/site para continuar.");
    return;
  }

  setFormBusy(true);
  const { data, error } = await state.supabase
    .from("ehs_employees")
    .upsert(payload, { onConflict: "cedula" })
    .select()
    .single();
  setFormBusy(false);

  if (error) {
    showAlert(`No se pudo guardar el colaborador: ${error.message}`);
    return;
  }

  state.employee = data;
  localStorage.setItem(STORAGE_EMPLOYEE_KEY, JSON.stringify(data));
  loadLocalProgress();
  updateSessionBadge();
  await loadViews();
  renderVideos();
  renderProgress();
}

async function loadVideos() {
  state.videos = [];
  if (!requireSupabase(false)) {
    renderVideos();
    return;
  }

  const { data, error } = await state.supabase
    .from("ehs_training_videos")
    .select("id, category_id, video_code, title, description, file_path, active, sort_order, ehs_training_categories(name)")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("video_code", { ascending: true });

  if (error) {
    showAlert(`No se pudieron cargar los videos: ${error.message}`);
    return;
  }

  state.videos = Array.isArray(data) ? data : [];
}

async function loadViews() {
  state.views = new Map();
  if (!state.employee || !requireSupabase(false)) return;

  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .select("*")
    .eq("employee_id", state.employee.id);

  if (error) {
    showAlert(`No se pudo cargar el progreso personal: ${error.message}`);
    return;
  }

  (data || []).forEach((view) => state.views.set(view.video_id, view));
}

function renderVideos() {
  dom.videoList.innerHTML = "";
  dom.emptyState.classList.toggle("hidden", state.videos.length > 0);

  state.videos.forEach((video) => {
    const view = state.views.get(video.id);
    const progress = getVideoProgress(video.id, view);
    const status = getStatus(progress, view);
    const card = document.createElement("article");
    card.className = "video-card";
    card.innerHTML = `
      <div class="video-body">
        <div class="video-meta">
          <span class="category-chip">${escapeHtml(video.ehs_training_categories?.name || "EHS")}</span>
          <span class="code-chip">${escapeHtml(getVideoCode(video))}</span>
          <span class="status-pill ${status.className}">${status.label}</span>
        </div>
        <div>
          <h3>${escapeHtml(video.title || "Capacitación sin título")}</h3>
          <p>${escapeHtml(video.description || "Sin descripción.")}</p>
        </div>
        <video class="training-video" controls preload="metadata" playsinline src="${escapeAttribute(video.file_path || "")}"></video>
        <div class="video-actions">
          <button class="primary-btn complete-btn" type="button" ${isCompleteButtonEnabled(progress, view) ? "" : "disabled"}>
            ${view?.completed ? "Completado" : "Marcar como completado"}
          </button>
          <div>
            <p class="muted">Avance visto: <strong>${Math.round(progress)}%</strong>. Debe llegar al 95% para completar.</p>
            <a class="video-link" href="${escapeAttribute(video.file_path || "")}" target="_blank" rel="noopener">Abrir video en pestaña nueva</a>
          </div>
        </div>
      </div>
    `;

    const videoEl = card.querySelector("video");
    const completeBtn = card.querySelector(".complete-btn");
    videoEl.addEventListener("play", () => startVideo(video.id));
    videoEl.addEventListener("timeupdate", () => handleVideoProgress(video.id, videoEl, card));
    videoEl.addEventListener("ended", () => handleVideoProgress(video.id, videoEl, card, true));
    videoEl.addEventListener("error", () => showAlert(`El video ${getVideoCode(video) || video.title} no se pudo reproducir. Use el enlace "Abrir video en pestaña nueva" o revise la ruta en Supabase.`));
    completeBtn.addEventListener("click", () => completeVideo(video.id, card));
    dom.videoList.appendChild(card);
  });
}

async function startVideo(videoId) {
  if (!state.employee || !requireSupabase(false)) return;
  if (state.views.has(videoId)) return;

  const payload = {
    employee_id: state.employee.id,
    video_id: videoId,
    started_at: new Date().toISOString(),
    progress_percent: getVideoProgress(videoId),
    completed: false,
    signature_required: true,
    signature_reminder_ack: false
  };

  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .insert(payload)
    .select()
    .single();

  if (!error && data) state.views.set(videoId, data);
}

function handleVideoProgress(videoId, videoEl, card, forceComplete = false) {
  if (!videoEl.duration || Number.isNaN(videoEl.duration)) return;
  const percent = Math.min(100, (videoEl.currentTime / videoEl.duration) * 100);
  if (!state.localProgress[videoId] || percent > state.localProgress[videoId]) {
    state.localProgress[videoId] = forceComplete ? 100 : percent;
    saveLocalProgress();
  }
  updateCardProgress(videoId, card);
  renderProgress();
}

function updateCardProgress(videoId, card) {
  const view = state.views.get(videoId);
  const progress = getVideoProgress(videoId, view);
  const status = getStatus(progress, view);
  const statusPill = card.querySelector(".status-pill");
  const completeBtn = card.querySelector(".complete-btn");
  const progressText = card.querySelector(".muted strong");

  statusPill.className = `status-pill ${status.className}`;
  statusPill.textContent = status.label;
  progressText.textContent = `${Math.round(progress)}%`;
  completeBtn.disabled = !isCompleteButtonEnabled(progress, view);
  completeBtn.textContent = view?.completed ? "Completado" : "Marcar como completado";
}

async function completeVideo(videoId, card) {
  if (!state.employee) {
    showAlert("Primero registre el colaborador para guardar el avance personal.");
    return;
  }
  if (!requireSupabase()) return;

  const progress = Math.max(95, getVideoProgress(videoId));
  const existing = state.views.get(videoId);
  const payload = {
    employee_id: state.employee.id,
    video_id: videoId,
    started_at: existing?.started_at || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    progress_percent: progress,
    completed: true,
    signature_required: true,
    signature_reminder_ack: true,
    updated_at: new Date().toISOString()
  };

  const query = existing
    ? state.supabase.from("ehs_video_views").update(payload).eq("id", existing.id)
    : state.supabase.from("ehs_video_views").insert(payload);

  const { data, error } = await query.select().single();
  if (error) {
    showAlert(`No se pudo guardar la capacitación completada: ${error.message}`);
    return;
  }

  state.views.set(videoId, data);
  state.localProgress[videoId] = Math.max(state.localProgress[videoId] || 0, progress);
  saveLocalProgress();
  updateCardProgress(videoId, card);
  renderProgress();
}

function renderProgress() {
  const total = state.videos.length;
  const completed = state.videos.filter((video) => state.views.get(video.id)?.completed).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  dom.progressSummary.textContent = `${completed} de ${total} completados`;
  dom.progressBar.style.width = `${percent}%`;
  dom.progressPercent.textContent = `${percent}%`;
}

function getVideoProgress(videoId, view = state.views.get(videoId)) {
  return Math.max(Number(view?.progress_percent || 0), Number(state.localProgress[videoId] || 0));
}

function getVideoCode(video) {
  return video?.video_code || video?.code || "";
}

function getStatus(progress, view) {
  if (view?.completed) return { label: "Completado", className: "completed" };
  if (progress > 0) return { label: "En progreso", className: "in-progress" };
  return { label: "Pendiente", className: "pending" };
}

function canComplete(progress, view) {
  return Boolean(state.employee && (view?.completed || progress >= 95));
}

function isCompleteButtonEnabled(progress, view) {
  return Boolean(!view?.completed && canComplete(progress, view));
}

function loadLocalProgress() {
  state.localProgress = safeJsonParse(localStorage.getItem(progressStorageKey()), {});
}

function saveLocalProgress() {
  if (!state.employee) return;
  localStorage.setItem(progressStorageKey(), JSON.stringify(state.localProgress));
}

function progressStorageKey() {
  return `${STORAGE_PROGRESS_PREFIX}${state.employee?.cedula || "anon"}`;
}

function updateSessionBadge() {
  if (!state.employee) return;
  dom.sessionBadge.textContent = `Registrado: ${state.employee.full_name}`;
  dom.sessionBadge.className = "status-pill completed";
}

async function openAdmin() {
  dom.adminModal.classList.remove("hidden");
  dom.adminPin.focus();
  if (state.adminAuthenticated) await loadAdminRows();
}

function closeAdmin() {
  dom.adminModal.classList.add("hidden");
}

async function unlockAdmin(event) {
  event.preventDefault();
  if (dom.adminPin.value !== ADMIN_PIN) {
    showAlert("Clave de administrador incorrecta.");
    return;
  }
  state.adminAuthenticated = true;
  dom.adminPinForm.classList.add("hidden");
  dom.adminContent.classList.remove("hidden");
  await loadAdminRows();
}

async function loadAdminRows() {
  if (!requireSupabase()) return;
  const { data, error } = await state.supabase
    .from("ehs_video_views")
    .select("completed_at, progress_percent, completed, ehs_employees(full_name, cedula, project_site), ehs_training_videos(id, video_code, title)")
    .eq("completed", true)
    .order("completed_at", { ascending: false });

  if (error) {
    showAlert(`No se pudieron cargar los registros del administrador: ${error.message}`);
    return;
  }

  state.adminRows = data || [];
  populateVideoFilter();
  renderAdminRows();
}

function populateVideoFilter() {
  const current = dom.filterVideo.value;
  const options = new Map();
  state.adminRows.forEach((row) => {
    const video = row.ehs_training_videos;
    if (video?.id) options.set(video.id, `${getVideoCode(video)} - ${video.title}`);
  });

  dom.filterVideo.innerHTML = '<option value="">Todos los videos</option>';
  [...options.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, label]) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    dom.filterVideo.appendChild(option);
  });
  dom.filterVideo.value = current;
}

function getFilteredAdminRows() {
  const person = normalize(dom.filterPerson.value);
  const project = normalize(dom.filterProject.value);
  const videoId = dom.filterVideo.value;

  return state.adminRows.filter((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    const personText = normalize(`${employee.full_name || ""} ${employee.cedula || ""}`);
    const projectText = normalize(employee.project_site || "");
    return (!person || personText.includes(person))
      && (!project || projectText.includes(project))
      && (!videoId || video.id === videoId);
  });
}

function renderAdminRows() {
  const rows = getFilteredAdminRows();
  dom.adminRows.innerHTML = "";
  rows.forEach((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(employee.full_name || "")}</td>
      <td>${escapeHtml(employee.cedula || "")}</td>
      <td>${escapeHtml(employee.project_site || "")}</td>
      <td>${escapeHtml(`${getVideoCode(video)} - ${video.title || ""}`)}</td>
      <td>${escapeHtml(formatDate(row.completed_at))}</td>
      <td>${Math.round(Number(row.progress_percent || 0))}%</td>
    `;
    dom.adminRows.appendChild(tr);
  });
  dom.adminEmpty.classList.toggle("hidden", rows.length > 0);
}

function exportCsv() {
  const rows = getFilteredAdminRows();
  const header = ["colaborador", "cedula", "proyecto", "video", "fecha_completado", "porcentaje"];
  const body = rows.map((row) => {
    const employee = row.ehs_employees || {};
    const video = row.ehs_training_videos || {};
    return [
      employee.full_name || "",
      employee.cedula || "",
      employee.project_site || "",
      `${getVideoCode(video)} - ${video.title || ""}`,
      formatDate(row.completed_at),
      Math.round(Number(row.progress_percent || 0))
    ];
  });
  const csv = [header, ...body].map((line) => line.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sbm-safety-academy-registros-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function setFormBusy(isBusy) {
  dom.employeeForm.querySelectorAll("input, button").forEach((el) => {
    el.disabled = isBusy;
  });
}

function requireSupabase(show = true) {
  const ready = Boolean(state.supabase);
  if (!ready && show) showAlert("Supabase no está disponible. Revise SUPABASE_ANON_KEY en app.js y la conexión de red.");
  return ready;
}

function showAlert(message) {
  dom.appAlert.textContent = message;
  dom.appAlert.classList.remove("hidden");
}

function clearAlert() {
  dom.appAlert.textContent = "";
  dom.appAlert.classList.add("hidden");
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
