import { googleConfig } from "./config.js";
import { state } from "./state.js";

let tokenClient;
let gapiInited = false;
let gisInited = false;

export function cargarLibreriasGoogle() {
    if (typeof gapi !== 'undefined') gapi.load('client', initializeGapiClient);
    if (typeof google !== 'undefined') {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: googleConfig.clientId,
            scope: googleConfig.scopes,
            callback: '',
        });
        gisInited = true;
    }
}

async function initializeGapiClient() {
    await gapi.client.init({ apiKey: googleConfig.apiKey, discoveryDocs: [googleConfig.discoveryDoc] });
    gapiInited = true;
}

export async function sincronizarGoogleCalendar() {
    if (!state.filtroUsuarioActual) return alert("Primero selecciona tu nombre.");
    if (!gapiInited || !gisInited) return alert("Conectando con Google... espera unos segundos e intenta de nuevo.");

    const btn = document.getElementById("btn-google-sync");
    const status = document.getElementById("google-status");
    btn.disabled = true;
    btn.innerText = "⏳ PIDIENDO PERMISO...";

    tokenClient.callback = async (resp) => {
        if (resp.error) throw (resp);
        await crearEventosEnLote();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function crearEventosEnLote() {
    const btn = document.getElementById("btn-google-sync");
    const status = document.getElementById("google-status");
    btn.innerText = "🚀 ENVIANDO TAREAS...";

    let eventosCreados = 0;
    const year = state.fechaHoy.getFullYear();
    const month = state.fechaHoy.getMonth();

    const tareasParaAgendar = [];
    Object.values(state.datosCronogramaCache).forEach(semana => {
        Object.values(semana).forEach(info => {
            const diaNum = info.diaNum;
            const lista = info.data;
            if (diaNum && lista) {
                const tareaPersona = lista.find(t => t.persona === state.filtroUsuarioActual);
                if (tareaPersona && tareaPersona.tarea.tipo !== 'descanso') {
                    tareasParaAgendar.push({ dia: diaNum, tarea: tareaPersona.tarea });
                }
            }
        });
    });

    if (tareasParaAgendar.length === 0) {
        btn.disabled = false;
        btn.innerText = "SINCRONIZAR MI CALENDARIO";
        return alert("No tienes tareas asignadas este mes.");
    }

    for (const item of tareasParaAgendar) {
        const fechaInicio = new Date(year, month, item.dia);
        const dateString = fechaInicio.toISOString().split('T')[0];

        const event = {
            'summary': `🏠 ${item.tarea.nombre}`,
            'description': item.tarea.desc,
            'start': { 'date': dateString },
            'end': { 'date': dateString }
        };

        const nextDay = new Date(fechaInicio);
        nextDay.setDate(fechaInicio.getDate() + 1);
        event.end.date = nextDay.toISOString().split('T')[0];

        try {
            await gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event
            });
            eventosCreados++;
            status.innerText = `Procesando: ${eventosCreados}/${tareasParaAgendar.length}...`;
        } catch (error) {
            console.error("Error creando evento", error);
        }
    }

    btn.disabled = false;
    btn.innerText = "✅ ¡LISTO!";
    status.innerText = `Se agregaron ${eventosCreados} eventos a tu calendario.`;
    alert(`¡Éxito! Se han añadido ${eventosCreados} tareas a tu Google Calendar.`);
}
