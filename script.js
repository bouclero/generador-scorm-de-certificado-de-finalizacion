// Variables globales para el estado de SCORM
let scormAPI = null;
let scormInitialized = false;
let scormFinished = false;

// Constantes para SCORM (podrían variar según la especificación SCORM)
const SCORM_TRUE = "true";
const SCORM_FALSE = "false";
const SCORM_NO_ERROR = "0";

// --- Funciones de búsqueda de la API de SCORM ---
function findAPI(win) {
    let tries = 0;
    const maxTries = 7; // Límite para evitar bucles infinitos
    while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
        tries++;
        if (tries > maxTries) {
            console.warn("SCORM API: Demasiados intentos para encontrar la API, deteniendo búsqueda.");
            return null;
        }
        win = win.parent;
    }
    return win.API;
}

function getAPI() {
    let api = findAPI(window);
    if ((api == null) && (window.opener != null) && (typeof(window.opener) != "undefined")) {
        api = findAPI(window.opener);
    }
    if (api == null) {
        console.error("SCORM API: No se pudo localizar la API de SCORM.");
        document.getElementById('scorm-status-message').textContent = "Error: No se pudo conectar con el LMS.";
    }
    return api;
}

// --- Funciones de ciclo de vida de SCORM ---
function initScorm() {
    scormAPI = getAPI();
    if (scormAPI == null) {
        document.getElementById('generate-certificate-btn').disabled = true;
        document.getElementById('generate-certificate-btn').title = "SCORM API no disponible";
        return;
    }

    const result = scormAPI.LMSInitialize("");
    if (result === SCORM_TRUE) {
        scormInitialized = true;
        console.log("SCORM API Inicializado.");
        document.getElementById('scorm-status-message').textContent = "Conectado al LMS.";
        
        // Opcional: Verificar si el curso ya está completado
        const lessonStatus = scormAPI.LMSGetValue("cmi.core.lesson_status");
        console.log("Estado actual de la lección:", lessonStatus);
        if (lessonStatus === "completed" || lessonStatus === "passed") {
            console.log("Este SCO ya ha sido marcado como completado anteriormente.");
            // Podrías decidir mostrar el certificado directamente si ya está completado.
            // Para este ejemplo, el usuario aún debe hacer clic.
        }
    } else {
        scormInitialized = false;
        console.error("Error al inicializar SCORM API. Código: " + scormAPI.LMSGetLastError());
        document.getElementById('scorm-status-message').textContent = "Error al conectar con el LMS.";
        document.getElementById('generate-certificate-btn').disabled = true;
    }
}

function terminateScorm() {
    if (scormAPI != null && scormInitialized && !scormFinished) {
        // Guardar cualquier dato pendiente antes de finalizar.
        // LMSCommit es opcional aquí si ya se hizo después de SetValue, pero es buena práctica.
        scormAPI.LMSCommit(""); 
        const result = scormAPI.LMSFinish("");
        if (result === SCORM_TRUE) {
            scormFinished = true;
            console.log("SCORM API Terminado.");
        } else {
            console.error("Error al terminar SCORM API. Código: " + scormAPI.LMSGetLastError());
        }
    }
}

// --- Funciones de datos de SCORM ---
function getStudentNameFromLMS() {
    if (scormAPI != null && scormInitialized) {
        const studentNameLMS = scormAPI.LMSGetValue("cmi.core.student_name");
        const errorCode = scormAPI.LMSGetLastError();

        if (errorCode !== SCORM_NO_ERROR && errorCode !== "403") { // 403 puede ser "no implementado" o "solo lectura"
            console.warn("LMSGetValue(cmi.core.student_name) Error. Código: " + errorCode);
        }
        
        if (studentNameLMS && studentNameLMS !== "") {
            // SCORM suele devolver "Apellido, Nombre"
            const parts = studentNameLMS.split(',');
            if (parts.length === 2) {
                return parts[1].trim() + " " + parts[0].trim(); // Formato "Nombre Apellido"
            }
            return studentNameLMS; // Devolver tal cual si no es el formato esperado
        } else {
            console.warn("Nombre del estudiante no encontrado o vacío en el LMS.");
            return "Estudiante"; // Nombre por defecto
        }
    }
    return "Estudiante (SCORM no disp.)";
}

function setLessonCompleted() {
    if (scormAPI != null && scormInitialized) {
        const resultStatus = scormAPI.LMSSetValue("cmi.core.lesson_status", "completed");
        if (resultStatus !== SCORM_TRUE) {
            console.error("Error LMSSetValue(cmi.core.lesson_status, 'completed'). Código: " + scormAPI.LMSGetLastError());
        }
        // Opcional: Establecer una puntuación si es relevante
        // scormAPI.LMSSetValue("cmi.core.score.raw", "100");
        // scormAPI.LMSSetValue("cmi.core.score.max", "100");
        // scormAPI.LMSSetValue("cmi.core.score.min", "0");

        const commitResult = scormAPI.LMSCommit(""); // Guardar los cambios en el LMS
        if (commitResult === SCORM_TRUE) {
            console.log("LMSCommit exitoso. Estado 'completed' guardado.");
        } else {
            console.error("Error en LMSCommit tras establecer estado. Código: " + scormAPI.LMSGetLastError());
        }
    }
}

// --- Lógica de la aplicación ---
function generateCertificate() {
    const studentName = getStudentNameFromLMS();
    const courseName = "Vibe Coding Educativo 101: Crea aplicaciones con IA para tus clases"; // Nombre del curso (puede ser configurable)
    
    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, '0');
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Meses son 0-indexados
    const year = currentDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    document.getElementById('student-name').textContent = studentName;
    document.getElementById('course-name-placeholder').textContent = courseName;
    document.getElementById('completion-date').textContent = formattedDate;

    document.getElementById('initial-view').style.display = 'none';
    document.getElementById('certificate-view').style.display = 'block';
    document.getElementById('download-pdf-btn').style.display = 'inline-block';	

	
    setLessonCompleted();
}

document.getElementById('download-pdf-btn').addEventListener('click', function () {
    const element = document.getElementById('certificate-view');
    const opt = {
        margin:       0.5,
        filename:     'certificado.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

// --- Inicialización y eventos ---
window.onload = function() {
    initScorm();
    const generateButton = document.getElementById('generate-certificate-btn');
    if (generateButton) {
        generateButton.addEventListener('click', generateCertificate);
    }
};

window.onunload = function() { // O window.onbeforeunload
    terminateScorm();
};
