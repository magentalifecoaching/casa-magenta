/* ==========================================================
   CASA MAGENTA - APP.JS (ORQUESTADOR UNIFICADO)
   ========================================================== */
import { db, doc, getDoc, setDoc } from "./firebase.js";
import { state } from "./state.js";
import { ESTADO_INICIAL } from "./constants.js";
import { generarMes } from "./scheduler.js";
import { cargarLibreriasGoogle, sincronizarGoogleCalendar } from "./google-calendar.js";
import {
    renderizarFiltrosEquipo,
    renderizarVistaSemanal,
    renderizarVistaCalendario,
    renderizarUniforme,
    renderizarPausaActiva
} from "./ui-renderers.js";
import { 
    abrirSeguridad, 
    inicializarAdminConfirm, 
    renderizarEstadisticas 
} from "./admin.js";

// --- Registrar funciones globales para el HTML ---
window.abrirSeguridad = abrirSeguridad;
window.sincronizarGoogleCalendar = sincronizarGoogleCalendar;

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

    const btnContainer = document.getElementById("export-container");
    if (state.filtroUsuarioActual) {
        btnContainer.style.display = "block";
        const btnSync = document.getElementById("btn-google-sync");
        btnSync.innerText = "SINCRONIZAR MI CALENDARIO";
        btnSync.disabled = false;
        document.getElementById("google-status").innerText = "(Se añadirán tus eventos directamente a tu cuenta Google)";
    } else {
        btnContainer.style.display = "none";
    }

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
    renderizarUniforme();
    renderizarPausaActiva();
    
    if (state.datosCronogramaCache) {
        const vistaActual = document.body.dataset.vistaActual || 'weekly';
        window.cambiarVista(vistaActual);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <p>No hay cronograma para este mes.</p>
                <button class="btn-regen" onclick="window.abrirSeguridad('random')">⚡ GENERAR AHORA</button>
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
        btn.innerText = tarea.nombre;
        btn.onclick = () => {
            document.getElementById("modal-title").innerText = tarea.nombre;
            document.getElementById("modal-desc").innerText = tarea.desc;
            document.getElementById("task-modal").showModal();
        };
        containerAct.appendChild(btn);
    });

    // 3. Cargar el mes actual
    await cargarMes();

    // 4. Si es el mes actual y está vacío, proponer generarlo automáticamente
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

// Iniciar carga de Google API con un pequeño delay para no bloquear renderizado inicial
setTimeout(cargarLibreriasGoogle, 1500);

// --- Arrancar App ---
iniciarApp();