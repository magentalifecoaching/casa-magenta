/* ==========================================================
   CASA MAGENTA - APP.JS (ORQUESTADOR UNIFICADO)
   ========================================================== */
import { db, doc, getDoc, setDoc, collection, query, orderBy, getDocs } from "./firebase.js";
import { state } from "./state.js";
import { ESTADO_INICIAL } from "./constants.js";
import { generarMes } from "./scheduler.js";
import { inicializarTimeClock, mostrarRegistrosDeTiempo, cargarEstadoActual } from "./time-clock.js";
import {
    renderizarFiltrosEquipo,
    renderizarVistaSemanal,
    renderizarPausaActiva,
    renderizarUniformesSemanales,
    renderizarVistaCalendario
} from "./ui-renderers.js";
import { 
    abrirSeguridad, 
    inicializarAdminConfirm, 
    renderizarEstadisticas 
} from "./admin.js";

// --- Registrar funciones globales para el HTML ---
window.abrirSeguridad = abrirSeguridad;
window.abrirConsolaAdministrativa = abrirConsolaAdministrativa;
window.mostrarUniformes = mostrarUniformes;
window.mostrarRegistrosDeTiempo = mostrarRegistrosDeTiempo;

function mostrarUniformes() {
    const modal = document.getElementById('uniform-modal');
    const uniformContent = document.getElementById('uniform-content');
    
    uniformContent.innerHTML = ''; // Clear previous content
    renderizarUniformesSemanales(uniformContent); // New function to render uniforms
    modal.showModal();
}


function abrirConsolaAdministrativa() {
    const modal = document.getElementById('admin-console-modal');
    const passwordSection = document.getElementById('admin-console-password-section');
    const contentSection = document.getElementById('admin-console-content');
    const passwordInput = document.getElementById('input-admin-console-password');

    // Resetear el modal a su estado inicial
    passwordInput.value = '';
    passwordSection.style.display = 'block';
    contentSection.style.display = 'none';
    
    modal.showModal();
}

document.getElementById('btn-admin-console-login').addEventListener('click', () => {
    const passwordInput = document.getElementById('input-admin-console-password');
    if (passwordInput.value === 'MAGENTACASA2026') {
        document.getElementById('admin-console-password-section').style.display = 'none';
        document.getElementById('admin-console-content').style.display = 'block';
    } else {
        alert('Contraseña incorrecta');
    }
});

document.getElementById('btn-admin-console-log').addEventListener('click', async () => {
    const logContent = document.getElementById('log-content');
    const logViewerModal = document.getElementById('log-viewer-modal');
    
    logContent.innerHTML = 'Cargando logs...';
    logViewerModal.style.display = 'block';

    try {
        const logsRef = collection(db, 'logs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            logContent.innerHTML = '<p>No hay logs para mostrar.</p>';
            return;
        }

        let logsHTML = '<ul>';
        querySnapshot.forEach(doc => {
            const log = doc.data();
            const date = new Date(log.timestamp.seconds * 1000).toLocaleString('es-ES');
            logsHTML += `<li><strong>${date}:</strong> ${log.message}</li>`;
        });
        logsHTML += '</ul>';
        logContent.innerHTML = logsHTML;

    } catch (error) {
        console.error("Error fetching logs:", error);
        logContent.innerHTML = '<p>Error al cargar los logs. Intenta de nuevo más tarde.</p>';
    }
});

/**
 * Actualiza el texto del banner superior con el mes que se está visualizando.
 */
function actualizarBannerMes() {
    const opcionesFecha = { month: 'long', year: 'numeric' };
    const texto = state.mesVisto.toLocaleDateString('es-ES', opcionesFecha).toUpperCase();
    document.getElementById("fecha-actual").innerText = texto;
}

/**
 * Cambia entre vista semanal y calendario, forzando el re-renderizado.
 */
window.cambiarVista = (vista) => {
    // Actualizar botones
    document.querySelectorAll('.btn-view').forEach(btn => btn.classList.remove('active'));
    if (vista === 'weekly') document.getElementById('btn-view-weekly').classList.add('active');
    else if (vista === 'calendar') document.getElementById('btn-view-calendar').classList.add('active');

    // Mostrar/Ocultar botón de imprimir
    const btnPrint = document.getElementById('btn-print');
    btnPrint.style.display = (vista === 'calendar') ? 'inline-block' : 'none';

    // Guardar estado
    document.body.dataset.vistaActual = vista;
    
    if (!state.datosCronogramaCache) return;

    // Renderizar
    if (vista === 'weekly') renderizarVistaSemanal(state.datosCronogramaCache);
    if (vista === 'calendar') renderizarVistaCalendario(state.datosCronogramaCache);
};

/**
 * Filtra las tareas por un colaborador específico.
 */
window.aplicarFiltro = (nombrePersona) => {
    state.filtroUsuarioActual = nombrePersona;
    renderizarFiltrosEquipo(state.configCache.colaboradores);

    const vistaActual = document.body.dataset.vistaActual || 'weekly';
    window.cambiarVista(vistaActual);
};

/**
 * Carga los datos de un mes específico desde Firebase.
 */
async function cargarMes() {
    const container = document.getElementById("contenedor-principal");
    container.innerHTML = `<div class="loading">Cargando datos de ${state.idMesVisto}...</div>`;

    // 1. Obtener Cronograma
    const cronoRef = doc(db, "cronogramas", state.idMesVisto);
    const cronoSnap = await getDoc(cronoRef);

    if (cronoSnap.exists()) {
        state.datosCronogramaCache = cronoSnap.data().datos;
    } else {
        state.datosCronogramaCache = null;
    }

    // 2. Obtener Completados, Intercambios y Ausencias en paralelo
    const [compSnap, intSnap, ausSnap] = await Promise.all([
        getDoc(doc(db, "completados", state.idMesVisto)),
        getDoc(doc(db, "intercambios", state.idMesVisto)),
        getDoc(doc(db, "ausencias", "general"))
    ]);

    state.completadosCache = compSnap.exists() ? compSnap.data() : {};
    state.intercambiosCache = intSnap.exists() ? intSnap.data() : {};
    state.ausenciasCache = ausSnap.exists() ? ausSnap.data() : {};

    // 3. Actualizar UI
    actualizarBannerMes();
    renderizarPausaActiva();
    
    if (state.datosCronogramaCache) {
        document.body.dataset.vistaActual = 'weekly';
        const vistaActual = document.body.dataset.vistaActual || 'weekly';
    window.cambiarVista(vistaActual);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <p>No hay cronograma para este mes.</p>
                <button class="btn-regen" onclick="window.abrirSeguridad('random')"><span class="button_top">⚡ GENERAR AHORA</span></button>
            </div>`;
    }
}

/**
 * Alterna el estado de una tarea (Hecha / Pendiente).
 */
window.toggleCompletado = async (diaNum, persona) => {
    const key = `${diaNum}-${persona}`;
    
    // Toggle lógico
    if (state.completadosCache[key]) {
        delete state.completadosCache[key];
    } else {
        state.completadosCache[key] = true;
    }

    // Guardar en Firestore (optimista: primero UI, luego DB)
    try {
        const completadosRef = doc(db, "completados", state.idMesVisto);
        await setDoc(completadosRef, state.completadosCache);
    } catch (e) {
        console.error("Error guardando completado:", e);
    }

    // Re-renderizar
    const vistaActual = document.body.dataset.vistaActual || 'weekly';
    window.cambiarVista(vistaActual);
};

/**
 * Lógica de regeneración: Soluciona el error de actualización de banner y días.
 * Se llama desde admin.js cuando se confirma una acción.
 */
async function regenerarMesLogica(configData, fechaTarget) {
    const config = configData || state.configCache || ESTADO_INICIAL;
    
    // Si no se especifica fecha, usar la que se está viendo actualmente
    const fecha = fechaTarget || state.mesVisto;
    
    // Ajustar el ID del mes correctamente
    const mesID = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
    
    // Generar datos (scheduler.js maneja la longitud del mes usando fecha)
    const nuevosDatos = generarMes(config.colaboradores, config.tareasBase, fecha, state.ausenciasCache);
    
    // Guardar en Firestore
    await setDoc(doc(db, "cronogramas", mesID), { 
        datos: nuevosDatos, 
        fechaGeneracion: new Date() 
    });

    // Actualizar estado global para forzar la navegación a ese mes
    state.mesVisto = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    state.idMesVisto = mesID;
    
    // Limpiar cachés locales momentáneos
    state.completadosCache = {};
    state.intercambiosCache = {};

    // Recargar todo el flujo
    await cargarMes();
}

/**
 * Muestra/Oculta la sección de estadísticas y las renderiza.
 */
window.mostrarEstadisticas = () => {
    const section = document.getElementById("stats-section");
    
    // Toggle (Si está visible, ocultar)
    if (section.style.display !== "none") {
        section.style.display = "none";
        return;
    }

    if (!state.datosCronogramaCache) return alert("No hay datos para calcular estadísticas.");
    
    // Renderizar usando la función de admin.js
    renderizarEstadisticas();
    
    // Mostrar y hacer scroll
    section.style.display = "block";
    section.scrollIntoView({ behavior: "smooth" });
};

/**
 * Inicialización de la aplicación.
 */
async function iniciarApp() {
    // 1. Cargar Configuración General
    const configSnap = await getDoc(doc(db, "config", "general"));
    state.configCache = configSnap.exists() ? configSnap.data() : ESTADO_INICIAL;
    
    // 2. Renderizar Elementos Estáticos (Filtros y botones de info)
    renderizarFiltrosEquipo(state.configCache.colaboradores);
    
    const containerAct = document.getElementById("activities-container");
    containerAct.innerHTML = "";
    state.configCache.tareasBase.forEach(tarea => {
        const btn = document.createElement("button");
        const span = document.createElement("span");
        span.className = "button_top";
        span.innerText = tarea.nombre;
        btn.appendChild(span);
        btn.onclick = () => {
            document.getElementById("modal-title").innerText = tarea.nombre;
            document.getElementById("modal-desc").innerText = tarea.desc;
            document.getElementById("task-modal").showModal();
        };
        containerAct.appendChild(btn);
    });

    // 3. Cargar estado actual del fichaje (barra de status)
    cargarEstadoActual();

    // 4. Cargar el mes actual
    await cargarMes();

    // 5. Si es el mes actual y está vacío, proponer generarlo automáticamente
    if (!state.datosCronogramaCache && state.idMesVisto === state.idMes) {
        console.log("Mes actual vacío, generando automáticamente...");
        await regenerarMesLogica(state.configCache);
    }
}

// --- Eventos de Navegación de Meses (< Anterior | Siguiente >) ---
window.navegarMes = async (delta) => {
    state.mesVisto = new Date(state.mesVisto.getFullYear(), state.mesVisto.getMonth() + delta, 1);
    state.idMesVisto = `${state.mesVisto.getFullYear()}-${state.mesVisto.getMonth() + 1}`;
    await cargarMes();
};

// --- Vinculación de Módulos ---
// Pasamos la función de regeneración al admin para que pueda llamarla tras cambios
inicializarAdminConfirm(regenerarMesLogica);
inicializarTimeClock();

// --- Arrancar App ---
iniciarApp();