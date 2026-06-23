const RAW_CSV_URLS = {
  selector: "https://docs.google.com/spreadsheets/d/1gOYX20vbzV0_jltJgw-7l9bc8iQDvglDdDhfOoS9SfQ/gviz/tq?tqx=out:csv&sheet=Selector_Referencias",
  componentes: "https://docs.google.com/spreadsheets/d/1gOYX20vbzV0_jltJgw-7l9bc8iQDvglDdDhfOoS9SfQ/gviz/tq?tqx=out:csv&sheet=Componentes_Criticos",
  explosion: "https://docs.google.com/spreadsheets/d/1gOYX20vbzV0_jltJgw-7l9bc8iQDvglDdDhfOoS9SfQ/gviz/tq?tqx=out:csv&sheet=Explosion_Necesidades"
};

const CSV_URLS = {
  selector: "/api/sheet?tab=Selector_Referencias",
  componentes: "/api/sheet?tab=Componentes_Criticos",
  explosion: "/api/sheet?tab=Explosion_Necesidades"
};

const state = {
  selector: [],
  componentes: [],
  explosion: []
};

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupEvents();
  loadAllData();
});

function setupEvents() {
  document.getElementById("refreshBtn").addEventListener("click", loadAllData);

  document.getElementById("selectorSearch").addEventListener("input", renderSelector);
  document.getElementById("estadoFilter").addEventListener("change", renderSelector);
  document.getElementById("decisionFilter").addEventListener("change", renderSelector);
  document.getElementById("semanaFilter").addEventListener("change", renderSelector);

  document.getElementById("componentSearch").addEventListener("input", renderComponentes);
  document.getElementById("prioridadFilter").addEventListener("change", renderComponentes);
  document.getElementById("accionFilter").addEventListener("change", renderComponentes);

  document.getElementById("itemDetailSelect").addEventListener("change", renderDetalleProducto);
  document.getElementById("detailEstadoFilter").addEventListener("change", renderDetalleProducto);
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(button.dataset.tab).classList.add("active");
    });
  });
}

async function loadAllData() {
  showLoading(true);
  showError("");

  try {
    const [selector, componentes, explosion] = await Promise.all([
      loadCsv(CSV_URLS.selector),
      loadCsv(CSV_URLS.componentes),
      loadCsv(CSV_URLS.explosion)
    ]);

    state.selector = selector;
    state.componentes = componentes;
    state.explosion = explosion;

    console.log("Selector length:", selector.length);
    console.log("Selector first row:", selector[0]);
    
    console.log("Componentes length:", componentes.length);
    console.log("Componentes first row:", componentes[0]);
    
    console.log("Explosion length:", explosion.length);
    console.log("Explosion first row:", explosion[0]);

    populateFilters();
    renderAll();
  } catch (error) {
    console.error(error);
    showError("Error cargando datos. Revisa que los enlaces CSV estén publicados y sean accesibles.");
  } finally {
    showLoading(false);
  }
}

async function loadCsv(url) {
  if (!url || url.includes("PEGA_AQUI")) {
    throw new Error("Falta configurar una URL CSV.");
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} cargando ${url}`);
  }

  const text = await response.text();
  return csvToObjects(text);
}

function csvToObjects(csvText) {
  const rows = parseCsv(csvText);

  if (!rows.length) return [];

  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalize(cell));

    const hasSelectorHeader =
      normalized.includes("item madre") &&
      normalized.includes("semana") &&
      normalized.includes("cantidad plan") &&
      normalized.includes("score prioridad");

    const hasComponentHeader =
      normalized.includes("componente") &&
      normalized.includes("productos afectados");

    const hasExplosionHeader =
      normalized.includes("item madre") &&
      normalized.includes("semana") &&
      normalized.includes("cantidad plan") &&
      normalized.includes("producto madre completo") &&
      normalized.includes("componente");

    return hasSelectorHeader || hasComponentHeader || hasExplosionHeader;
  });

  if (headerRowIndex === -1) {
    console.warn("No se encontró fila de cabecera válida", rows.slice(0, 10));
    return [];
  }

  const headers = rows[headerRowIndex].map(cleanHeader);

  console.log("Headers detectados:", headers);

  return rows
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row) => {
      const obj = {};

      headers.forEach((header, index) => {
        obj[header] = row[index] ?? "";
      });

      return obj;
    });
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentValue += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;

      currentRow.push(currentValue);
      rows.push(currentRow);

      currentRow = [];
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  if (currentValue !== "" || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function cleanHeader(header) {
  return String(header || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getValue(row, possibleKeys) {
  const keys = Object.keys(row || {});

  for (const wanted of possibleKeys) {
    const wantedNorm = normalize(wanted);
    const foundKey = keys.find((key) => normalize(key) === wantedNorm);
    if (foundKey) return row[foundKey];
  }

  return "";
}

function toNumber(value) {
  if (typeof value === "number") return value;

  const text = String(value || "")
    .replace("%", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const number = toNumber(value);
  return new Intl.NumberFormat("es-ES").format(number);
}

function formatPercent(value) {
  const number = toNumber(value);

  if (number <= 1) {
    return `${Math.round(number * 100)}%`;
  }

  return `${Math.round(number)}%`;
}

function renderAll() {
  renderSummary();
  renderSelector();
  renderComponentes();
  renderSinBom();
  renderItemSelect();
  renderDetalleProducto();
}

function populateFilters() {
  fillSelect("estadoFilter", uniqueValues(state.selector, "Estado"), "Todos los estados");
  fillSelect("decisionFilter", uniqueValues(state.selector, "Decisión sugerida"), "Todas las decisiones");
  fillSelect("semanaFilter", uniqueValues(state.selector, "Semana", true), "Todas las semanas");

  fillSelect("prioridadFilter", uniqueValues(state.componentes, "Prioridad"), "Todas las prioridades");
  fillSelect("accionFilter", uniqueValues(state.componentes, "Acción sugerida"), "Todas las acciones");
}

function uniqueValues(data, key, numeric = false) {
  const values = [...new Set(
    data
      .map((row) => row[key])
      .filter((value) => String(value || "").trim() !== "")
  )];

  if (numeric) {
    return values.sort((a, b) => toNumber(a) - toNumber(b));
  }

  return values.sort((a, b) => String(a).localeCompare(String(b), "es"));
}

function fillSelect(selectId, values, defaultText) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;

  select.innerHTML = `<option value="">${defaultText}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
}

function renderSummary() {
  const selector = state.selector;
  const componentes = state.componentes;
  const explosion = state.explosion;

  setText("totalRefs", selector.length);
  setText("fabricables", selector.filter((r) => getValue(r, ["Estado"]) === "FABRICABLE").length;
  setText("atacarYa", selector.filter((r) => getValue(r, ["Decisión sugerida", "Decision sugerida"]) === "Atacar ya").length;

  setText(
    "componentesDeficit",
    componentes.filter((r) => toNumber(r["Déficit total"]) > 0).length
  );

  setText(
    "componentesCriticos",
    componentes.filter((r) => r["Prioridad"] === "CRITICA").length
  );

  setText(
  "sinBom",
  explosion.filter((r) => getValue(r, ["Estado"]) === "SIN BOM").length
);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderSelector() {
  const search = normalize(document.getElementById("selectorSearch").value);
  const estado = document.getElementById("estadoFilter").value;
  const decision = document.getElementById("decisionFilter").value;
  const semana = document.getElementById("semanaFilter").value;

  let rows = [...state.selector];

  rows = rows.filter((row) => {
    const matchesSearch = !search || normalize(row["Item madre"]).includes(search);
    const matchesEstado = !estado || row["Estado"] === estado;
    const matchesDecision = !decision || row["Decisión sugerida"] === decision;
    const matchesSemana = !semana || String(row["Semana"]) === String(semana);

    return matchesSearch && matchesEstado && matchesDecision && matchesSemana;
  });

  rows.sort((a, b) => toNumber(b["Score prioridad"]) - toNumber(a["Score prioridad"]));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Componentes faltantes",
    "% cubierto",
    "Unidades posibles",
    "Estado",
    "Score prioridad",
    "Decisión sugerida"
  ];

  renderTable("selectorTable", rows, columns, {
    "Item madre": (value) => `<span class="clickable" onclick="openDetail('${escapeAttr(value)}')">${escapeHtml(value)}</span>`,
    "% cubierto": formatPercent,
    "Cantidad plan": formatNumber,
    "Unidades posibles": formatNumber,
    "Estado": renderEstadoBadge,
    "Decisión sugerida": renderDecisionBadge
  });
}

function renderComponentes() {
  const search = normalize(document.getElementById("componentSearch").value);
  const prioridad = document.getElementById("prioridadFilter").value;
  const accion = document.getElementById("accionFilter").value;

  let rows = [...state.componentes];

  rows = rows.filter((row) => {
    const matchesSearch = !search || normalize(row["Componente"]).includes(search);
    const matchesPrioridad = !prioridad || row["Prioridad"] === prioridad;
    const matchesAccion = !accion || row["Acción sugerida"] === accion;

    return matchesSearch && matchesPrioridad && matchesAccion;
  });

  rows.sort((a, b) => {
    const semanaA = toNumber(a["Primera semana afectada"]) || 999;
    const semanaB = toNumber(b["Primera semana afectada"]) || 999;

    if (semanaA !== semanaB) return semanaA - semanaB;

    return toNumber(b["Déficit total"]) - toNumber(a["Déficit total"]);
  });

  const columns = [
    "Componente",
    "Productos afectados",
    "Items afectados",
    "Semanas afectadas",
    "Primera semana afectada",
    "Nº líneas afectadas",
    "Necesidad total",
    "Stock actual",
    "Déficit total",
    "Déficit acumulado hasta primera semana",
    "Peor plazo",
    "Prioridad",
    "Acción sugerida"
  ];

  renderTable("componentesTable", rows, columns, {
    "Necesidad total": formatNumber,
    "Stock actual": formatNumber,
    "Déficit total": formatNumber,
    "Déficit acumulado hasta primera semana": formatNumber,
    "Prioridad": renderPrioridadBadge
  });
}

function renderSinBom() {
  const rows = state.explosion
    .filter((row) => getValue(row, ["Estado"]) === "SIN BOM")
    .sort((a, b) => toNumber(getValue(a, ["Semana"])) - toNumber(getValue(b, ["Semana"])));

  const displayRows = rows.map((row) => ({
    "Item madre": getValue(row, ["Item madre", "Item"]),
    "Semana": getValue(row, ["Semana"]),
    "Cantidad plan": getValue(row, ["Cantidad plan", "Cantidad"]),
    "Producto madre completo": getValue(row, ["Producto madre completo", "Producto madre"]),
    "Estado": getValue(row, ["Estado"])
  }));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Producto madre completo",
    "Estado"
  ];

  renderTable("sinBomTable", displayRows, columns, {
    "Cantidad plan": formatNumber,
    "Estado": renderEstadoBadge
  });
}

function renderItemSelect() {
  const select = document.getElementById("itemDetailSelect");

  const items = [
    ...new Set(
      state.explosion
        .map((row) => getValue(row, ["Item madre", "Item"]))
        .filter((value) => String(value || "").trim() !== "")
    )
  ].sort((a, b) => String(a).localeCompare(String(b), "es"));

  select.innerHTML = `<option value="">Selecciona un item...</option>`;

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

function openDetail(item) {
  const decoded = decodeURIComponent(item);

  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === "detalle");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.toggle("active", content.id === "detalle");
  });

  document.getElementById("itemDetailSelect").value = decoded;
  renderDetalleProducto();
}

function renderDetalleProducto() {
  const item = document.getElementById("itemDetailSelect").value;
  const estadoFilter = document.getElementById("detailEstadoFilter").value;

  if (!item) {
    document.getElementById("detailSummary").innerHTML = "";
    renderTable("detalleTable", [], [
      "Item madre",
      "Semana",
      "Componente",
      "Cantidad escandallo",
      "Necesidad componente",
      "Stock actual",
      "Plazo entrega",
      "Estado"
    ]);
    return;
  }

  let rows = state.explosion.filter((row) => {
    return getValue(row, ["Item madre", "Item"]) === item;
  });

  if (estadoFilter) {
    rows = rows.filter((row) => {
      return getValue(row, ["Estado"]) === estadoFilter;
    });
  }

  const total = rows.length;
  const faltan = rows.filter((row) => getValue(row, ["Estado"]) === "FALTA").length;
  const ok = rows.filter((row) => getValue(row, ["Estado"]) === "OK").length;

  document.getElementById("detailSummary").innerHTML = `
    <div class="detail-pill"><strong>${escapeHtml(item)}</strong></div>
    <div class="detail-pill">Componentes: <strong>${total}</strong></div>
    <div class="detail-pill">OK: <strong>${ok}</strong></div>
    <div class="detail-pill">Faltan: <strong>${faltan}</strong></div>
  `;

  const displayRows = rows.map((row) => ({
    "Item madre": getValue(row, ["Item madre", "Item"]),
    "Semana": getValue(row, ["Semana"]),
    "Cantidad plan": getValue(row, ["Cantidad plan", "Cantidad"]),
    "Componente": getValue(row, ["Componente"]),
    "Cantidad escandallo": getValue(row, ["Cantidad escandallo"]),
    "Necesidad componente": getValue(row, ["Necesidad componente", "Necesidad"]),
    "Stock actual": getValue(row, ["Stock actual", "Stock"]),
    "Plazo entrega": getValue(row, ["Plazo entrega", "Plazo de entrega"]),
    "Estado": getValue(row, ["Estado"])
  }));

  const columns = [
    "Item madre",
    "Semana",
    "Cantidad plan",
    "Componente",
    "Cantidad escandallo",
    "Necesidad componente",
    "Stock actual",
    "Plazo entrega",
    "Estado"
  ];

  renderTable("detalleTable", displayRows, columns, {
    "Cantidad plan": formatNumber,
    "Cantidad escandallo": formatNumber,
    "Necesidad componente": formatNumber,
    "Stock actual": formatNumber,
    "Estado": renderEstadoBadge
  });
}

function renderTable(tableId, rows, columns, formatters = {}) {
  const table = document.getElementById(tableId);

  if (!rows.length) {
    table.innerHTML = `
      <thead>
        <tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        <tr><td colspan="${columns.length}">Sin datos</td></tr>
      </tbody>
    `;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        ${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows.map((row) => `
        <tr>
          ${columns.map((col) => {
            const rawValue = row[col] ?? "";
            const formatter = formatters[col];
            const value = formatter ? formatter(rawValue, row) : escapeHtml(rawValue);

            return `<td>${value}</td>`;
          }).join("")}
        </tr>
      `).join("")}
    </tbody>
  `;
}

function renderEstadoBadge(value) {
  const text = String(value || "");

  if (text === "FABRICABLE" || text === "OK") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  if (text === "CASI FABRICABLE") {
    return `<span class="badge yellow">${escapeHtml(text)}</span>`;
  }

  if (text === "ATACABLE" || text === "FALTA") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "BLOQUEADO" || text === "SIN BOM") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge gray">${escapeHtml(text)}</span>`;
}

function renderPrioridadBadge(value) {
  const text = String(value || "");

  if (text === "CRITICA") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  if (text === "ALTA") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "MEDIA") {
    return `<span class="badge yellow">${escapeHtml(text)}</span>`;
  }

  if (text === "OK") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge gray">${escapeHtml(text)}</span>`;
}

function renderDecisionBadge(value) {
  const text = String(value || "");

  if (text === "Fabricar") {
    return `<span class="badge green">${escapeHtml(text)}</span>`;
  }

  if (text === "Atacar ya") {
    return `<span class="badge red">${escapeHtml(text)}</span>`;
  }

  if (text === "Revisar faltantes" || text === "Fabricación parcial posible") {
    return `<span class="badge orange">${escapeHtml(text)}</span>`;
  }

  if (text === "Aparcar") {
    return `<span class="badge gray">${escapeHtml(text)}</span>`;
  }

  return `<span class="badge yellow">${escapeHtml(text)}</span>`;
}

function showLoading(show) {
  document.getElementById("loading").classList.toggle("hidden", !show);
}

function showError(message) {
  const box = document.getElementById("errorBox");

  if (!message) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }

  box.textContent = message;
  box.classList.remove("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return encodeURIComponent(String(value ?? ""));
}
