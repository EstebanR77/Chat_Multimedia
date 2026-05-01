let currentUser = JSON.parse(localStorage.getItem('user'));
let currentProject = null;
let currentChannel = null;
let allUsers = [];

const projects = new Map();

const slugify = (value) => value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;

const normalizeText = (value) => value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function isAdminUser(user) {
    return user && user.name === 'Admin' && user.rol === 'admin';
}

async function checkSession() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.authenticated) {
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            iniciarChat();
        } else if (currentUser) {
            iniciarChat();
        } else {
            window.location.href = 'login.html';
        }
    } catch {
        if (currentUser) {
            iniciarChat();
        } else {
            window.location.href = 'login.html';
        }
    }
}

async function iniciarChat() {
    allUsers = await getUsers();
    initProjectsFromDom();
    bindProjectAndChannelClicks();
    selectInitialRoom();

    connectSocket(currentUser, (data) => {
        if (data.type === 'error') {
            alert(data.message);
            return;
        }

        if (data.type === 'project-created') {
            addProjectFromServer(data.project, !data.isCreator);
        }

        if (data.type === 'channel-created') {
            addChannelFromServer(data.projectId, data.channel);
        }

        if (data.type === 'users' && currentProject && data.projectId === currentProject.id) {
            updateUserList(data.users);
        }

        if (data.type === 'history' && isCurrentRoom(data)) {
            renderMessages(data.messages, currentUser.id);
        }

        if ((data.type === 'chat' || data.type === 'system') && isCurrentRoom(data)) {
            addMessage(data, currentUser.id);
        } else if (data.type === 'chat') {
            markUnread(data.projectId, data.channelId);
        }
    });
}

function initProjectsFromDom() {
    document.querySelectorAll('.project-item').forEach((projectEl) => {
        const projectId = projectEl.dataset.projectId || slugify(projectEl.dataset.projectName);
        const projectName = projectEl.dataset.projectName || projectEl.textContent.replace('#', '').trim();
        const channelsGroup = projectEl.nextElementSibling;
        const channels = [];

        projectEl.dataset.projectId = projectId;
        projectEl.dataset.projectName = projectName;

        if (channelsGroup && channelsGroup.classList.contains('channels-group')) {
            channelsGroup.querySelectorAll('.channel-item').forEach((channelEl) => {
                const channelName = channelEl.dataset.channelName || channelEl.textContent.replace('#', '').trim();
                const channelId = channelEl.dataset.channelId || slugify(channelName);
                channelEl.dataset.projectId = projectId;
                channelEl.dataset.channelId = channelId;
                channelEl.dataset.channelName = channelName;
                channels.push({ id: channelId, name: channelName });
            });
        }

        projects.set(projectId, {
            id: projectId,
            name: projectName,
            memberIds: allUsers.map(user => user.id),
            channels
        });
    });
}

function bindProjectAndChannelClicks() {
    document.querySelectorAll('.project-item').forEach((projectEl) => {
        projectEl.addEventListener('click', () => toggleChatProject(projectEl));
    });

    document.querySelectorAll('.channel-item').forEach((channelEl) => {
        channelEl.addEventListener('click', () => selectChatChannel(channelEl));
    });
}

function initSidebarSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', () => applySidebarSearch(searchInput.value));
}

function applySidebarSearch(value) {
    const query = normalizeText(value);

    document.querySelectorAll('.project-item').forEach((projectEl) => {
        const channelsGroup = projectEl.nextElementSibling;
        const channelItems = channelsGroup && channelsGroup.classList.contains('channels-group')
            ? Array.from(channelsGroup.querySelectorAll('.channel-item'))
            : [];

        if (!query) {
            projectEl.classList.remove('search-hidden');
            if (channelsGroup) {
                channelsGroup.classList.remove('search-hidden', 'search-open');
            }
            channelItems.forEach(channelEl => channelEl.classList.remove('search-hidden'));
            return;
        }

        const projectMatches = normalizeText(projectEl.dataset.projectName || projectEl.textContent).includes(query);
        let visibleChannels = 0;

        channelItems.forEach((channelEl) => {
            const channelMatches = normalizeText(channelEl.dataset.channelName || channelEl.textContent).includes(query);
            const shouldShowChannel = projectMatches || channelMatches;
            channelEl.classList.toggle('search-hidden', !shouldShowChannel);
            if (shouldShowChannel) visibleChannels++;
        });

        const shouldShowProject = projectMatches || visibleChannels > 0;
        projectEl.classList.toggle('search-hidden', !shouldShowProject);
        if (channelsGroup) {
            channelsGroup.classList.toggle('search-hidden', !shouldShowProject);
            channelsGroup.classList.toggle('search-open', shouldShowProject);
        }
    });
}

function selectInitialRoom() {
    const activeChannel = document.querySelector('.channel-item.active') || document.querySelector('.channel-item');
    if (activeChannel) {
        selectChatChannel(activeChannel);
    }
}

function isCurrentRoom(data) {
    return currentProject
        && currentChannel
        && data.projectId === currentProject.id
        && data.channelId === currentChannel.id;
}

function selectChatChannel(channelEl) {
    const projectId = channelEl.dataset.projectId || getProjectElementForChannel(channelEl).dataset.projectId;
    const project = projects.get(projectId);
    if (!project) return;

    const channel = {
        id: channelEl.dataset.channelId,
        name: channelEl.dataset.channelName
    };

    currentProject = project;
    currentChannel = channel;

    document.querySelectorAll('.channel-item').forEach(item => item.classList.remove('active'));
    channelEl.classList.add('active');
    channelEl.classList.remove('has-unread');
    const projectEl = getProjectElementForChannel(channelEl);
    if (projectEl) {
        projectEl.classList.remove('new-project');
        const channelsGroup = projectEl.nextElementSibling;
        if (channelsGroup && !channelsGroup.querySelector('.channel-item.has-unread')) {
            projectEl.classList.remove('has-unread');
        }
    }
    document.getElementById('channelTitle').textContent = `# ${project.name} / ${channel.name}`;
    clearMessages();
    joinChatRoom(project, channel);
}

function getProjectElementForChannel(channelEl) {
    const channelsGroup = channelEl.closest('.channels-group');
    return channelsGroup ? channelsGroup.previousElementSibling : null;
}

function toggleChatProject(projectEl) {
    projectEl.classList.toggle('active');
    const channelsGroup = projectEl.nextElementSibling;
    if (channelsGroup && channelsGroup.classList.contains('channels-group')) {
        channelsGroup.classList.toggle('active');
    }

    const firstChannel = channelsGroup ? channelsGroup.querySelector('.channel-item') : null;
    if (firstChannel && projectEl.classList.contains('active')) {
        selectChatChannel(firstChannel);
        projectEl.classList.remove('new-project');
    }
}

function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentProject || !currentChannel) return;

    sendChatMessage(currentUser, text, currentProject, currentChannel);
    input.value = '';
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/auth/logout';
}

function initCreateControls() {
    const openBtn = document.getElementById('openCreateBtn');
    const createPanel = document.getElementById('createPanel');
    const createForm = document.getElementById('createForm');
    const modal = document.getElementById('createModal');
    const backdrop = document.getElementById('modalBackdrop');
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const projectParticipantsGroup = document.getElementById('projectParticipantsGroup');
    const projectDefaultChannelsGroup = document.getElementById('projectDefaultChannelsGroup');
    const channelProjectGroup = document.getElementById('channelProjectGroup');
    const channelNameGroup = document.getElementById('channelNameGroup');
    const itemNameLabel = document.getElementById('itemNameLabel');
    const itemNameInput = document.getElementById('itemName');
    const projectSelect = document.getElementById('projectSelect');
    const formSubmit = document.getElementById('modalSubmit');
    const channelsList = document.querySelector('.channels-list');
    let activeType = 'project';

    if (!isAdminUser(currentUser)) {
        openBtn.classList.add('hide');
        createPanel.classList.add('hide');
        return;
    }

    openBtn.addEventListener('click', () => {
        const isOpen = !createPanel.classList.contains('hide');
        createPanel.classList.toggle('hide', isOpen);
        channelsList.classList.toggle('create-open', !isOpen);
    });

    document.querySelectorAll('.create-option').forEach((button) => {
        button.addEventListener('click', () => openCreateModal(button.dataset.create));
    });

    modalClose.addEventListener('click', closeCreateModal);
    modalCancel.addEventListener('click', closeCreateModal);
    backdrop.addEventListener('click', closeCreateModal);
    createForm.addEventListener('submit', handleCreateSubmit);
    document.getElementById('participantsSearch').addEventListener('input', renderParticipants);

    function openCreateModal(type) {
        activeType = type;
        createPanel.classList.add('hide');
        channelsList.classList.remove('create-open');
        renderProjectOptions();
        renderParticipants();
        setModalType(type);
        modal.classList.remove('hide');
        modal.classList.add('show');
        backdrop.classList.remove('hide');
        backdrop.classList.add('show');
        itemNameInput.value = '';
        itemNameInput.focus();
    }

    function setModalType(type) {
        if (type === 'project') {
            document.getElementById('modalTitle').textContent = 'Nuevo proyecto';
            document.getElementById('modalSubtitle').textContent = 'Crea un proyecto con sus propios canales y participantes.';
            itemNameLabel.textContent = 'Nombre del proyecto';
            itemNameInput.placeholder = 'Ej. App cliente';
            projectParticipantsGroup.classList.remove('hide');
            projectDefaultChannelsGroup.classList.remove('hide');
            channelProjectGroup.classList.add('hide');
            channelNameGroup.classList.add('hide');
            formSubmit.textContent = 'Crear proyecto';
        } else {
            document.getElementById('modalTitle').textContent = 'Nuevo canal';
            document.getElementById('modalSubtitle').textContent = 'Anade un canal al proyecto seleccionado.';
            itemNameLabel.textContent = 'Nombre del canal';
            itemNameInput.placeholder = 'Ej. Marketing';
            projectParticipantsGroup.classList.add('hide');
            projectDefaultChannelsGroup.classList.add('hide');
            channelProjectGroup.classList.remove('hide');
            channelNameGroup.classList.add('hide');
            formSubmit.textContent = 'Crear canal';
        }
    }

    function closeCreateModal() {
        modal.classList.add('hide');
        modal.classList.remove('show');
        backdrop.classList.add('hide');
        backdrop.classList.remove('show');
        createForm.reset();
    }

    function handleCreateSubmit(event) {
        event.preventDefault();
        const name = itemNameInput.value.trim();
        if (!name) return;

        if (activeType === 'project') {
            createProject(name, document.getElementById('defaultChannels').checked);
        } else {
            const selectedProject = projectSelect.value;
            if (!selectedProject) {
                alert('Selecciona un proyecto para el canal.');
                return;
            }
            createChannel(selectedProject, name);
        }

        closeCreateModal();
    }

    function renderProjectOptions() {
        projectSelect.innerHTML = '<option value="">Selecciona un proyecto</option>';
        projects.forEach((project) => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
    }
}

function renderParticipants() {
    const participantsList = document.getElementById('participantsList');
    const search = document.getElementById('participantsSearch').value.trim().toLowerCase();
    if (!participantsList) return;

    const filteredUsers = allUsers.filter(user => {
        const text = `${user.name} ${user.email}`.toLowerCase();
        return text.includes(search);
    });

    participantsList.innerHTML = '';
    filteredUsers.forEach((user) => {
        const label = document.createElement('label');
        label.className = 'participant-chip';
        label.innerHTML = `
            <input type="checkbox" value="${user.id}" ${user.id === currentUser.id ? 'checked disabled' : ''}>
            <span>${user.name}</span>
        `;
        participantsList.appendChild(label);
    });
}

function getSelectedParticipantIds() {
    const selected = Array.from(document.querySelectorAll('#participantsList input:checked'))
        .map(input => Number(input.value));
    if (!selected.includes(currentUser.id)) {
        selected.push(currentUser.id);
    }
    return selected;
}

function createProject(projectName, withDefaults) {
    if (!isAdminUser(currentUser)) return;

    const projectId = getUniqueProjectId(projectName);
    const memberIds = getSelectedParticipantIds();
    const channelNames = withDefaults ? ['General', 'Diseno', 'Desarrollo', 'Marketing'] : ['General'];
    const project = {
        id: projectId,
        name: projectName,
        memberIds,
        channels: channelNames.map(channelName => ({ id: getUniqueChannelId(projectId, channelName), name: channelName }))
    };

    addProjectToSidebar(project, { active: true });
    sendCreateProject(project);
    const channelsGroup = getChannelsGroup(projectId);
    selectChatChannel(channelsGroup.querySelector('.channel-item'));
}

function createChannel(projectId, channelName) {
    if (!isAdminUser(currentUser)) return;

    const projectItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    const project = projects.get(projectId);
    if (!projectItem || !project) return;

    const channelsGroup = projectItem.nextElementSibling;
    if (!channelsGroup || !channelsGroup.classList.contains('channels-group')) return;

    const channel = { id: getUniqueChannelId(projectId, channelName), name: channelName };
    createChannelElement(projectId, channel, channelsGroup);
    project.channels.push(channel);
    sendCreateChannel(projectId, channel);

    projectItem.classList.add('active');
    channelsGroup.classList.add('active');
    selectChatChannel(channelsGroup.lastElementChild);
}

function createChannelElement(projectId, channel, channelsGroup) {
    const channelItem = document.createElement('div');
    channelItem.className = 'channel-item';
    channelItem.dataset.projectId = projectId;
    channelItem.dataset.channelId = channel.id;
    channelItem.dataset.channelName = channel.name;
    channelItem.innerHTML = '<span>#</span> ' + channel.name;
    channelItem.addEventListener('click', () => selectChatChannel(channelItem));
    channelsGroup.appendChild(channelItem);
    return channel;
}

function addProjectFromServer(project, showAsNew) {
    const projectExists = projects.has(project.id);
    addProjectToSidebar(project, { isNew: showAsNew && !projectExists });
}

function addProjectToSidebar(project, options = {}) {
    if (projects.has(project.id)) return;

    const projectList = document.querySelector('.channels-list');
    const newProject = document.createElement('div');
    newProject.className = 'project-item';
    if (options.active) newProject.classList.add('active');
    if (options.isNew) newProject.classList.add('new-project');
    newProject.dataset.projectId = project.id;
    newProject.dataset.projectName = project.name;
    newProject.innerHTML = '<span class="project-icon">v</span><span class="project-name"># ' + project.name + '</span>';
    newProject.addEventListener('click', () => toggleChatProject(newProject));

    const channelsGroup = document.createElement('div');
    channelsGroup.className = 'channels-group';
    if (options.active) channelsGroup.classList.add('active');

    project.channels.forEach(channel => createChannelElement(project.id, channel, channelsGroup));

    projectList.appendChild(newProject);
    projectList.appendChild(channelsGroup);
    projects.set(project.id, project);
    applySidebarSearch(document.getElementById('searchInput')?.value || '');
}

function addChannelFromServer(projectId, channel) {
    const project = projects.get(projectId);
    const channelsGroup = getChannelsGroup(projectId);
    if (!project || !channelsGroup || project.channels.some(item => item.id === channel.id)) return;

    project.channels.push(channel);
    createChannelElement(projectId, channel, channelsGroup);
    applySidebarSearch(document.getElementById('searchInput')?.value || '');
}

function markUnread(projectId, channelId) {
    const channelEl = document.querySelector(`.channel-item[data-project-id="${projectId}"][data-channel-id="${channelId}"]`);
    const projectEl = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    if (!channelEl || !projectEl) return;

    channelEl.classList.add('has-unread');
    if (!projectEl.classList.contains('new-project')) {
        projectEl.classList.add('has-unread');
    }
}

function getChannelsGroup(projectId) {
    const projectItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    return projectItem ? projectItem.nextElementSibling : null;
}

function getUniqueProjectId(projectName) {
    const baseId = slugify(projectName);
    let id = baseId;
    let counter = 2;
    while (projects.has(id)) {
        id = `${baseId}-${counter}`;
        counter++;
    }
    return id;
}

function getUniqueChannelId(projectId, channelName) {
    const project = projects.get(projectId);
    const existingIds = project ? project.channels.map(channel => channel.id) : [];
    const baseId = slugify(channelName);
    let id = baseId;
    let counter = 2;
    while (existingIds.includes(id)) {
        id = `${baseId}-${counter}`;
        counter++;
    }
    return id;
}

function initSidebarCollapse() {
    const collapseBtn = document.querySelector('.collapse-btn');
    const chatContainer = document.querySelector('.chat-container');

    if (!collapseBtn || !chatContainer) return;

    collapseBtn.addEventListener('click', () => {
        const collapsed = chatContainer.classList.toggle('collapsed');
        collapseBtn.textContent = collapsed ? '>' : '<';
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expandir sidebar' : 'Colapsar sidebar');
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initCreateControls();
    initSidebarCollapse();
    initSidebarSearch();
});

checkSession();
