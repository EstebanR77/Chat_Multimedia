const broadcast = require('../utils/broadcast');

const { getUsers } = require('../models/users');
const {
    getDeletedItems,
    isProjectDeleted,
    isChannelDeleted,
    markProjectDeleted,
    markChannelDeleted
} = require('../models/deletedItems');
const {
    sanitizeChannel,
    sanitizeProject,
    sanitizeText,
    sanitizeUser,
    slugify
} = require('../utils/security');

let connectedUsers = [];
let knownUsers = getUsers().map(sanitizeUser);
const roomHistories = new Map();
const projects = new Map();

function isAdminUser(user) {
    return user && user.name === 'Admin' && user.rol === 'admin';
}

function normalizeProjectName(value) {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function projectNameExists(projectName) {
    const normalizedName = normalizeProjectName(projectName);
    return Array.from(projects.values()).some(project => normalizeProjectName(project.name) === normalizedName);
}

function channelNameExists(project, channelName) {
    const normalizedName = normalizeProjectName(channelName);
    return project.channels.some(channel => normalizeProjectName(channel.name) === normalizedName);
}

function setupChat(wss) {
    wss.on('connection', (ws, req) => {
        console.log('Nueva conexion desde', req.socket.remoteAddress);

        ws.on('message', (message) => {
            let data;
            try { data = JSON.parse(message); } catch { return; }

            if (data.type === 'login') {
                const safeUser = sanitizeUser(data.user);
                if (!Number.isFinite(safeUser.id) || !safeUser.email) return;

                const currentUser = {
                    id: safeUser.id,
                    name: safeUser.name,
                    rol: safeUser.rol || 'Usuario',
                    email: safeUser.email,
                    img: safeUser.img,
                    provider: safeUser.provider,
                    projectId: '',
                    channelId: '',
                    memberIds: [],
                    ws
                };

                connectedUsers = connectedUsers.filter(u => u.id !== currentUser.id);
                connectedUsers.push(currentUser);

                if (!knownUsers.find(u => u.email === currentUser.email)) {
                    knownUsers.push({
                        id: currentUser.id,
                        name: currentUser.name,
                        rol: currentUser.rol,
                        email: currentUser.email,
                        img: currentUser.img,
                        provider: currentUser.provider
                    });
                }

                console.log('Usuario conectado:', currentUser.name);
                send(ws, { type: 'deleted-items', deletedItems: getDeletedItems() });
                sendExistingProjects(currentUser);

                // Mandar lista de personas inmediatamente
                broadcastAllUsers();
            }

            if (data.type === 'switch-room') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user) return;
                const channel = sanitizeChannel({ id: data.channelId, name: data.channelName });
                const project = sanitizeProject({
                    id: data.projectId,
                    name: data.projectName,
                    memberIds: data.memberIds,
                    channels: [channel]
                });
                if (isProjectDeleted(project.id) || isChannelDeleted(project.id, channel.id)) return;

                registerProject(project);

                const previousProjectId = user.projectId;
                user.projectId = project.id;
                user.projectName = project.name;
                user.channelId = channel.id;
                user.channelName = channel.name;
                user.memberIds = project.memberIds;

                send(ws, {
                    type: 'history',
                    projectId: project.id,
                    channelId: channel.id,
                    messages: getRoomHistory(project.id, channel.id)
                });

                broadcastAllUsers();
                if (previousProjectId && previousProjectId !== data.projectId) {
                    broadcastAllUsers();
                }
            }

            if (data.type === 'create-project') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.project) return;
                if (!isAdminUser(user)) {
                    send(ws, { type: 'error', message: 'Solo el administrador puede crear proyectos.' });
                    return;
                }
                const safeProject = sanitizeProject(data.project);
                if (!safeProject.name) return;
                if (isProjectDeleted(safeProject.id)) return;
                if (projectNameExists(safeProject.name)) {
                    send(ws, {
                        type: 'error',
                        message: 'No es posible crear un proyecto con el mismo nombre de uno existente.'
                    });
                    return;
                }
                const project = registerProject(safeProject);
                notifyProjectMembers(project, user.id);
            }

            if (data.type === 'create-channel') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.projectId || !data.channel) return;
                if (!isAdminUser(user)) {
                    send(ws, { type: 'error', message: 'Solo el administrador puede crear canales.' });
                    return;
                }
                const projectId = slugify(data.projectId);
                const project = projects.get(projectId);
                if (!project) return;
                const channel = sanitizeChannel(data.channel);
                if (!channel.name) return;
                if (isChannelDeleted(projectId, channel.id)) return;
                if (channelNameExists(project, channel.name)) {
                    send(ws, {
                        type: 'error',
                        message: 'No es posible crear dos canales con el mismo nombre dentro de un mismo proyecto.'
                    });
                    return;
                }
                const exists = project.channels.some(item => item.id === channel.id);
                if (!exists) project.channels.push(channel);
                notifyProjectMembers(project, user.id, {
                    type: 'channel-created',
                    projectId: project.id,
                    channel
                });
            }

            if (data.type === 'delete-project') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.projectId) return;
                if (!isAdminUser(user)) {
                    send(ws, { type: 'error', message: 'Solo el administrador puede eliminar proyectos.' });
                    return;
                }

                const projectId = slugify(data.projectId);

                markProjectDeleted(projectId);
                broadcastConnectedUsers({
                    type: 'project-deleted',
                    projectId
                });
                projects.delete(projectId);
                deleteRoomHistoriesForProject(projectId);
                connectedUsers.forEach((connectedUser) => {
                    if (connectedUser.projectId === projectId) {
                        connectedUser.projectId = '';
                        connectedUser.projectName = '';
                        connectedUser.channelId = '';
                        connectedUser.channelName = '';
                    }
                });
                broadcastAllUsers();
            }

            if (data.type === 'delete-channel') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user || !data.projectId || !data.channelId) return;
                if (!isAdminUser(user)) {
                    send(ws, { type: 'error', message: 'Solo el administrador puede eliminar canales.' });
                    return;
                }

                const projectId = slugify(data.projectId);
                const channelId = slugify(data.channelId);
                const project = projects.get(projectId);

                markChannelDeleted(projectId, channelId);
                if (project) {
                    project.channels = project.channels.filter(channel => channel.id !== channelId);
                }
                deleteRoomHistory(projectId, channelId);
                connectedUsers.forEach((connectedUser) => {
                    if (connectedUser.projectId === projectId && connectedUser.channelId === channelId) {
                        connectedUser.channelId = '';
                        connectedUser.channelName = '';
                    }
                });
                broadcastConnectedUsers({
                    type: 'channel-deleted',
                    projectId,
                    channelId
                });
                broadcastAllUsers();
            }

            if (data.type === 'chat') {
                const user = connectedUsers.find(u => u.ws === ws);
                if (!user) return;
                const projectId = slugify(data.projectId);
                const channelId = slugify(data.channelId);
                const project = projects.get(projectId);
                if (project && !isProjectMember(user, projectId)) return;

                const chatMessage = {
                    type: 'chat',
                    projectId,
                    projectName: sanitizeText(data.projectName, 60),
                    channelId,
                    channelName: sanitizeText(data.channelName, 40),
                    userId: user.id,
                    name: user.name,
                    img: user.img,
                    text: sanitizeText(data.text, 20000),
                    time: new Date().toISOString()
                };
                if (!chatMessage.text) return;
                addRoomMessage(projectId, channelId, chatMessage);
                broadcastRoom(projectId, channelId, chatMessage);
            }
        });

        ws.on('close', () => {
            const user = connectedUsers.find(u => u.ws === ws);
            if (user) {
                console.log('Usuario desconectado:', user.name);
                connectedUsers = connectedUsers.filter(u => u.ws !== ws);
                broadcastAllUsers();
            }
        });

        ws.on('error', (err) => console.error('Error WS:', err.message));
    });
}

function broadcastAllUsers() {
    const userList = knownUsers.map(u => {
        const safeUser = sanitizeUser(u);
        return {
            id: safeUser.id,
            name: safeUser.name,
            rol: safeUser.rol,
            email: safeUser.email,
            img: safeUser.img,
            provider: safeUser.provider,
            connected: connectedUsers.some(c => c.email === safeUser.email)
        };
    });

    connectedUsers.forEach(user => {
        send(user.ws, { type: 'users', projectId: user.projectId || '', users: userList });
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

function broadcastConnectedUsers(data) {
    connectedUsers.forEach(user => send(user.ws, data));
}

function deleteRoomHistory(projectId, channelId) {
    roomHistories.delete(getRoomKey(projectId, channelId));
}

function deleteRoomHistoriesForProject(projectId) {
    Array.from(roomHistories.keys())
        .filter(key => key.startsWith(`${projectId}::`))
        .forEach(key => roomHistories.delete(key));
}

function broadcastRoom(projectId, channelId, data) {
    connectedUsers
        .filter(user => isProjectMember(user, projectId))
        .forEach(user => send(user.ws, data));
}

function registerProject(projectData) {
    const safeProject = sanitizeProject(projectData);
    if (isProjectDeleted(safeProject.id)) return null;

    const existing = projects.get(safeProject.id);
    const channels = safeProject.channels.filter(channel => !isChannelDeleted(safeProject.id, channel.id));
    const memberIds = safeProject.memberIds;

    if (existing) {
        existing.name = safeProject.name || existing.name;
        existing.memberIds = memberIds.length ? memberIds : existing.memberIds;
        channels.forEach((channel) => {
            if (!existing.channels.some(item => item.id === channel.id || normalizeProjectName(item.name) === normalizeProjectName(channel.name))) {
                existing.channels.push(channel);
            }
        });
        return existing;
    }

    const project = { id: safeProject.id, name: safeProject.name, memberIds, channels };
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
        if (isProjectDeleted(project.id)) return;
        project.channels = project.channels.filter(channel => !isChannelDeleted(project.id, channel.id));
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

function send(ws, data) {
    if (ws.readyState === 1) {
        ws.send(JSON.stringify(data));
    }
}

module.exports = setupChat;
