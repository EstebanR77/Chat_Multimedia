const { getUsers } = require('../models/users');

let connectedUsers = [];
const roomHistories = new Map();
const projects = new Map();

function setupChat(wss) {
    wss.on('connection', (ws, req) => {
        console.log('Nueva conexion desde', req.socket.remoteAddress);

        ws.on('message', (message) => {
            let data;
            try { data = JSON.parse(message); } catch { return; }

            if (data.type === 'login') {
                const currentUser = {
                    id: data.user.id,
                    name: data.user.name,
                    rol: data.user.rol || 'Usuario',
                    email: data.user.email || '',
                    img: data.user.img || '',
                    provider: data.user.provider || '',
                    projectId: '',
                    channelId: '',
                    memberIds: [],
                    ws
                };

                connectedUsers = connectedUsers.filter(u => u.id !== currentUser.id);
                connectedUsers.push(currentUser);
                console.log('Usuario conectado:', currentUser.name);
                sendExistingProjects(currentUser);
            }

            if (data.type === 'switch-room') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user) return;

                registerProject({
                    id: data.projectId,
                    name: data.projectName,
                    memberIds: data.memberIds,
                    channels: [{ id: data.channelId, name: data.channelName }]
                });

                const previousProjectId = user.projectId;
                user.projectId = data.projectId;
                user.projectName = data.projectName;
                user.channelId = data.channelId;
                user.channelName = data.channelName;
                user.memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];

                send(ws, {
                    type: 'history',
                    projectId: data.projectId,
                    channelId: data.channelId,
                    messages: getRoomHistory(data.projectId, data.channelId)
                });

                broadcastProjectUsers(data.projectId);
                if (previousProjectId && previousProjectId !== data.projectId) {
                    broadcastProjectUsers(previousProjectId);
                }
            }

            if (data.type === 'create-project') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.project) return;

                const project = registerProject(data.project);
                notifyProjectMembers(project, user.id);
            }

            if (data.type === 'create-channel') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.projectId || !data.channel) return;

                const project = projects.get(data.projectId);
                if (!project) return;

                const exists = project.channels.some(channel => channel.id === data.channel.id);
                if (!exists) {
                    project.channels.push(data.channel);
                }

                notifyProjectMembers(project, user.id, {
                    type: 'channel-created',
                    projectId: project.id,
                    channel: data.channel
                });
            }

            if (data.type === 'chat') {
                const chatMessage = {
                    type: 'chat',
                    projectId: data.projectId,
                    projectName: data.projectName,
                    channelId: data.channelId,
                    channelName: data.channelName,
                    userId: data.userId,
                    name: data.name,
                    img: data.img,
                    text: data.text,
                    time: new Date().toISOString()
                };

                addRoomMessage(data.projectId, data.channelId, chatMessage);
                broadcastRoom(data.projectId, data.channelId, chatMessage);
            }
        });

        ws.on('close', () => {
            const user = connectedUsers.find(u => u.ws === ws);
            if (user) {
                console.log('Usuario desconectado:', user.name);
                connectedUsers = connectedUsers.filter(u => u.ws !== ws);
                if (user.projectId) {
                    broadcastProjectUsers(user.projectId);
                }
            }
        });

        ws.on('error', (err) => console.error('Error WS:', err.message));
    });
}

function getRoomKey(projectId, channelId) {
    return `${projectId}::${channelId}`;
}

function getRoomHistory(projectId, channelId) {
    return roomHistories.get(getRoomKey(projectId, channelId)) || [];
}

function addRoomMessage(projectId, channelId, message) {
    const key = getRoomKey(projectId, channelId);
    const history = getRoomHistory(projectId, channelId);
    history.push(message);
    roomHistories.set(key, history.slice(-200));
}

function broadcastRoom(projectId, channelId, data) {
    connectedUsers
        .filter(user => isProjectMember(user, projectId))
        .forEach(user => send(user.ws, data));
}

function broadcastProjectUsers(projectId) {
    connectedUsers
        .filter(user => user.projectId === projectId)
        .forEach(user => send(user.ws, {
            type: 'users',
            projectId,
            users: getProjectUsers(projectId, user.memberIds)
        }));
}

function registerProject(projectData) {
    const existing = projects.get(projectData.id);
    const channels = Array.isArray(projectData.channels) ? projectData.channels : [];
    const memberIds = Array.isArray(projectData.memberIds) ? projectData.memberIds.map(Number) : [];

    if (existing) {
        existing.name = projectData.name || existing.name;
        existing.memberIds = memberIds.length ? memberIds : existing.memberIds;
        channels.forEach((channel) => {
            if (!existing.channels.some(item => item.id === channel.id)) {
                existing.channels.push(channel);
            }
        });
        return existing;
    }

    const project = {
        id: projectData.id,
        name: projectData.name,
        memberIds,
        channels
    };
    projects.set(project.id, project);
    return project;
}

function notifyProjectMembers(project, creatorId, extraMessage) {
    connectedUsers
        .filter(user => project.memberIds.includes(Number(user.id)))
        .forEach(user => {
            if (extraMessage) {
                send(user.ws, extraMessage);
                return;
            }

            send(user.ws, {
                type: 'project-created',
                project,
                createdBy: creatorId,
                isCreator: Number(user.id) === Number(creatorId)
            });
        });
}

function sendExistingProjects(user) {
    projects.forEach(project => {
        if (!project.memberIds.includes(Number(user.id))) return;

        send(user.ws, {
            type: 'project-created',
            project,
            createdBy: null,
            isCreator: false
        });
    });
}

function isProjectMember(user, projectId) {
    const project = projects.get(projectId);
    if (!project || !project.memberIds.length) {
        return user.projectId === projectId;
    }

    return project.memberIds.includes(Number(user.id));
}

function getProjectUsers(projectId, memberIds) {
    const registeredUsers = getUsers();
    const projectMemberIds = memberIds.map(id => Number(id));
    const users = projectMemberIds.length
        ? registeredUsers.filter(user => projectMemberIds.includes(Number(user.id)))
        : registeredUsers;

    return users.map(user => {
        const connectedUser = connectedUsers.find(connected => (
            connected.projectId === projectId
            && (Number(connected.id) === Number(user.id) || (connected.email && connected.email === user.email))
        ));

        return {
            id: user.id,
            name: user.name,
            rol: user.rol,
            email: user.email,
            img: user.img,
            provider: user.provider,
            connected: Boolean(connectedUser)
        };
    });
}

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

module.exports = setupChat;
