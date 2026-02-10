export const PASSWORD_ADMIN = "MAGENTECASA2026";

export const ESTADO_INICIAL = {
    colaboradores: ["Silvana", "Juan Diego", "Katherin G", "Juan Manuel", "Laura", "Edwin", "Maria Fernanda"],
    tareasBase: [
        { nombre: "Revisión Cocina", tipo: "normal", desc: "Lavar loza acumulada, limpiar mesones, barrer el suelo y sacar basura orgánica." },
        { nombre: "Revisión Baños", tipo: "normal", desc: "Limpiar inodoro, lavamanos, espejo, ducha y reponer papel higiénico." },
        { nombre: "Aseo Patio", tipo: "especial", desc: "Barrer hojas secas, limpiar zona de mascotas, organizar sillas y regar plantas." },
        { nombre: "Revisión Salón", tipo: "normal", desc: "Sacudir polvo de mesas, acomodar cojines, barrer la zona común y limpiar comedor." },
        { nombre: "Ayuda General", tipo: "urgente", desc: "Estar disponible para emergencias, abrir la puerta, compras rápidas o apoyar a quien lo necesite." },
        { nombre: "Sacar Basura", tipo: "normal", desc: "Recoger bolsas de todas las papeleras de la casa y llevarlas al contenedor principal.", diasPermitidos: [1, 4, 6] },
        { nombre: "Estación de Café", tipo: "extra", desc: "Café en la tarde, llenar maní, galletas, sacar la estación de café.", diasPermitidos: [2, 3], personasExcluidas: ["Laura", "Edwin"] }
    ],
    coloresCamiseta: {
        "Lunes": "#FF6B6B",
        "Martes": "#4ECDC4",
        "Miércoles": "#45B7D1",
        "Jueves": "#96CEB4",
        "Viernes": "#FFEAA7",
        "Sábado": "#DDA0DD"
    }
};

export const COLORES_PERSONAS = [
    "#FF99C8", "#A9DEF9", "#E4C1F9", "#D0F4DE", "#FCF6BD",
    "#FF9F1C", "#2EC4B6", "#CBF3F0", "#FFBF69", "#FFADAD", "#BDB2FF"
];

export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const UNIFORMES = {
    mujeres: {
        "Lunes": "Buzo magenta y pantalón negro",
        "Martes": "Set gris body vino tinto",
        "Miércoles": "Body blanco pantalón beige",
        "Jueves": "Blazer magenta y pantalón negro",
        "Viernes": "Polo (azul y blanca) y jean clásico (sin rotos)"
    },
    hombres: {
        "Lunes": "Pantalón beige camisa blanca",
        "Martes": "Pantalón negro y polo blanca",
        "Miércoles": "Pantalón beige camisa blanca",
        "Jueves": "Pantalón gris y polo azul",
        "Viernes": "Pantalón negro y camisa blanca"
    }
};
