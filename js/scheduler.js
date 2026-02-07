import { COLORES_PERSONAS } from "./constants.js";

export function obtenerColorPorNombre(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
        hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % COLORES_PERSONAS.length);
    return COLORES_PERSONAS[index];
}

export function generarMes(colaboradores, tareasBase, fechaHoy, ausencias = {}) {
    const year = fechaHoy.getFullYear();
    const month = fechaHoy.getMonth();
    const diasEnMes = new Date(year, month + 1, 0).getDate();

    const cronograma = {};
    let semanaNum = 1;
    let tareasAyer = {};
    let conteoDescansos = {};
    colaboradores.forEach(c => conteoDescansos[c] = 0);

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fechaObj = new Date(year, month, dia);
        const diaSemana = fechaObj.getDay();

        if (diaSemana === 0) continue;

        const colaboradoresHoy = colaboradores.filter(c => {
            if (!ausencias[c]) return true;
            for (const ausencia of ausencias[c]) {
                const from = new Date(ausencia.from);
                const to = new Date(ausencia.to);
                if (fechaObj >= from && fechaObj <= to) {
                    return false;
                }
            }
            return true;
        });

        // 1. Filtrar Tareas (usa diasPermitidos si existen, sino fallback)
        let tareasDelDia = tareasBase.filter(t => {
            if (t.tipo === "extra") return false;
            if (t.diasPermitidos && t.diasPermitidos.length > 0) {
                return t.diasPermitidos.includes(diaSemana);
            }
            return true;
        });

        // 2. Definir Trabajadores (Equidad)
        const totalCupos = colaboradoresHoy.length;
        const totalTrabajos = tareasDelDia.length;
        const numDescansosHoy = Math.max(0, totalCupos - totalTrabajos);

        let quienesDescansan = [];
        let quienesTrabajan = [];

        if (numDescansosHoy > 0) {
            const listaOrdenada = [...colaboradoresHoy].sort((a, b) => {
                const puntajeA = conteoDescansos[a] + Math.random();
                const puntajeB = conteoDescansos[b] + Math.random();
                return puntajeA - puntajeB;
            });
            quienesDescansan = listaOrdenada.slice(0, numDescansosHoy);
            quienesTrabajan = listaOrdenada.slice(numDescansosHoy);
            quienesDescansan.forEach(p => conteoDescansos[p]++);
        } else {
            quienesTrabajan = [...colaboradoresHoy];
        }

        // 3. Asignar Tareas Base
        let bolsaTareas = [...tareasDelDia];
        while (bolsaTareas.length > quienesTrabajan.length) bolsaTareas.pop();

        let asignacionesTrabajo = [];
        let intentos = 0;
        let esValido = false;

        while (!esValido && intentos < 10) {
            bolsaTareas.sort(() => Math.random() - 0.5);
            let hayRepeticionFea = false;
            const asignacionTemp = quienesTrabajan.map((persona, index) => ({
                persona: persona,
                tarea: { ...bolsaTareas[index] }
            }));
            if (intentos < 8) {
                for (let item of asignacionTemp) {
                    if (tareasAyer[item.persona] === item.tarea.nombre) {
                        hayRepeticionFea = true;
                        break;
                    }
                }
            }
            if (!hayRepeticionFea) {
                asignacionesTrabajo = asignacionTemp;
                esValido = true;
            }
            intentos++;
        }

        // 4. Asignar Tareas Extras
        const tareasExtras = tareasBase.filter(t => t.tipo === "extra" && t.diasPermitidos && t.diasPermitidos.includes(diaSemana));
        for (const tareaExtra of tareasExtras) {
            let candidatos = asignacionesTrabajo;
            if (tareaExtra.personasExcluidas && tareaExtra.personasExcluidas.length > 0) {
                candidatos = candidatos.filter(item => !tareaExtra.personasExcluidas.includes(item.persona));
            }
            if (candidatos.length > 0) {
                const afortunadoIndex = Math.floor(Math.random() * candidatos.length);
                const afortunado = candidatos[afortunadoIndex];
                afortunado.tarea.nombre += ` + ${tareaExtra.nombre}`;
                afortunado.tarea.desc += ` \n\n[ADEMÁS: ${tareaExtra.desc}]`;
            }
        }

        // 5. Unificar
        let asignacionesFinales = [...asignacionesTrabajo];
        quienesDescansan.forEach(persona => {
            asignacionesFinales.push({
                persona: persona,
                tarea: { nombre: "Descanso", tipo: "descanso", desc: "Día libre." }
            });
        });

        asignacionesFinales.forEach(item => { tareasAyer[item.persona] = item.tarea.nombre; });

        const keySemana = `Semana ${semanaNum}`;
        const nombreDia = fechaObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' });

        if (!cronograma[keySemana]) cronograma[keySemana] = {};
        cronograma[keySemana][nombreDia] = { data: asignacionesFinales, diaNum: dia };

        if (diaSemana === 6) semanaNum++;
    }
    return cronograma;
}
