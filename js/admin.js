/* ==========================================================
   CASA MAGENTA - ADMIN.JS (LÓGICA DE GESTIÓN)
   ========================================================== */
import { db, doc, getDoc, setDoc } from "./firebase.js";
import { state } from "./state.js";
import { PASSWORD_ADMIN, ESTADO_INICIAL, DIAS_SEMANA } from "./constants.js";
import { renderizarFiltrosEquipo } from "./ui-renderers.js";

/**
 * Abre el modal correspondiente según la acción solicitada.
 * Maneja tanto el modal general de Admin como los modales específicos.
 */
export function abrirSeguridad(accion) {
    state.accionPendiente = accion;

    // --- ACCIONES DE MODAL ESPECÍFICO ---

    // 1. Intercambio (Swap)
    if (accion === 'swap') {
        const modal = document.getElementById("swap-modal");
        
        // Llenar selects de personas
        const colabs = state.configCache?.colaboradores || [];
        ["select-swap-person1", "select-swap-person2"].forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = `<option value="" disabled selected>Seleccionar persona...</option>`;
            colabs.forEach(c => { sel.innerHTML += `<option value="${c}">${c}</option>`; });
        });
        
        // Resetear fecha
        document.getElementById("input-swap-date").value = "";
        modal.showModal();
        return;
    }

    // 2. Ausencias (Absent)
    if (accion === 'absent') {
        const modal = document.getElementById("absent-modal");
        const selPersona = document.getElementById("select-absent-person");
        selPersona.innerHTML = `<option value="" disabled selected>Seleccionar persona...</option>`;
        (state.configCache?.colaboradores || []).forEach(c => {
            selPersona.innerHTML += `<option value="${c}">${c}</option>`;
        });
        document.getElementById("input-absent-from").value = "";
        document.getElementById("input-absent-to").value = "";
        modal.showModal();
        return;
    }

    // 3. Reglas (Rules)
    if (accion === 'rules') {
        const modal = document.getElementById("rules-modal");
        renderizarReglas();
        modal.showModal();
        return;
    }

    // --- ACCIONES DEL MODAL GENERAL DE ADMIN (Requieren Password) ---
    
    const modalAdmin = document.getElementById("admin-modal");
    document.getElementById("input-password").value = "";
    document.getElementById("input-nuevo-nombre").value = "";

    // Ocultar todos los campos extra primero
    document.querySelectorAll(".admin-extra-field").forEach(el => el.style.display = "none");

    if (accion === 'add') {
        document.getElementById("admin-extra-field-add").style.display = "block";

    } else if (accion === 'delete') {
        const field = document.getElementById("admin-extra-field-delete");
        field.style.display = "block";
        const selectDelete = document.getElementById("select-colaborador-eliminar");
        selectDelete.innerHTML = `<option value="" disabled selected>Selecciona...</option>`;
        if (state.configCache?.colaboradores) {
            state.configCache.colaboradores.forEach(colab => {
                selectDelete.innerHTML += `<option value="${colab}">${colab}</option>`;
            });
        }

    } else if (accion === 'random') {
        document.getElementById("admin-extra-field-random").style.display = "block";
        const inputMonth = document.getElementById("input-random-month");
        const y = state.mesVisto.getFullYear();
        const m = String(state.mesVisto.getMonth() + 1).padStart(2, '0');
        inputMonth.value = `${y}-${m}`;

    } else if (accion === 'shirt') {
        document.getElementById("admin-extra-field-shirt").style.display = "block";
        const container = document.getElementById("shirt-color-inputs");
        container.innerHTML = "";
        DIAS_SEMANA.forEach(dia => {
            const currentColor = state.configCache?.coloresCamiseta?.[dia] || "#cccccc";
            container.innerHTML += `
                <div class="shirt-day-row">
                    <span>${dia}</span>
                    <input type="color" id="shirt-${dia}" value="${currentColor}">
                </div>
            `;
        });
    }

    modalAdmin.showModal();
}

/**
 * Inicializa todos los listeners de los botones "CONFIRMAR" de los diferentes modales.
 */
export function inicializarAdminConfirm(regenerarMesLogica) {
    
    // --- 1. CONFIRMAR ACCIONES GENERALES (Add, Delete, Random, Shirt) ---
    document.getElementById("btn-confirmar-admin").onclick = async () => {
        const pass = document.getElementById("input-password").value;
        if (pass !== PASSWORD_ADMIN) return alert("⛔ CONTRASEÑA INCORRECTA");
        
        document.getElementById("admin-modal").close();
        
        try {
            const configRef = doc(db, "config", "general");
            const snap = await getDoc(configRef);
            let data = snap.exists() ? snap.data() : ESTADO_INICIAL;

            if (state.accionPendiente === 'add') {
                const nuevo = document.getElementById("input-nuevo-nombre").value.trim();
                if (nuevo) {
                    data.colaboradores.push(nuevo);
                    await guardarYRegenerar(configRef, data, `✅ ${nuevo} agregado.`, regenerarMesLogica);
                }

            } else if (state.accionPendiente === 'delete') {
                const eliminado = document.getElementById("select-colaborador-eliminar").value;
                if (!eliminado) return alert("❌ No seleccionaste a nadie.");
                data.colaboradores = data.colaboradores.filter(c => c !== eliminado);
                await guardarYRegenerar(configRef, data, `🗑️ ${eliminado} eliminado.`, regenerarMesLogica);

            } else if (state.accionPendiente === 'random') {
                const inputMonth = document.getElementById("input-random-month").value;
                let fechaTarget = null;
                if (inputMonth) {
                    const [yr, mo] = inputMonth.split("-").map(Number);
                    fechaTarget = new Date(yr, mo - 1, 1);
                }
                // Llamamos a regenerar pasando la fecha específica
                await regenerarMesLogica(data, fechaTarget);
                alert(`⚡ Mes randomizado correctamente.`);

            } else if (state.accionPendiente === 'shirt') {
                const colores = {};
                DIAS_SEMANA.forEach(dia => {
                    colores[dia] = document.getElementById(`shirt-${dia}`).value;
                });
                data.coloresCamiseta = colores;
                await setDoc(configRef, data);
                state.configCache = data;
                alert("👕 Colores guardados.");
                window.location.reload(); // Recargar para ver cambios
            }
        } catch (e) { alert("Error: " + e.message); }
    };

    // --- 2. CONFIRMAR INTERCAMBIO (SWAP) ---
    document.getElementById("btn-confirmar-swap").onclick = async () => {
        const fechaStr = document.getElementById("input-swap-date").value; // YYYY-MM-DD
        const personaA = document.getElementById("select-swap-person1").value;
        const personaB = document.getElementById("select-swap-person2").value;

        if (!fechaStr || !personaA || !personaB) return alert("❌ Completa todos los campos.");
        if (personaA === personaB) return alert("❌ Selecciona dos personas diferentes.");

        // Obtener día numérico del mes
        const fecha = new Date(fechaStr + "T00:00:00"); // Forzar hora local
        const diaNum = fecha.getDate();
        
        // Validar que la fecha corresponda al mes visto (opcional, pero recomendado)
        if (fecha.getMonth() !== state.mesVisto.getMonth()) {
            if(!confirm("⚠️ La fecha seleccionada no es del mes que estás viendo. ¿Continuar?")) return;
        }

        if (!state.intercambiosCache[diaNum]) state.intercambiosCache[diaNum] = [];
        state.intercambiosCache[diaNum].push({ personaA, personaB });
        
        await setDoc(doc(db, "intercambios", state.idMesVisto), state.intercambiosCache);
        
        document.getElementById("swap-modal").close();
        alert(`🔄 Intercambio realizado para el día ${diaNum}.`);
        
        const vistaActual = document.body.dataset.vistaActual || 'weekly';
        window.cambiarVista(vistaActual);
    };

    // --- 3. CONFIRMAR AUSENCIA (ABSENT) ---
    document.getElementById("btn-confirmar-absent").onclick = async () => {
        const person = document.getElementById("select-absent-person").value;
        const from = document.getElementById("input-absent-from").value;
        const to = document.getElementById("input-absent-to").value;
    
        if (!person || !from || !to) return alert("❌ Debes rellenar todos los campos.");
    
        if (!state.ausenciasCache[person]) state.ausenciasCache[person] = [];
        state.ausenciasCache[person].push({ from, to });
    
        const ausenciasRef = doc(db, "ausencias", "general");
        await setDoc(ausenciasRef, state.ausenciasCache);
    
        document.getElementById("absent-modal").close();
        
        if(confirm("✅ Ausencia guardada. ¿Quieres regenerar el mes actual para aplicar los cambios ahora?")) {
             await regenerarMesLogica();
        }
    };

    // --- 4. GUARDAR REGLAS (RULES) ---
    document.getElementById("btn-save-rules").onclick = async () => {
        const tareasBase = JSON.parse(JSON.stringify(state.configCache?.tareasBase || ESTADO_INICIAL.tareasBase));
        
        tareasBase.forEach((tarea, idx) => {
            // Leer días permitidos
            const checksDias = document.querySelectorAll(`input[id^="dias-${idx}-"]:checked`);
            const diasPermitidos = Array.from(checksDias).map(ch => parseInt(ch.value));
            tarea.diasPermitidos = diasPermitidos;

            // Leer personas excluidas
            const checksPersonas = document.querySelectorAll(`input[id^="personas-${idx}-"]:checked`);
            const personasExcluidas = Array.from(checksPersonas).map(ch => ch.value);
            tarea.personasExcluidas = personasExcluidas;
        });

        const configRef = doc(db, "config", "general");
        const nuevaConfig = { ...state.configCache, tareasBase: tareasBase };
        
        await setDoc(configRef, nuevaConfig);
        state.configCache = nuevaConfig;
        
        document.getElementById("rules-modal").close();
        alert("⚙️ Reglas actualizadas.");
        
        // Regenerar para aplicar reglas
        await regenerarMesLogica(nuevaConfig);
    };
}

/**
 * Renderiza el formulario de reglas dentro del modal.
 */
export function renderizarReglas() {
    const container = document.getElementById("rules-container");
    container.innerHTML = "";

    (state.configCache?.tareasBase || ESTADO_INICIAL.tareasBase).forEach((tarea, idx) => {
        const ruleDiv = document.createElement("div");
        ruleDiv.className = "rule-item";
        
        const title = document.createElement("h4");
        title.innerText = `Regla: ${tarea.nombre}`;
        title.style.margin = "0 0 10px 0";
        title.style.textDecoration = "underline";
        ruleDiv.appendChild(title);

        // 1. Días Permitidos
        const diasLabel = document.createElement("label");
        diasLabel.innerHTML = "<strong>Días permitidos:</strong>";
        ruleDiv.appendChild(diasLabel);

        const diasContainer = document.createElement("div");
        diasContainer.className = "dias-container";
        const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        
        for (let i = 0; i < 7; i++) {
            const wrapper = document.createElement("div");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `dias-${idx}-${i}`;
            checkbox.value = i;
            
            // Si no existe array, asumimos todos permitidos, salvo que sea explícito
            if (!tarea.diasPermitidos || tarea.diasPermitidos.includes(i)) {
                checkbox.checked = true;
            }
            
            const label = document.createElement("label");
            label.htmlFor = `dias-${idx}-${i}`;
            label.innerText = dias[i];
            
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            diasContainer.appendChild(wrapper);
        }
        ruleDiv.appendChild(diasContainer);

        // 2. Personas Excluidas
        const personasLabel = document.createElement("label");
        personasLabel.innerHTML = "<strong>Personas Excluidas:</strong>";
        personasLabel.style.marginTop = "10px";
        ruleDiv.appendChild(personasLabel);

        const personasContainer = document.createElement("div");
        personasContainer.className = "personas-container";
        
        state.configCache.colaboradores.forEach(persona => {
            const wrapper = document.createElement("div");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = `personas-${idx}-${persona}`;
            checkbox.value = persona;
            
            if (tarea.personasExcluidas && tarea.personasExcluidas.includes(persona)) {
                checkbox.checked = true;
            }
            
            const label = document.createElement("label");
            label.htmlFor = `personas-${idx}-${persona}`;
            label.innerText = persona;
            
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);
            personasContainer.appendChild(wrapper);
        });
        ruleDiv.appendChild(personasContainer);

        container.appendChild(ruleDiv);
    });
}

/**
 * Calcula estadísticas basadas en el cronograma actual.
 */
function calcularEstadisticas(datosCronogramaCache) {
    const estadisticas = {};
    if (!datosCronogramaCache) return estadisticas;

    Object.values(datosCronogramaCache).forEach(semana => {
        Object.values(semana).forEach(info => {
            const listaTareas = info.data || info; // Manejo seguro de estructura
            if (Array.isArray(listaTareas)) {
                listaTareas.forEach(item => {
                    const persona = item.persona;
                    const nombreTareaBase = item.tarea.nombre.split(" + ")[0]; // Ignorar extras en el nombre base

                    if (!estadisticas[persona]) {
                        estadisticas[persona] = { total: 0, descanso: 0, tareas: {} };
                    }

                    if (item.tarea.tipo === 'descanso') {
                        estadisticas[persona].descanso++;
                    } else {
                        estadisticas[persona].total++; // Total de trabajos
                        if (!estadisticas[persona].tareas[nombreTareaBase]) {
                            estadisticas[persona].tareas[nombreTareaBase] = 0;
                        }
                        estadisticas[persona].tareas[nombreTareaBase]++;
                    }
                });
            }
        });
    });
    return estadisticas;
}

/**
 * Genera el HTML de la tabla de estadísticas.
 */
export function renderizarEstadisticas() {
    const container = document.getElementById("stats-container");
    container.innerHTML = "";

    const estadisticas = calcularEstadisticas(state.datosCronogramaCache);
    if (Object.keys(estadisticas).length === 0) {
        container.innerHTML = "<p>No hay datos suficientes.</p>";
        return;
    }

    // Obtener lista única de tareas encontradas
    const tareasEncontradas = new Set();
    Object.values(estadisticas).forEach(p => {
        Object.keys(p.tareas).forEach(t => tareasEncontradas.add(t));
    });
    const listaTareas = Array.from(tareasEncontradas).sort();

    const table = document.createElement("table");
    table.className = "stats-table";

    // Header
    const thead = document.createElement("thead");
    let headerHTML = `<tr><th>Persona</th><th>Trabajos</th><th>Descansos</th>`;
    listaTareas.forEach(t => headerHTML += `<th style="font-size:0.8rem">${t}</th>`);
    headerHTML += `</tr>`;
    thead.innerHTML = headerHTML;
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    Object.keys(estadisticas).sort().forEach(persona => {
        const stats = estadisticas[persona];
        let rowHTML = `<tr>
            <td><strong>${persona}</strong></td>
            <td>${stats.total}</td>
            <td>${stats.descanso}</td>`;
        
        listaTareas.forEach(t => {
            rowHTML += `<td>${stats.tareas[t] || 0}</td>`;
        });
        rowHTML += `</tr>`;
        tbody.innerHTML += rowHTML;
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

/**
 * Función auxiliar para actualizar configuración y regenerar.
 */
export async function guardarYRegenerar(ref, data, mensajeExito, regenerarMesLogica) {
    await setDoc(ref, data);
    state.configCache = data;
    renderizarFiltrosEquipo(data.colaboradores);
    await regenerarMesLogica(data);
    alert(mensajeExito);
}