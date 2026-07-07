const SUPABASE_URL = "https://vgkyoyosjewdygxtnqvu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna3lveW9zamV3ZHlneHRucXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTAxNDAsImV4cCI6MjA5ODIyNjE0MH0.oDxSWg61UFLqMh2MeEW6yxarZAjobhEA6TWm0KS_7CA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// IMPORTANTE: estos nombres deben ser idénticos a los archivos dentro de /videos en GitHub.
const videos = [
  { code: "EHS-I-05", title: "Decapado y encerado de pisos", file: "videos/EHS-I-05-Decapado-y-encerado-de-pisos.mp4", day: "Día 1 / Lunes" },
  { code: "EHS-I-12", title: "Limpieza de baños", file: "videos/EHS-I-12-Limpieza-de-Banos.mp4", day: "Día 2 / Miércoles" },
  { code: "EHS-I-15", title: "Limpieza de pisos con mopa", file: "videos/EHS-I-15-Limpieza-de-Pisos-con-Mopa.mp4", day: "Día 3 / Viernes" },
  { code: "EHS-I-18", title: "Colocación de barricadas", file: "videos/EHS-I-18-Colocacion-de-barricadas.mp4", day: "Día 4 / Lunes" },
  { code: "EHS-I-20", title: "Recolección segura de basura", file: "videos/EHS-I-20-Recoleccion-Segura-de-Basura.mp4", day: "Día 5 / Miércoles" },
  { code: "EHS-I-23", title: "Traslado de objetos", file: "videos/EHS-I-23-Traslado-de-objetos.mp4", day: "Día 6 / Viernes" },
  { code: "EHS-I-24", title: "Uso de estaciones de dilución y piletas de lavado", file: "videos/EHS-I-24-Uso-de-estaciones-de-dilucion-y-piletas-de-lavado.mp4", day: "Día 7 / Siguiente día disponible" }
];

const els = {
  list: document.getElementById("videos"),
  employeeName: document.getElementById("employeeName"),
  employeeId: document.getElementById("employeeId"),
  site: document.getElementById("site"),
  saveProfile: document.getElementById("saveProfile"),
  profileStatus: document.getElementById("profileStatus"),
  progressText: document.getElementById("progressText"),
  progressBar: document.getElementById("progressBar")
};

const storageKey = "sbm_safety_academy_profile";
const completedKey = "sbm_safety_academy_completed";

function getProfile() {
  try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
  catch { return {}; }
}

function saveProfile() {
  const profile = {
    employee_name: els.employeeName.value.trim(),
    employee_id: els.employeeId.value.trim(),
    project_site: els.site.value.trim()
  };
  localStorage.setItem(storageKey, JSON.stringify(profile));
  els.profileStatus.textContent = "Datos guardados en este dispositivo.";
  updateButtons();
}

function getCompleted() {
  try { return JSON.parse(localStorage.getItem(completedKey) || "[]"); }
  catch { return []; }
}

function setCompleted(code) {
  const completed = new Set(getCompleted());
  completed.add(code);
  localStorage.setItem(completedKey, JSON.stringify([...completed]));
  updateProgress();
}

function updateProgress() {
  const done = getCompleted().filter(code => videos.some(v => v.code === code)).length;
  els.progressText.textContent = `${done} de ${videos.length} videos vistos`;
  els.progressBar.style.width = `${(done / videos.length) * 100}%`;
}

function loadProfile() {
  const profile = getProfile();
  els.employeeName.value = profile.employee_name || "";
  els.employeeId.value = profile.employee_id || "";
  els.site.value = profile.project_site || profile.site || "";
}

function hasProfile() {
  return els.employeeName.value.trim() && els.employeeId.value.trim();
}

function safeId(code) {
  return code.replace(/[^a-zA-Z0-9]/g, "");
}

function updateButtons() {
  document.querySelectorAll(".complete-btn").forEach(btn => {
    const id = safeId(btn.dataset.code);
    const ack = document.querySelector(`#ack-${id}`);
    const alreadyDone = getCompleted().includes(btn.dataset.code);
    btn.disabled = alreadyDone || !hasProfile() || !ack?.checked;
  });
}

function renderVideos() {
  els.list.innerHTML = videos.map(video => {
    const id = safeId(video.code);
    const done = getCompleted().includes(video.code);
    return `
      <article class="video-card" id="${id}">
        <div class="video-header">
          <div>
            <h3>${video.title}</h3>
            <p>${video.day}. Al finalizar, registre el visto digital y firme RH-F-05.</p>
          </div>
          <span class="video-code">${video.code}</span>
        </div>
        <div class="video-box">
          <video controls playsinline preload="metadata">
            <source src="${encodeURI(video.file)}" type="video/mp4">
            Su navegador no puede reproducir este video.
          </video>
          <a class="open-video" href="${encodeURI(video.file)}" target="_blank" rel="noopener">Abrir video en una pestaña nueva</a>
        </div>
        <div class="video-actions">
          <label class="ack">
            <input id="ack-${id}" type="checkbox" ${done ? "checked" : ""}>
            Confirmo que vi este video y entiendo que debo firmar la hoja física RH-F-05 correspondiente a este tema.
          </label>
          <button class="complete-btn" data-code="${video.code}">${done ? "Registrado como visto" : "Registrar como visto"}</button>
          <div class="saved" id="saved-${id}" ${done ? "style='display:block'" : ""}>Registro guardado.</div>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll(".ack input").forEach(input => input.addEventListener("change", updateButtons));
  document.querySelectorAll(".complete-btn").forEach(btn => btn.addEventListener("click", handleComplete));
  updateButtons();
}

async function handleComplete(event) {
  const btn = event.currentTarget;
  const video = videos.find(v => v.code === btn.dataset.code);
  const id = safeId(video.code);
  const ack = document.querySelector(`#ack-${id}`);

  if (!hasProfile()) {
    alert("Primero escriba su nombre y cédula/número de empleado, y presione Guardar mis datos.");
    return;
  }
  if (!ack.checked) {
    alert("Debe confirmar que vio el video y que firmará RH-F-05.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando...";

  const payload = {
    employee_name: els.employeeName.value.trim(),
    employee_id: els.employeeId.value.trim(),
    project_site: els.site.value.trim(),
    video_code: video.code,
    video_title: video.title,
    viewed: true,
    confirmed_signature_required: true
  };

  const { error } = await sb.from("ehs_video_views").insert(payload);

  if (error) {
    btn.disabled = false;
    btn.textContent = "Registrar como visto";
    alert("No se pudo enviar el registro a Supabase. Error: " + error.message);
    return;
  }

  setCompleted(video.code);
  btn.textContent = "Registrado como visto";
  document.getElementById(`saved-${id}`).style.display = "block";
}

els.saveProfile.addEventListener("click", saveProfile);
[els.employeeName, els.employeeId, els.site].forEach(input => input.addEventListener("input", updateButtons));

loadProfile();
renderVideos();
updateProgress();
