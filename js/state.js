export const state = {
    datosCronogramaCache: null,
    configCache: null,
    filtroUsuarioActual: null,
    accionPendiente: null,
    fechaHoy: new Date(),
    mesVisto: new Date(),
    idMes: null,
    idMesVisto: null,
    completadosCache: {},
    intercambiosCache: {}
};

state.idMes = `${state.fechaHoy.getFullYear()}-${state.fechaHoy.getMonth() + 1}`;
state.idMesVisto = state.idMes;
