const broadcast = require('../utils/broadcast');

let connectedUsers = [];

function setupChat(wss) {
    wss.on('connection', (ws, req) => {
        console.log('Nueva conexion desde', req.socket.remoteAddress);

        ws.on('message', (message) => {
            let data;
            try { data = JSON.parse(message); } catch { return; }

            if (data.type === 'login') {
                const currentUser = {
                    id:    data.user.id,
                    name:  data.user.name,
                    rol:   data.user.rol   || 'Usuario',
                    email: data.user.email || '',
                    img:   data.user.img   || '',
                    ws
                };

                connectedUsers = connectedUsers.filter(u => u.id !== currentUser.id);
                connectedUsers.push(currentUser);

                console.log('Usuario conectado:', currentUser.name);
                broadcast(connectedUsers, { type: 'system', text: `${currentUser.name} se unió al chat` });
                broadcastUserList();
            }

            if (data.type === 'chat') {
                broadcast(connectedUsers, {
                    type:   'chat',
                    userId: data.userId,
                    name:   data.name,
                    img:    data.img,
                    text:   data.text,
                    time:   new Date().toISOString()
                });
            }
        });

        ws.on('close', () => {
            const user = connectedUsers.find(u => u.ws === ws);
            if (user) {
                console.log('Usuario desconectado:', user.name);
                connectedUsers = connectedUsers.filter(u => u.ws !== ws);
                broadcast(connectedUsers, { type: 'system', text: `${user.name} salió del chat` });
                broadcastUserList();
            }
        });

        ws.on('error', (err) => console.error('Error WS:', err.message));
    });
}

function broadcastUserList() {
    broadcast(connectedUsers, {
        type: 'users',
        users: connectedUsers.map(u => ({
            id:        u.id,
            name:      u.name,
            rol:       u.rol,
            email:     u.email,
            img:       u.img,
            connected: true
        }))
    });
}

module.exports = setupChat;
