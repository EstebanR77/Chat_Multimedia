let socket;
const pendingMessages = [];
let _socketUser = null;
let _socketOnMessage = null;
let _reconnectTimeout = null;
let _intentionalClose = false;

function connectSocket(user, onMessage) {
    _socketUser = user;
    _socketOnMessage = onMessage;
    _intentionalClose = false;
    _doConnect();
}

function _doConnect() {
    if (_reconnectTimeout) {
        clearTimeout(_reconnectTimeout);
        _reconnectTimeout = null;
    }

    // Si la página carga por https (ngrok), usar wss://; si es http (local), usar ws://
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}`);

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'login', user: _socketUser }));
        while (pendingMessages.length) {
            socket.send(JSON.stringify(pendingMessages.shift()));
        }
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            _socketOnMessage(data);
        } catch (e) {
            console.error('Error al parsear mensaje WS:', e);
        }
    };

    socket.onclose = () => {
        console.log('Conexion WebSocket cerrada');
        if (!_intentionalClose) {
            console.log('Reconectando en 3 segundos...');
            _reconnectTimeout = setTimeout(_doConnect, 3000);
        }
    };

    socket.onerror = (err) => {
        console.error('Error en WebSocket:', err);
    };
}

function sendSocketMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        return;
    }

    pendingMessages.push(message);
}

function joinChatRoom(project, channel) {
    sendSocketMessage({
        type: 'switch-room',
        projectId: project.id,
        projectName: project.name,
        channelId: channel.id,
        channelName: channel.name,
        memberIds: project.memberIds
    });
}

function sendCreateProject(project) {
    sendSocketMessage({
        type: 'create-project',
        project
    });
}

function sendCreateChannel(projectId, channel) {
    sendSocketMessage({
        type: 'create-channel',
        projectId,
        channel
    });
}

function sendDeleteProject(projectId) {
    sendSocketMessage({
        type: 'delete-project',
        projectId
    });
}

function sendDeleteChannel(projectId, channelId) {
    sendSocketMessage({
        type: 'delete-channel',
        projectId,
        channelId
    });
}

function sendChatMessage(user, text, project, channel) {
    sendSocketMessage({
        type: 'chat',
        projectId: project.id,
        projectName: project.name,
        channelId: channel.id,
        channelName: channel.name,
        userId: user.id,
        name: user.name,
        img: user.img,
        text
    });
}

function closeSocket() {
    _intentionalClose = true;
    if (_reconnectTimeout) clearTimeout(_reconnectTimeout);
    if (socket) socket.close();
}
