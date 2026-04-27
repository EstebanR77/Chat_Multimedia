// Obtiene el usuario guardado en localStorage
let currentUser = JSON.parse(localStorage.getItem("user"));

// ─────────────────────────────────────────────
// Verificar sesión con el servidor (igual que el profe)
// Si viene de Google OAuth, /api/me lo confirma
// ─────────────────────────────────────────────
async function checkSession() {
    try {
        const res  = await fetch("/api/me");
        const data = await res.json();

        if (data.authenticated) {
            // Viene de Google: guardar en localStorage igual que login normal
            localStorage.setItem("user", JSON.stringify(data.user));
            currentUser = data.user;
            iniciarChat();
        } else if (currentUser) {
            // Viene de login normal: ya está en localStorage
            iniciarChat();
        } else {
            // No hay sesión de ningún tipo → redirige al login
            window.location.href = "login.html";
        }
    } catch {
        // Si falla la red, intenta con localStorage
        if (currentUser) {
            iniciarChat();
        } else {
            window.location.href = "login.html";
        }
    }
}

function iniciarChat() {
    // Conecta al WebSocket y define qué hacer con cada mensaje
    connectSocket(currentUser, (data) => {
        if (data.type === "users") {
            updateUserList(data.users);
        } else if (data.type === "chat" || data.type === "system") {
            addMessage(data, currentUser.id);
        }
    });
}

// Envía mensaje al presionar el botón
function sendMessage() {
    const input = document.getElementById("msgInput");
    const text  = input.value.trim();
    if (!text) return;
    sendChatMessage(currentUser, text);
    input.value = "";
}

// Envía mensaje al presionar Enter
function handleKey(e) {
    if (e.key === "Enter") sendMessage();
}

// Cierra sesión: limpia localStorage + sesión del servidor
function logout() {
    localStorage.removeItem("user");
    window.location.href = "/auth/logout";
}

// Iniciar verificación de sesión
checkSession();
