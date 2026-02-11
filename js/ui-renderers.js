import { state } from "./state.js";
import { obtenerColorPorNombre } from "./scheduler.js";
import { UNIFORMES, DIAS_SEMANA } from "./constants.js"; // Import UNIFORMES and DIAS_SEMANA

export function renderizarPausaActiva() {
    const container = document.getElementById("pausa-activa-banner");
    if (!container) return;

    const colaboradores = state.configCache?.colaboradores;
    if (!colaboradores || colaboradores.length === 0) {
        container.style.display = "none";
        return;
    }

    const hoy = state.fechaHoy;
    if (hoy.getDay() === 0) { container.style.display = "none"; return; }

    // Día del año como índice para rotación diaria determinista
    const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
    const diaDelAnio = Math.floor((hoy - inicioAnio) / (24 * 60 * 60 * 1000));

    const indice = diaDelAnio % colaboradores.length;
    const personaAsignada = colaboradores[indice];
    const color = obtenerColorPorNombre(personaAsignada);

    container.style.display = "flex";
    container.innerHTML = `
        <span class="pausa-icon">🏃</span>
        <span class="pausa-text">PAUSA ACTIVA HOY: <strong>${personaAsignada.toUpperCase()}</strong></span>
    `;
    container.style.backgroundColor = color;
}

export function renderizarFiltrosEquipo(colaboradores) {
    const container = document.getElementById("team-filters");
    container.innerHTML = "";
    const btnAll = document.createElement("button");
    btnAll.className = `filter-btn ${state.filtroUsuarioActual === null ? 'active' : ''}`;
    const spanAll = document.createElement("span");
    spanAll.className = "button_top";
    spanAll.innerText = "TODOS";
    spanAll.style.backgroundColor = "white";
    btnAll.appendChild(spanAll);
    btnAll.onclick = () => window.aplicarFiltro(null);
    container.appendChild(btnAll);

    colaboradores.forEach(persona => {
        const color = obtenerColorPorNombre(persona);
        const btn = document.createElement("button");
        btn.className = `filter-btn ${state.filtroUsuarioActual === persona ? 'active' : ''}`;
        const span = document.createElement("span");
        span.className = "button_top";
        span.innerText = persona;
        span.style.backgroundColor = color;
        btn.appendChild(span);
        btn.onclick = () => window.aplicarFiltro(persona);
        container.appendChild(btn);
    });
}

function esCompletada(diaNum, persona) {
    return !!state.completadosCache[`${diaNum}-${persona}`];
}

function aplicarIntercambios(listaTareas, diaNum) {
    const swaps = state.intercambiosCache[String(diaNum)];
    if (!swaps || !swaps.length) return listaTareas;
    const copia = listaTareas.map(item => ({ ...item, tarea: { ...item.tarea } }));
    for (const swap of swaps) {
        const itemA = copia.find(i => i.persona === swap.personaA);
        const itemB = copia.find(i => i.persona === swap.personaB);
        if (itemA && itemB) {
            const tareaTemp = itemA.tarea;
            itemA.tarea = itemB.tarea;
            itemB.tarea = tareaTemp;
        }
    }
    return copia;
}

export function renderizarVistaSemanal(datos) {
    const container = document.getElementById("contenedor-principal");
    container.innerHTML = "";
    const semanasOrdenadas = Object.keys(datos).sort((a, b) => parseInt(a.replace("Semana ", "")) - parseInt(b.replace("Semana ", "")));
    let hayResultados = false;

    for (const semana of semanasOrdenadas) {
        const diasObj = datos[semana];
        const details = document.createElement("details");
        details.open = true;
        const summary = document.createElement("summary");
        summary.innerText = semana;
        details.appendChild(summary);
        const content = document.createElement("div");
        content.className = "details-content";

        const ordenDias = ["lunes", "martes", "miércoles", "miercoles", "jueves", "viernes", "sábado", "sabado"];
        const diasOrdenados = Object.keys(diasObj).sort((a, b) => ordenDias.indexOf(a.split(" ")[0].toLowerCase()) - ordenDias.indexOf(b.split(" ")[0].toLowerCase()));
        let semanaTieneDatos = false;

        for (const diaNombre of diasOrdenados) {
            const info = diasObj[diaNombre];
            const diaNum = info.diaNum;
            const listaTareasRaw = info.data ? info.data : info;
            const listaTareas = aplicarIntercambios(listaTareasRaw, diaNum);
            const tareasFiltradas = state.filtroUsuarioActual ? listaTareas.filter(t => t.persona === state.filtroUsuarioActual) : listaTareas;

            if (tareasFiltradas.length > 0) {
                semanaTieneDatos = true;
                hayResultados = true;
                const divDia = document.createElement("div");
                divDia.className = "dia-container";
                divDia.innerHTML = `<div class="dia-titulo">${diaNombre.toUpperCase()}</div>`;
                const grid = document.createElement("div");
                grid.className = "cards-grid";

                tareasFiltradas.forEach(item => {
                    const colorPersona = obtenerColorPorNombre(item.persona);
                    const claseExtra = item.tarea.tipo === "descanso" ? "card-descanso" : "";
                    const completada = esCompletada(diaNum, item.persona);
                    const claseCompletada = completada ? "card-completada" : "";
                    const personaSafe = item.persona.replace(/'/g, "\\'");
                    grid.innerHTML += `
                        <div class="collab-card ${claseExtra} ${claseCompletada}" style="background-color: ${colorPersona};"
                             onclick="window.toggleCompletado(${diaNum}, '${personaSafe}')">
                            <div class="card-name">${item.persona}</div>
                            <div class="card-task">${item.tarea.nombre}</div>
                        </div>
                    `;
                });
                divDia.appendChild(grid);
                content.appendChild(divDia);
            }
        }
        if (semanaTieneDatos) { details.appendChild(content); container.appendChild(details); }
    }
    if (!hayResultados) container.innerHTML = `<div style="text-align:center; padding:20px;">No hay tareas para ${state.filtroUsuarioActual}.</div>`;
}

export function renderizarUniformesSemanales(container) {
    container.innerHTML = `
        <table class="uniform-table">
            <thead>
                <tr>
                    <th>Día</th>
                    <th>👩 Mujeres</th>
                    <th>👨 Hombres</th>
                </tr>
            </thead>
            <tbody>
                ${DIAS_SEMANA.map(dia => `
                    <tr>
                        <td>${dia}</td>
                        <td>${UNIFORMES.mujeres[dia] || 'N/A'}</td>
                        <td>${UNIFORMES.hombres[dia] || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

export function renderizarVistaCalendario(datos) {
    const container = document.getElementById("contenedor-principal");
    container.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "calendar-wrapper";
    const header = document.createElement("div");
    header.className = "calendar-header";
    ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"].forEach(d => header.innerHTML += `<div>${d}</div>`);
    wrapper.appendChild(header);
    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    const year = state.mesVisto.getFullYear();
    const month = state.mesVisto.getMonth();
    let primerDiaSemana = new Date(year, month, 1).getDay();
    if (primerDiaSemana === 0) primerDiaSemana = 6; else primerDiaSemana = primerDiaSemana - 1;
    for (let i = 0; i < primerDiaSemana; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;

    const mapaDias = {};
    Object.values(datos).forEach(semana => {
        Object.entries(semana).forEach(([nombreDia, info]) => {
            let numDia = info.diaNum;
            let tareas = info.data;
            if (!numDia) {
                if (Array.isArray(info)) tareas = info;
                const partes = nombreDia.split(" ");
                if (partes.length > 1) numDia = parseInt(partes[partes.length - 1]);
            }
            if (numDia && tareas) mapaDias[numDia] = tareas;
        });
    });

    const diasTotal = new Date(year, month + 1, 0).getDate();

    for (let dia = 1; dia <= diasTotal; dia++) {
        const tareasDiaRaw = mapaDias[dia];
        const tareasDia = tareasDiaRaw ? aplicarIntercambios(tareasDiaRaw, dia) : null;
        let htmlContenido = '';
        if (tareasDia && Array.isArray(tareasDia)) {
            tareasDia.forEach(t => {
                if (state.filtroUsuarioActual && t.persona !== state.filtroUsuarioActual) return;
                const color = obtenerColorPorNombre(t.persona);
                const nombreSafe = t.persona.replace(/'/g, "\\'");
                const completada = esCompletada(dia, t.persona);
                const claseComp = completada ? "card-completada" : "";
                htmlContenido += `
                    <div class="cal-task-item ${claseComp}" style="background-color: ${color};"
                         onclick="window.toggleCompletado(${dia}, '${nombreSafe}')"
                         title="${t.persona}: ${t.tarea.nombre}">
                        <div class="cal-task-name">${t.persona}</div>
                        <div class="cal-task-desc">${t.tarea.nombre}</div>
                    </div>
                `;
            });
        }
        grid.innerHTML += `<div class="cal-day"><div class="cal-day-number">${dia}</div>${htmlContenido}</div>`;
    }
    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}