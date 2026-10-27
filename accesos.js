/* SBM Safety Academy - Gestion de accesos (solo administrador).
 * Agrega, edita, activa/desactiva y elimina los codigos de los supervisores.
 * Todo se valida en el servidor (funciones ehs_access_*): el navegador solo
 * envia el codigo del administrador que inicio sesion. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let items = [];
  let known = [];
  let loaded = false;

  async function rpc(name, args) {
    if (!state.access) throw new Error("Sesion no valida. Ingrese de nuevo.");
    const { data, error } = await state.supabase.rpc(name, { p_code: state.access.code, ...args });
    if (error || !data) throw new Error(error ? error.message : "Sin respuesta del servidor.");
    if (!data.ok) {
      const msg = {
        locked: "Demasiados intentos fallidos. Espere unos 10 minutos.",
        forbidden: "No tiene permiso para esto.",
        invalid: "La sesion ya no es valida. Cierre el panel e ingrese de nuevo."
      }[data.error];
      throw new Error(msg || data.error);
    }
    return data;
  }

  function say(html, isError) {
    const box = $("accessMsg");
    if (!box) return;
    box.innerHTML = html ? `<p style="margin:8px 0;${isError ? "color:#b91c1c" : ""}">${html}</p>` : "";
  }

  async function load() {
    try {
      const data = await rpc("ehs_access_list", {});
      items = data.items || [];
      known = data.known_projects || [];
      loaded = true;
      renderList();
      renderProjectBoxes([]);
    } catch (err) {
      say(esc(err.message), true);
    }
  }

  function renderList() {
    const body = $("accessRows");
    if (!body) return;
    body.innerHTML = "";
    items.forEach((it) => {
      const tr = document.createElement("tr");
      const last = it.last_login_at ? new Date(it.last_login_at).toLocaleString("es-CR") : "Nunca";
      tr.innerHTML = `
        <td>${esc(it.name)}</td>
        <td>${it.role === "admin" ? "Administrador" : "Supervisor"}</td>
        <td>${it.role === "admin" ? "Todos" : esc((it.projects || []).join(", "))}</td>
        <td>${it.active ? "Activo" : "Inactivo"}</td>
        <td>${esc(last)}</td>
        <td>
          <button type="button" class="secondary-btn" data-edit="${esc(it.id)}">Editar</button>
          <button type="button" class="secondary-btn" data-del="${esc(it.id)}">Eliminar</button>
        </td>`;
      body.appendChild(tr);
    });
  }

  function renderProjectBoxes(selected) {
    const box = $("accessProjectsBox");
    if (!box) return;
    const all = [...new Set([...known, ...selected])].sort((a, b) => a.localeCompare(b, "es"));
    box.innerHTML = all.map((p) => `
      <label style="display:inline-flex;gap:6px;align-items:center;margin:2px 12px 2px 0">
        <input type="checkbox" name="accessProject" value="${esc(p)}" ${selected.some((s) => s.toLowerCase() === p.toLowerCase()) ? "checked" : ""}> ${esc(p)}
      </label>`).join("") || '<span class="field-hint">Aun no hay proyectos registrados.</span>';
  }

  function toggleRoleUi() {
    const isAdmin = $("accessRole").value === "admin";
    $("accessProjectsWrap").style.display = isAdmin ? "none" : "";
  }

  function resetForm() {
    $("accessId").value = "";
    $("accessName").value = "";
    $("accessRole").value = "supervisor";
    $("accessCode").value = "";
    $("accessActive").checked = true;
    $("accessExtra").value = "";
    $("accessRegenWrap").style.display = "none";
    $("accessRegen").checked = false;
    $("accessFormTitle").textContent = "Nuevo acceso";
    $("accessCode").placeholder = "Vacio = se genera uno automaticamente";
    renderProjectBoxes([]);
    toggleRoleUi();
  }

  function startEdit(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    $("accessId").value = it.id;
    $("accessName").value = it.name;
    $("accessRole").value = it.role;
    $("accessActive").checked = !!it.active;
    $("accessCode").value = "";
    $("accessCode").placeholder = "Vacio = se mantiene el codigo actual";
    $("accessExtra").value = "";
    $("accessRegenWrap").style.display = "";
    $("accessRegen").checked = false;
    $("accessFormTitle").textContent = `Editar: ${it.name}`;
    renderProjectBoxes(it.projects || []);
    toggleRoleUi();
    say("");
    $("accessForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function save(event) {
    event.preventDefault();
    say("");
    const id = $("accessId").value || null;
    const role = $("accessRole").value;
    const chosen = [...document.querySelectorAll('input[name="accessProject"]:checked')].map((c) => c.value);
    const extra = $("accessExtra").value.split(",").map((x) => x.trim()).filter(Boolean);
    const typed = $("accessCode").value.trim();
    let newCode = typed;
    if (!newCode && (!id || $("accessRegen").checked)) newCode = "AUTO";
    try {
      const data = await rpc("ehs_access_save", {
        p_id: id,
        p_name: $("accessName").value,
        p_role: role,
        p_projects: role === "admin" ? [] : [...new Set([...chosen, ...extra])],
        p_active: $("accessActive").checked,
        p_new_code: newCode || null
      });
      const who = esc($("accessName").value.trim());
      say(data.code
        ? `Guardado. Codigo de <strong>${who}</strong>: <strong style="font-size:1.3em;letter-spacing:2px">${esc(data.code)}</strong> &mdash; anotelo ahora, no se vuelve a mostrar.`
        : "Guardado.");
      resetForm();
      await load();
    } catch (err) {
      say(esc(err.message), true);
    }
  }

  async function remove(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (!window.confirm(`Eliminar el acceso de ${it.name}? Ya no podra ingresar.`)) return;
    try {
      await rpc("ehs_access_delete", { p_id: id });
      say(`Acceso de ${esc(it.name)} eliminado.`);
      await load();
    } catch (err) {
      say(esc(err.message), true);
    }
  }

  function setTab(tab) {
    const isAccess = tab === "access";
    const panel = $("adminAccessPanel");
    const btn = $("adminAccessTab");
    if (panel) toggleHidden(panel, !isAccess);
    if (btn) toggleClass(btn, "active", isAccess);
    if (isAccess && state.access?.role === "admin") {
      resetForm();
      load();
    }
  }

  function reset() {
    items = [];
    known = [];
    loaded = false;
    const body = $("accessRows");
    if (body) body.innerHTML = "";
    say("");
  }

  function init() {
    if (!$("adminAccessPanel")) return;
    $("adminAccessTab").addEventListener("click", () => setAdminTab("access"));
    $("accessForm").addEventListener("submit", save);
    $("accessCancel").addEventListener("click", () => { resetForm(); say(""); });
    $("accessRole").addEventListener("change", toggleRoleUi);
    $("accessRows").addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit]");
      const del = e.target.closest("[data-del]");
      if (edit) startEdit(edit.getAttribute("data-edit"));
      if (del) remove(del.getAttribute("data-del"));
    });
    resetForm();
  }

  window.SBMAccess = { setTab, reset };
  init();
})();
