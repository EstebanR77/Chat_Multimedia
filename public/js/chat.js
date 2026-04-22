// Obtiene el usuario guardado en localStorage (lo guardó login.js)
const currentUser = JSON.parse(localStorage.getItem('user'));

// Si no hay usuario, redirige al login
if (!currentUser) window.location.href = 'login.html';

// Conecta al WebSocket y define qué hacer con cada mensaje recibido
connectSocket(currentUser, (data) => {
    if (data.type === 'users') {
        updateUserList(data.users); // Actualiza el sidebar
    } else if (data.type === 'chat' || data.type === 'system') {
        addMessage(data, currentUser.id); // Muestra el mensaje
    }
});

// Envía el mensaje al presionar el botón
function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;

    sendChatMessage(currentUser, text);
    input.value = ''; // Limpia el campo
}

// Envía el mensaje al presionar Enter
function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

// Cierra sesión: limpia localStorage y vuelve al login
function logout() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}
