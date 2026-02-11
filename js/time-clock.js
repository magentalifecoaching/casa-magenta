/* ==========================================================
   CASA MAGENTA - TIME-CLOCK.JS (REGISTRO DE HORARIOS)
   Vista semanal, estado en tiempo real, navegación, filtros
   ========================================================== */
import { db, collection, addDoc, serverTimestamp, query, orderBy, getDocs, where } from "./firebase.js";
import { state } from "./state.js";
import { obtenerColorPorNombre } from "./scheduler.js";

// --- Module state ---
let semanaVista = getInicioSemana(new Date());
let filtroPersonaRegistros = null;

// --- Labels & Constants ---
const ESTADO_LABELS = {
    entrada:          { emoji: "🟢", texto: "Trabajando" },
    inicio_almuerzo:  { emoji: "🟡", texto: "Almorzando" },
    fin_almuerzo:     { emoji: "🟢", texto: "Trabajando" },
    salida:           { emoji: "🔴", texto: "Salió" }
};

// --- Date Utilities ---
function getInicioSemana(fecha) {
    const d = new Date(fecha);
    const day = d.getDay(); // 0=Dom
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Retroceder a Lunes
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getFinSemana(inicioSemana) {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + 6); // Domingo
    d.setHours(23, 59, 59, 999);
    return d;
}

function dateToKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatHora(date) {
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatFechaCorta(date) {
    return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }).toUpperCase();
}

// ============================================================
// FICHAJE MODAL (registrar + vista semanal unificada)
// ============================================================
function abrirModalDeFichaje() {
    const modal = document.getElementById("fichaje-modal");
    const selectPersona = document.getElementById("select-fichaje-persona");

    selectPersona.innerHTML = '<option value="">-- Selecciona --</option>';
    if (state.configCache?.colaboradores) {
        state.configCache.colaboradores.forEach(colab => {
            const option = document.createElement("option");
            option.value = colab;
            option.innerText = colab;
            selectPersona.appendChild(option);
        });
    }

    if (state.filtroUsuarioActual) {
        selectPersona.value = state.filtroUsuarioActual;
    }

    modal.showModal();

    // Cargar vista semanal al abrir
    semanaVista = getInicioSemana(new Date());
    filtroPersonaRegistros = null;
    renderizarVistaSemanRegistros();
}

async function registrarEventoDeTiempo(evento) {
    const persona = document.getElementById("select-fichaje-persona").value;

    if (!persona) {
        alert("Por favor, selecciona tu nombre.");
        return;
    }

    try {
        await addDoc(collection(db, "registros_horarios"), {
            persona,
            evento,
            timestamp: serverTimestamp()
        });
        alert(`Evento '${evento}' registrado para ${persona}.`);
        await cargarEstadoActual();
    } catch (error) {
        console.error("Error registrando evento:", error);
        alert("Error al registrar. Intenta de nuevo.");
    }
}

// ============================================================
// CARGAR REGISTROS DE UNA SEMANA (Firestore query)
// ============================================================
async function cargarRegistrosSemana() {
    const inicio = new Date(semanaVista);
    inicio.setHours(0, 0, 0, 0);
    const fin = getFinSemana(semanaVista);

    const q = query(
        collection(db, "registros_horarios"),
        where("timestamp", ">=", inicio),
        where("timestamp", "<=", fin),
        orderBy("timestamp", "asc")
    );

    const snapshot = await getDocs(q);

    // Organizar: { "2026-02-10": { "Ana": [ {evento, hora, timestamp}, ... ] } }
    const registros = {};

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const fecha = data.timestamp?.toDate();
        if (!fecha) return;

        const dayKey = dateToKey(fecha);

        if (!registros[dayKey]) registros[dayKey] = {};
        if (!registros[dayKey][data.persona]) registros[dayKey][data.persona] = [];

        registros[dayKey][data.persona].push({
            evento: data.evento,
            hora: formatHora(fecha),
            timestamp: fecha
        });
    });

    return registros;
}

// ============================================================
// VISTA SEMANAL DE REGISTROS (renderizado principal)
// ============================================================
async function renderizarVistaSemanRegistros() {
    const content = document.getElementById("time-log-content");
    const labelSemana = document.getElementById("week-range-label");

    content.innerHTML = '<div class="loading">Cargando registros...</div>';

    // Actualizar label de semana
    const fin = getFinSemana(semanaVista);
    const optsCorta = { day: "numeric", month: "short" };
    const optsLarga = { day: "numeric", month: "short", year: "numeric" };
    labelSemana.innerText = `${semanaVista.toLocaleDateString("es-ES", optsCorta)} — ${fin.toLocaleDateString("es-ES", optsLarga)}`;

    // Renderizar filtros de persona
    renderizarFiltrosRegistros();

    try {
        const registros = await cargarRegistrosSemana();

        // Estado actual (solo del día de hoy)
        renderizarEstadoEnModal(registros);

        let html = "";

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(semanaVista);
            dayDate.setDate(dayDate.getDate() + i);
            const dayKey = dateToKey(dayDate);
            const dayLabel = formatFechaCorta(dayDate);
            const registrosDia = registros[dayKey] || {};

            // Aplicar filtro de persona
            const personas = Object.keys(registrosDia)
                .filter(p => !filtroPersonaRegistros || p === filtroPersonaRegistros)
                .sort();

            // Marcar si es hoy
            const esHoy = dateToKey(new Date()) === dayKey;
            const claseHoy = esHoy ? "tl-day-today" : "";

            html += `<div class="tl-day-block ${claseHoy}">`;
            html += `<div class="tl-day-title">${dayLabel}${esHoy ? " — HOY" : ""}</div>`;

            if (personas.length === 0) {
                html += `<div class="tl-empty">Sin registros</div>`;
            } else {
                html += `<table class="time-log-table"><thead><tr>`;
                html += `<th>Persona</th><th>✔️ Entrada</th><th>🥪 Almuerzo</th><th>🍴 Fin Alm.</th><th>🚪 Salida</th>`;
                html += `</tr></thead><tbody>`;

                personas.forEach(persona => {
                    const eventos = registrosDia[persona];
                    const color = obtenerColorPorNombre(persona);

                    const entrada = eventos.find(e => e.evento === "entrada");
                    const inicioAlm = eventos.find(e => e.evento === "inicio_almuerzo");
                    const finAlm = eventos.find(e => e.evento === "fin_almuerzo");
                    const salida = eventos.find(e => e.evento === "salida");

                    html += `<tr>`;
                    html += `<td><span class="tl-persona-badge" style="background:${color}">${persona}</span></td>`;
                    html += `<td>${entrada ? entrada.hora : "—"}</td>`;
                    html += `<td>${inicioAlm ? inicioAlm.hora : "—"}</td>`;
                    html += `<td>${finAlm ? finAlm.hora : "—"}</td>`;
                    html += `<td>${salida ? salida.hora : "—"}</td>`;
                    html += `</tr>`;
                });

                html += `</tbody></table>`;
            }

            html += `</div>`;
        }

        content.innerHTML = html;

    } catch (error) {
        console.error("Error cargando registros:", error);
        content.innerHTML = '<div class="loading">Error al cargar registros.</div>';
    }
}

// ============================================================
// FILTROS DE PERSONA (dentro del modal de registros)
// ============================================================
function renderizarFiltrosRegistros() {
    const container = document.getElementById("time-log-filters");
    if (!container) return;
    container.innerHTML = "";

    // Botón TODOS
    const btnAll = document.createElement("button");
    btnAll.className = `filter-btn ${!filtroPersonaRegistros ? "active" : ""}`;
    const spanAll = document.createElement("span");
    spanAll.className = "button_top";
    spanAll.innerText = "TODOS";
    spanAll.style.backgroundColor = "white";
    btnAll.appendChild(spanAll);
    btnAll.onclick = () => { filtroPersonaRegistros = null; renderizarVistaSemanRegistros(); };
    container.appendChild(btnAll);

    // Un botón por persona
    (state.configCache?.colaboradores || []).forEach(persona => {
        const color = obtenerColorPorNombre(persona);
        const btn = document.createElement("button");
        btn.className = `filter-btn ${filtroPersonaRegistros === persona ? "active" : ""}`;
        const span = document.createElement("span");
        span.className = "button_top";
        span.innerText = persona;
        span.style.backgroundColor = color;
        btn.appendChild(span);
        btn.onclick = () => { filtroPersonaRegistros = persona; renderizarVistaSemanRegistros(); };
        container.appendChild(btn);
    });
}

// ============================================================
// ESTADO EN TIEMPO REAL (dentro del modal)
// ============================================================
function renderizarEstadoEnModal(registrosSemana) {
    const container = document.getElementById("status-indicators");
    if (!container) return;

    const hoyKey = dateToKey(new Date());
    const registrosHoy = registrosSemana[hoyKey] || {};
    const colaboradores = state.configCache?.colaboradores || [];

    let html = '<div class="status-grid">';

    colaboradores.forEach(persona => {
        const eventos = registrosHoy[persona];
        let estado = { emoji: "⚪", texto: "Sin registro" };

        if (eventos && eventos.length > 0) {
            const ultimo = eventos[eventos.length - 1];
            estado = ESTADO_LABELS[ultimo.evento] || estado;
        }

        const color = obtenerColorPorNombre(persona);
        html += `
            <div class="status-chip" style="border-color: ${color}">
                <span class="status-emoji">${estado.emoji}</span>
                <span class="status-name">${persona}</span>
                <span class="status-text">${estado.texto}</span>
            </div>
        `;
    });

    html += "</div>";
    container.innerHTML = html;
}

// ============================================================
// ESTADO EN TIEMPO REAL (barra en página principal)
// ============================================================
export async function cargarEstadoActual() {
    const container = document.getElementById("status-bar");
    if (!container) return;

    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

    try {
        const q = query(
            collection(db, "registros_horarios"),
            where("timestamp", ">=", inicioHoy),
            where("timestamp", "<=", finHoy),
            orderBy("timestamp", "asc")
        );

        const snapshot = await getDocs(q);

        // Guardar último evento por persona
        const ultimoEvento = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            ultimoEvento[data.persona] = data.evento;
        });

        const colaboradores = state.configCache?.colaboradores || [];
        let html = "";

        colaboradores.forEach(persona => {
            const evento = ultimoEvento[persona];
            let estado = { emoji: "⚪", texto: "Sin registro" };
            if (evento) estado = ESTADO_LABELS[evento] || estado;

            html += `<span class="main-status-dot" title="${persona}: ${estado.texto}">${estado.emoji} ${persona}</span>`;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("Error cargando estado actual:", error);
        container.innerHTML = "";
    }
}

// ============================================================
// NAVEGACIÓN ENTRE SEMANAS
// ============================================================
function navegarSemanaRegistros(delta) {
    if (delta === 0) {
        semanaVista = getInicioSemana(new Date());
    } else {
        semanaVista = new Date(semanaVista);
        semanaVista.setDate(semanaVista.getDate() + (delta * 7));
    }
    renderizarVistaSemanRegistros();
}

// ============================================================
// IMPRIMIR REGISTROS
// ============================================================
function imprimirRegistros() {
    const content = document.getElementById("time-log-content");
    const label = document.getElementById("week-range-label");

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
        <html>
        <head>
            <title>Registros — ${label.innerText}</title>
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Space Grotesk', sans-serif; padding: 20px; }
                h2 { text-align: center; margin-bottom: 20px; }
                .tl-day-block { margin-bottom: 20px; }
                .tl-day-title { font-weight: bold; font-size: 1.1rem; margin-bottom: 8px; padding: 6px 12px; background: #d946ef; color: white; border-radius: 6px; }
                .time-log-table { width: 100%; border-collapse: collapse; }
                .time-log-table th, .time-log-table td { border: 1px solid #333; padding: 8px; text-align: center; }
                .time-log-table th { background: #fde68a; }
                .tl-persona-badge { padding: 2px 8px; border-radius: 4px; font-weight: bold; }
                .tl-empty { color: #999; font-style: italic; padding: 10px; }
                .tl-day-today { }
            </style>
        </head>
        <body>
            <h2>Registros de Horarios — ${label.innerText}</h2>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// ============================================================
// MOSTRAR REGISTROS (entry point desde admin console)
// ============================================================
async function mostrarRegistrosDeTiempo() {
    abrirModalDeFichaje();
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
export function inicializarTimeClock() {
    // Botón principal de fichaje
    document.getElementById("btn-abrir-fichaje").addEventListener("click", abrirModalDeFichaje);

    // Botones de eventos dentro del modal de fichaje
    document.getElementById("btn-entrada").addEventListener("click", () => registrarEventoDeTiempo("entrada"));
    document.getElementById("btn-inicio-almuerzo").addEventListener("click", () => registrarEventoDeTiempo("inicio_almuerzo"));
    document.getElementById("btn-fin-almuerzo").addEventListener("click", () => registrarEventoDeTiempo("fin_almuerzo"));
    document.getElementById("btn-salida").addEventListener("click", () => registrarEventoDeTiempo("salida"));

    // Registrar funciones globales para HTML onclick
    window.navegarSemanaRegistros = navegarSemanaRegistros;
    window.imprimirRegistros = imprimirRegistros;
}

export { mostrarRegistrosDeTiempo };
