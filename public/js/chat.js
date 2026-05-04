let currentUser = JSON.parse(localStorage.getItem('user'));
let currentProject = null;
let currentChannel = null;
let allUsers = [];
let pendingDelete = null;
const deletedProjectIds = new Set();
const deletedChannelIds = new Map();

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

const duplicateProjectMessage = 'No es posible crear un proyecto con el mismo nombre de uno existente.';
const duplicateChannelMessage = 'No es posible crear dos canales con el mismo nombre dentro de un mismo proyecto.';
const projectNameMaxLength = 60;
const channelNameMaxLength = 40;

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
    await loadDeletedItems();
    renderCurrentUserBadge();
    initProjectsFromDom();
    bindProjectAndChannelClicks();
    selectInitialRoom();
    initRecentMessagesButton();

    connectSocket(currentUser, (data) => {
        if (data.type === 'error') {
            if (data.message === duplicateProjectMessage || data.message === duplicateChannelMessage) {
                showItemNameError(data.message);
                return;
            }
            alert(data.message);
            return;
        }

        if (data.type === 'project-created') {
            addProjectFromServer(data.project, !data.isCreator);
        }

        if (data.type === 'channel-created') {
            addChannelFromServer(data.projectId, data.channel);
        }

        if (data.type === 'deleted-items') {
            applyDeletedItems(data.deletedItems);
        }

        if (data.type === 'project-deleted') {
            deleteProject(data.projectId, false);
        }

        if (data.type === 'channel-deleted') {
            deleteChannel(data.projectId, data.channelId, false);
        }

        if (data.type === 'users') {
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

async function loadDeletedItems() {
    try {
        const res = await fetch('/api/deleted-items');
        const data = await res.json();
        applyDeletedItems(data);
    } catch {
        applyDeletedItems({ projects: [], channels: {} });
    }
}

function applyDeletedItems(data = {}) {
    deletedProjectIds.clear();
    deletedChannelIds.clear();

    (Array.isArray(data.projects) ? data.projects : []).forEach(projectId => {
        deletedProjectIds.add(projectId);
    });

    Object.entries(data.channels || {}).forEach(([projectId, channels]) => {
        deletedChannelIds.set(projectId, new Set(Array.isArray(channels) ? channels : []));
    });

    removeDeletedItemsFromDom();
}

function removeDeletedItemsFromDom() {
    document.querySelectorAll('.project-item').forEach((projectEl) => {
        const projectId = projectEl.dataset.projectId || slugify(projectEl.dataset.projectName || projectEl.textContent);
        if (isProjectDeletedLocally(projectId)) {
            const channelsGroup = projectEl.nextElementSibling;
            projectEl.remove();
            if (channelsGroup && channelsGroup.classList.contains('channels-group')) channelsGroup.remove();
            projects.delete(projectId);
        }
    });

    document.querySelectorAll('.channel-item').forEach((channelEl) => {
        const projectId = channelEl.dataset.projectId;
        const channelId = channelEl.dataset.channelId || slugify(channelEl.dataset.channelName || channelEl.textContent);
        if (isChannelDeletedLocally(projectId, channelId)) {
            const project = projects.get(projectId);
            if (project) project.channels = project.channels.filter(channel => channel.id !== channelId);
            channelEl.remove();
        }
    });
}

function isProjectDeletedLocally(projectId) {
    return deletedProjectIds.has(projectId);
}

function isChannelDeletedLocally(projectId, channelId) {
    return deletedChannelIds.has(projectId) && deletedChannelIds.get(projectId).has(channelId);
}

function markProjectDeletedLocally(projectId) {
    deletedProjectIds.add(projectId);
    deletedChannelIds.delete(projectId);
}

function markChannelDeletedLocally(projectId, channelId) {
    if (!deletedChannelIds.has(projectId)) deletedChannelIds.set(projectId, new Set());
    deletedChannelIds.get(projectId).add(channelId);
}

function initProjectsFromDom() {
    document.querySelectorAll('.project-item').forEach((projectEl) => {
        const projectId = projectEl.dataset.projectId || slugify(projectEl.dataset.projectName);
        const projectName = projectEl.dataset.projectName || projectEl.textContent.replace('#', '').trim();
        const channelsGroup = projectEl.nextElementSibling;
        const channels = [];

        if (isProjectDeletedLocally(projectId)) {
            projectEl.remove();
            if (channelsGroup && channelsGroup.classList.contains('channels-group')) channelsGroup.remove();
            return;
        }

        projectEl.dataset.projectId = projectId;
        projectEl.dataset.projectName = projectName;
        addProjectDeleteControl(projectEl);

        if (channelsGroup && channelsGroup.classList.contains('channels-group')) {
            channelsGroup.querySelectorAll('.channel-item').forEach((channelEl) => {
                const channelName = channelEl.dataset.channelName || channelEl.textContent.replace('#', '').trim();
                const channelId = channelEl.dataset.channelId || slugify(channelName);
                if (isChannelDeletedLocally(projectId, channelId)) {
                    channelEl.remove();
                    return;
                }
                channelEl.dataset.projectId = projectId;
                channelEl.dataset.channelId = channelId;
                channelEl.dataset.channelName = channelName;
                addChannelDeleteControl(channelEl);
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
        channelEl.addEventListener('click', () => {
            selectChatChannel(channelEl);
            if (typeof showChat === 'function') showChat();
        });
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
        return;
    }

    currentProject = null;
    currentChannel = null;
    document.getElementById('channelTitle').textContent = 'Selecciona un canal';
    clearMessages();
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
    document.getElementById('channelTitle').textContent = `${project.name} / ${channel.name}`;
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

function initRecentMessagesButton() {
    const messages = document.getElementById('messages');
    const button = document.getElementById('recentMessagesBtn');
    if (!messages || !button || button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';
    button.addEventListener('click', scrollToLatestMessage);
    messages.addEventListener('scroll', updateRecentMessagesButton);
    updateRecentMessagesButton();
}

function initDeleteModal() {
    const modal = document.getElementById('deleteModal');
    const backdrop = document.getElementById('deleteModalBackdrop');
    const closeBtn = document.getElementById('deleteModalClose');
    const cancelBtn = document.getElementById('deleteModalCancel');
    const confirmBtn = document.getElementById('deleteModalConfirm');
    if (!modal || !backdrop || !closeBtn || !cancelBtn || !confirmBtn || modal.dataset.bound === 'true') return;

    modal.dataset.bound = 'true';
    closeBtn.addEventListener('click', closeDeleteModal);
    cancelBtn.addEventListener('click', closeDeleteModal);
    backdrop.addEventListener('click', closeDeleteModal);
    confirmBtn.addEventListener('click', () => {
        if (pendingDelete && typeof pendingDelete.onConfirm === 'function') {
            pendingDelete.onConfirm();
        }
        closeDeleteModal();
    });
}

function openDeleteModal({ title, message, onConfirm }) {
    const modal = document.getElementById('deleteModal');
    const backdrop = document.getElementById('deleteModalBackdrop');
    const modalTitle = document.getElementById('deleteModalTitle');
    const modalMessage = document.getElementById('deleteModalMessage');
    if (!modal || !backdrop || !modalTitle || !modalMessage) return;

    pendingDelete = { onConfirm };
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hide');
    modal.classList.add('show');
    backdrop.classList.remove('hide');
    backdrop.classList.add('show');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    const backdrop = document.getElementById('deleteModalBackdrop');
    if (!modal || !backdrop) return;

    pendingDelete = null;
    modal.classList.add('hide');
    modal.classList.remove('show');
    backdrop.classList.add('hide');
    backdrop.classList.remove('show');
}

function scrollToLatestMessage() {
    const messages = document.getElementById('messages');
    if (!messages) return;

    messages.scrollTo({
        top: messages.scrollHeight,
        behavior: 'smooth'
    });
}

function updateRecentMessagesButton() {
    const messages = document.getElementById('messages');
    const button = document.getElementById('recentMessagesBtn');
    if (!messages || !button) return;

    const distanceFromBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
    button.classList.toggle('is-hidden', distanceFromBottom < 120);
}

function logout() {
    localStorage.removeItem('user');
    window.location.href = '/auth/logout';
}

function renderCurrentUserBadge() {
    const avatar = document.getElementById('currentUserAvatar');
    const name = document.getElementById('currentUserName');
    const mobileAvatar = document.getElementById('mobileUserAvatar');
    const mobileName = document.getElementById('mobileUserName');
    if ((!avatar || !name) && (!mobileAvatar || !mobileName) || !currentUser) return;

    const displayName = safeText(currentUser.name, 'Usuario');
    const imageUrl = safeImageUrl(currentUser.img);
    const firstName = displayName.split(/\s+/)[0] || 'Usuario';

    if (name) name.textContent = displayName;
    if (mobileName) mobileName.textContent = firstName;

    renderUserAvatar(avatar, displayName, imageUrl);
    renderUserAvatar(mobileAvatar, displayName, imageUrl);
}

function renderUserAvatar(avatar, displayName, imageUrl) {
    if (!avatar) return;

    avatar.replaceChildren();

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = displayName;
        img.referrerPolicy = 'no-referrer';
        avatar.appendChild(img);
        return;
    }

    avatar.textContent = displayName ? displayName[0].toUpperCase() : '?';
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
    itemNameInput.addEventListener('input', clearItemNameError);
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
        clearItemNameError();
        itemNameInput.focus();
    }

    function setModalType(type) {
        modal.classList.toggle('is-project', type === 'project');
        modal.classList.toggle('is-channel', type === 'channel');

        if (type === 'project') {
            document.getElementById('modalTitle').textContent = 'Nuevo proyecto';
            document.getElementById('modalSubtitle').textContent = 'Crea un proyecto con sus propios canales y participantes.';
            itemNameLabel.textContent = 'Nombre del proyecto';
            itemNameInput.placeholder = 'Ej. App cliente';
            itemNameInput.maxLength = projectNameMaxLength;
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
            itemNameInput.maxLength = channelNameMaxLength;
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
        clearItemNameError();
    }

    function handleCreateSubmit(event) {
        event.preventDefault();
        const name = itemNameInput.value.trim();
        if (!name) return;

        if (activeType === 'project') {
            const wasCreated = createProject(name, document.getElementById('defaultChannels').checked);
            if (!wasCreated) return;
        } else {
            const selectedProject = projectSelect.value;
            if (!selectedProject) {
                alert('Selecciona un proyecto para el canal.');
                return;
            }
            const wasCreated = createChannel(selectedProject, name);
            if (!wasCreated) return;
        }

        closeCreateModal();
    }

    function renderProjectOptions() {
        projectSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecciona un proyecto';
        projectSelect.appendChild(placeholder);
        projects.forEach((project) => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = safeText(project.name, 'Proyecto');
            projectSelect.appendChild(option);
        });
    }
}

function renderParticipants() {
    const participantsList = document.getElementById('participantsList');
    const search = document.getElementById('participantsSearch').value.trim().toLowerCase();
    if (!participantsList) return;

    const filteredUsers = allUsers.filter(user => {
        const text = `${safeText(user.name)} ${safeText(user.email)}`.toLowerCase();
        return text.includes(search);
    });

    participantsList.replaceChildren();
    filteredUsers.forEach((user) => {
        const label = document.createElement('label');
        label.className = 'participant-chip';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = Number(user.id);
        input.checked = Number(user.id) === Number(currentUser.id);
        input.disabled = Number(user.id) === Number(currentUser.id);

        const name = document.createElement('span');
        name.textContent = safeText(user.name, 'Usuario');

        label.append(input, name);
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
    if (!isAdminUser(currentUser)) return false;

    const projectId = getUniqueProjectId(projectName);
    if (isProjectDeletedLocally(projectId)) {
        showItemNameError('Este proyecto fue eliminado del sistema y no se puede volver a crear con el mismo identificador.');
        return false;
    }

    if (projectNameExists(projectName)) {
        showItemNameError(duplicateProjectMessage);
        return false;
    }

    const memberIds = getSelectedParticipantIds();
    const channelNames = withDefaults ? ['General', 'Diseño', 'Desarrollo', 'Marketing'] : ['General'];
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
    return true;
}

function showItemNameError(message) {
    const input = document.getElementById('itemName');
    const group = document.getElementById('itemNameGroup');
    const error = document.getElementById('itemNameError');
    if (!input || !group || !error) return;

    group.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    input.focus();
}

function clearItemNameError() {
    const input = document.getElementById('itemName');
    const group = document.getElementById('itemNameGroup');
    const error = document.getElementById('itemNameError');
    if (!input || !group || !error) return;

    group.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    error.textContent = '';
}

function createChannel(projectId, channelName) {
    if (!isAdminUser(currentUser)) return false;

    const projectItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    const project = projects.get(projectId);
    if (!projectItem || !project) return false;

    if (channelNameExists(projectId, channelName)) {
        showItemNameError(duplicateChannelMessage);
        return false;
    }

    const channelsGroup = projectItem.nextElementSibling;
    if (!channelsGroup || !channelsGroup.classList.contains('channels-group')) return false;

    const channel = { id: getUniqueChannelId(projectId, channelName), name: channelName };
    if (isChannelDeletedLocally(projectId, channel.id)) {
        showItemNameError('Este canal fue eliminado del sistema y no se puede volver a crear con el mismo identificador.');
        return false;
    }
    createChannelElement(projectId, channel, channelsGroup);
    project.channels.push(channel);
    sendCreateChannel(projectId, channel);

    projectItem.classList.add('active');
    channelsGroup.classList.add('active');
    selectChatChannel(channelsGroup.lastElementChild);
    return true;
}

function createChannelElement(projectId, channel, channelsGroup) {
    const channelItem = document.createElement('div');
    channelItem.className = 'channel-item';
    channelItem.dataset.projectId = projectId;
    channelItem.dataset.channelId = channel.id;
    channelItem.dataset.channelName = channel.name;
    const name = document.createElement('span');
    name.className = 'channel-name';
    name.textContent = safeText(channel.name, 'Canal');
    channelItem.appendChild(name);
    addChannelDeleteControl(channelItem);
    channelItem.addEventListener('click', () => {
        selectChatChannel(channelItem);
        if (typeof showChat === 'function') showChat();
    });
    channelsGroup.appendChild(channelItem);
    return channel;
}

function createDeleteButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'delete-item-btn';
    button.textContent = '×';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        onClick();
    });
    return button;
}

function addProjectDeleteControl(projectEl) {
    if (!isAdminUser(currentUser) || !projectEl || projectEl.querySelector('.delete-item-btn')) return;

    projectEl.appendChild(createDeleteButton('Eliminar proyecto', () => {
        const projectId = projectEl.dataset.projectId;
        const projectName = projectEl.dataset.projectName || 'este proyecto';
        openDeleteModal({
            title: 'Eliminar proyecto',
            message: `¿Seguro que quieres eliminar el proyecto "${projectName}"? Tambien se eliminaran sus canales.`,
            onConfirm: () => deleteProject(projectId, true)
        });
    }));
}

function addChannelDeleteControl(channelEl) {
    if (!isAdminUser(currentUser) || !channelEl || channelEl.querySelector('.delete-item-btn')) return;

    if (!channelEl.querySelector('.channel-name')) {
        const name = document.createElement('span');
        name.className = 'channel-name';
        name.textContent = safeText(channelEl.dataset.channelName || channelEl.textContent, 'Canal');
        channelEl.replaceChildren(name);
    }

    channelEl.appendChild(createDeleteButton('Eliminar canal', () => {
        const projectId = channelEl.dataset.projectId;
        const channelId = channelEl.dataset.channelId;
        const channelName = channelEl.dataset.channelName || 'este canal';
        openDeleteModal({
            title: 'Eliminar canal',
            message: `¿Seguro que quieres eliminar el canal "${channelName}"? Esta accion no se puede deshacer.`,
            onConfirm: () => deleteChannel(projectId, channelId, true)
        });
    }));
}

function addProjectFromServer(project, showAsNew) {
    if (isProjectDeletedLocally(project.id)) return;
    project.channels = project.channels.filter(channel => !isChannelDeletedLocally(project.id, channel.id));
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
    const icon = document.createElement('span');
    icon.className = 'project-icon';
    icon.textContent = '▾';
    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = safeText(project.name, 'Proyecto');
    newProject.append(icon, name);
    addProjectDeleteControl(newProject);
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
    if (isProjectDeletedLocally(projectId) || isChannelDeletedLocally(projectId, channel.id)) return;
    const project = projects.get(projectId);
    const channelsGroup = getChannelsGroup(projectId);
    if (!project || !channelsGroup || project.channels.some(item => item.id === channel.id || normalizeText(item.name) === normalizeText(channel.name))) return;

    project.channels.push(channel);
    createChannelElement(projectId, channel, channelsGroup);
    applySidebarSearch(document.getElementById('searchInput')?.value || '');
}

function deleteProject(projectId, notifyServer) {
    const project = projects.get(projectId);
    const projectEl = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    const channelsGroup = getChannelsGroup(projectId);
    const wasCurrentProject = currentProject && currentProject.id === projectId;

    markProjectDeletedLocally(projectId);

    if (!project && !projectEl) return;
    if (projectEl) projectEl.remove();
    if (channelsGroup) channelsGroup.remove();
    projects.delete(projectId);

    if (notifyServer) sendDeleteProject(projectId);
    if (wasCurrentProject) selectInitialRoom();
    applySidebarSearch(document.getElementById('searchInput')?.value || '');
}

function deleteChannel(projectId, channelId, notifyServer) {
    const project = projects.get(projectId);
    const channelEl = document.querySelector(`.channel-item[data-project-id="${projectId}"][data-channel-id="${channelId}"]`);
    const wasCurrentChannel = currentProject
        && currentChannel
        && currentProject.id === projectId
        && currentChannel.id === channelId;

    markChannelDeletedLocally(projectId, channelId);

    if (!project && !channelEl) return;
    if (project) {
        project.channels = project.channels.filter(channel => channel.id !== channelId);
    }
    if (channelEl) channelEl.remove();
    if (notifyServer) sendDeleteChannel(projectId, channelId);

    if (wasCurrentChannel) {
        const channelsGroup = getChannelsGroup(projectId);
        const nextChannel = channelsGroup ? channelsGroup.querySelector('.channel-item') : null;
        if (nextChannel) {
            selectChatChannel(nextChannel);
        } else {
            selectInitialRoom();
        }
    }

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

function projectNameExists(projectName) {
    const normalizedName = normalizeText(projectName);
    return Array.from(projects.values()).some(project => normalizeText(project.name) === normalizedName);
}

function channelNameExists(projectId, channelName) {
    const project = projects.get(projectId);
    if (!project) return false;

    const normalizedName = normalizeText(channelName);
    return project.channels.some(channel => normalizeText(channel.name) === normalizedName);
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
        collapseBtn.textContent = collapsed ? '»' : '«';
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expandir sidebar' : 'Colapsar sidebar');
    });
}

function initMobileProfileMenu() {
    const badge = document.getElementById('mobileUserBadge');
    const menu = document.getElementById('mobileProfileMenu');
    if (!badge || !menu || badge.dataset.bound === 'true') return;

    badge.dataset.bound = 'true';
    badge.addEventListener('click', (event) => {
        event.stopPropagation();
        menu.classList.toggle('hide');
    });

    document.addEventListener('click', (event) => {
        if (!badge.contains(event.target)) {
            menu.classList.add('hide');
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initCreateControls();
    initDeleteModal();
    initSidebarCollapse();
    initSidebarSearch();
    initMobileProfileMenu();
});

checkSession();
