const broadcast = require('../utils/broadcast');
const { getUsers } = require('../models/users');

let connectedUsers = [];

function setupChat(wss) {
    wss.on('connection', (ws, req) => {
        const ip = req.socket.remoteAddress;
        console.log('Nueva conexion desde', ip);

        ws.on('message', (message) => {
            let data;
            try { data = JSON.parse(message); } catch { return; }

            if (data.type === 'login') {
                const currentUser = { id: data.user.id, name: data.user.name, rol: data.user.rol, img: data.user.img, ws };
                connectedUsers.push(currentUser);
                console.log('Usuario conectado:', currentUser.name);

                broadcast(connectedUsers, { type: 'system', text: `${currentUser.name} se unió al chat` });

                const allUsers = getUsers();
                broadcast(connectedUsers, {
                    type: 'users',
                    users: allUsers.map(u => ({
                        id: u.id, name: u.name, rol: u.rol, img: u.img,
                        connected: connectedUsers.some(c => c.id === u.id)
                    }))
                });
            }

            if (data.type === 'chat') {
                broadcast(connectedUsers, {
                    type: 'chat',
                    userId: data.userId,
                    name: data.name,
                    img: data.img,
                    text: data.text,
                    time: new Date().toISOString()
                });
            }
        });

        ws.on('close', () => {
            const user = connectedUsers.find(u => u.ws === ws);
            if (user) {
                console.log('Usuario desconectado:', user.name);
                connectedUsers = connectedUsers.filter(u => u.ws !== ws);
                broadcast(connectedUsers, { type: 'system', text: `${user.name} salió del chat` });

                const allUsers = getUsers();
                broadcast(connectedUsers, {
                    type: 'users',
                    users: allUsers.map(u => ({
                        id: u.id, name: u.name, rol: u.rol, img: u.img,
                        connected: connectedUsers.some(c => c.id === u.id)
                    }))
                });
            }
        });

        ws.on('error', (err) => console.error('Error WS:', err.message));
    });
}

module.exports = setupChat;
