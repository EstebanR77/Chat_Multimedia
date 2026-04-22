let socket;

function connectSocket(user, onMessage) {
    // Conecta al servidor WebSocket
    socket = new WebSocket(`ws://${location.host}`);

    socket.onopen = () => {
        // Al conectar, envía el mensaje de tipo "login" con los datos del usuario
        socket.send(JSON.stringify({ type: 'login', user }));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data); // Pasa el mensaje a chat.js para procesarlo
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
    };

    socket.onerror = (err) => {
        console.error('Error en WebSocket:', err);
    };
}

function sendChatMessage(user, text) {
    if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify({
            type:   'chat',
            userId: user.id,
            name:   user.name,
            img:    user.img,
            text:   text
        }));
    }
}
