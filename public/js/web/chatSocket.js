let socket;
const pendingMessages = [];

function connectSocket(user, onMessage) {
    // Si la página carga por https (ngrok), usar wss://; si es http (local), usar ws://
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocol}://${location.host}`);

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'login', user }));
        while (pendingMessages.length) {
            socket.send(JSON.stringify(pendingMessages.shift()));
        }
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
    };

    socket.onclose = () => {
        console.log('Conexion WebSocket cerrada');
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
