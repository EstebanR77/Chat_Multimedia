// Obtiene el usuario guardado en localStorage
let currentUser = JSON.parse(localStorage.getItem("user"));

// ─────────────────────────────────────────────
// Verificar sesión con el servidor (igual que el profe)
// Si viene de Google OAuth, /api/me lo confirma
// ─────────────────────────────────────────────
async function checkSession() {
    try {
        const res  = await fetch("/api/me");
        const data = await res.json();

        if (data.authenticated) {
            // Viene de Google: guardar en localStorage igual que login normal
            localStorage.setItem("user", JSON.stringify(data.user));
            currentUser = data.user;
            iniciarChat();
        } else if (currentUser) {
            // Viene de login normal: ya está en localStorage
            iniciarChat();
        } else {
            // No hay sesión de ningún tipo → redirige al login
            window.location.href = "login.html";
        }
    } catch {
        // Si falla la red, intenta con localStorage
        if (currentUser) {
            iniciarChat();
        } else {
            window.location.href = "login.html";
        }
    }
}

function iniciarChat() {
    // Conecta al WebSocket y define qué hacer con cada mensaje
    connectSocket(currentUser, (data) => {
        if (data.type === "users") {
            updateUserList(data.users);
        } else if (data.type === "chat" || data.type === "system") {
            addMessage(data, currentUser.id);
        }
    });
}

// Envía mensaje al presionar el botón
function sendMessage() {
    const input = document.getElementById("msgInput");
    const text  = input.value.trim();
    if (!text) return;
    sendChatMessage(currentUser, text);
    input.value = "";
}

// Envía mensaje al presionar Enter
function handleKey(e) {
    if (e.key === "Enter") sendMessage();
}

// Cierra sesión: limpia localStorage + sesión del servidor
function logout() {
    localStorage.removeItem("user");
    window.location.href = "/auth/logout";
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

    openBtn.addEventListener('click', () => {
        const isOpen = !createPanel.classList.contains('hide');
        if (isOpen) {
            createPanel.classList.add('hide');
            channelsList.classList.remove('create-open');
        } else {
            createPanel.classList.remove('hide');
            collapseAllProjects();
            channelsList.classList.add('create-open');
        }
    });

    document.querySelectorAll('.create-option').forEach((button) => {
        button.addEventListener('click', () => {
            openCreateModal(button.dataset.create);
        });
    });

    modalClose.addEventListener('click', closeCreateModal);
    modalCancel.addEventListener('click', closeCreateModal);
    backdrop.addEventListener('click', closeCreateModal);
    createForm.addEventListener('submit', handleCreateSubmit);

    function collapseAllProjects() {
        document.querySelectorAll('.project-item.active').forEach((project) => {
            project.classList.remove('active');
            const next = project.nextElementSibling;
            if (next && next.classList.contains('channels-group')) {
                next.classList.remove('active');
            }
        });
    }

    function openCreateModal(type) {
        activeType = type;
        createPanel.classList.add('hide');
        renderProjectOptions();
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
            document.getElementById('modalSubtitle').textContent = 'Crea un nuevo proyecto para organizar tus canales.';
            itemNameLabel.textContent = 'Nombre del proyecto';
            itemNameInput.placeholder = 'Ej. App cliente';
            projectParticipantsGroup.classList.remove('hide');
            projectDefaultChannelsGroup.classList.remove('hide');
            channelProjectGroup.classList.add('hide');
            channelNameGroup.classList.add('hide');
            formSubmit.textContent = 'Crear proyecto';
        } else {
            document.getElementById('modalTitle').textContent = 'Nuevo canal';
            document.getElementById('modalSubtitle').textContent = 'Añade un canal nuevo a uno de tus proyectos existentes.';
            itemNameLabel.textContent = 'Nombre del canal';
            itemNameInput.placeholder = 'Ej. #Marketing #Frontend';
            projectParticipantsGroup.classList.add('hide');
            projectDefaultChannelsGroup.classList.add('hide');
            channelProjectGroup.classList.remove('hide');
            channelNameGroup.classList.remove('hide');
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
        const projects = Array.from(document.querySelectorAll('.project-item')).map((item) => item.dataset.projectName).filter(Boolean);
        projects.forEach((projectName) => {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = projectName;
            projectSelect.appendChild(option);
        });
    }

    function createProject(projectName, withDefaults) {
        const projectList = document.querySelector('.channels-list');
        const firstGeneral = document.querySelector('.general-item');

        const newProject = document.createElement('div');
        newProject.className = 'project-item';
        newProject.dataset.projectName = projectName;
        newProject.innerHTML = '<span class="project-icon">▼</span><span class="project-name"># ' + projectName + '</span>';
        newProject.addEventListener('click', () => toggleProject(newProject));

        const channelsGroup = document.createElement('div');
        channelsGroup.className = 'channels-group';
        if (withDefaults) {
            ['General', 'Diseño', 'Desarrollo', 'Marketing'].forEach((channel) => {
                const channelItem = document.createElement('div');
                channelItem.className = 'channel-item';
                channelItem.innerHTML = '<span>#</span> ' + channel;
                channelItem.addEventListener('click', () => selectChannel(channelItem, channel));
                channelsGroup.appendChild(channelItem);
            });
        }

        projectList.insertBefore(channelsGroup, firstGeneral);
        projectList.insertBefore(newProject, channelsGroup);
    }

    function createChannel(projectName, channelName) {
        const projectItem = Array.from(document.querySelectorAll('.project-item')).find((item) => item.dataset.projectName === projectName);
        if (!projectItem) return;

        const channelsGroup = projectItem.nextElementSibling;
        if (!channelsGroup || !channelsGroup.classList.contains('channels-group')) return;

        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item';
        channelItem.innerHTML = '<span>#</span> ' + channelName;
        channelItem.addEventListener('click', () => selectChannel(channelItem, channelName));
        channelsGroup.appendChild(channelItem);
        if (!channelsGroup.classList.contains('active')) {
            projectItem.classList.add('active');
            channelsGroup.classList.add('active');
        }
    }
}

function initSidebarCollapse() {
    const collapseBtn = document.querySelector('.collapse-btn');
    const chatContainer = document.querySelector('.chat-container');

    if (!collapseBtn || !chatContainer) return;

    collapseBtn.addEventListener('click', () => {
        const collapsed = chatContainer.classList.toggle('collapsed');
        collapseBtn.textContent = collapsed ? '›' : '‹';
        collapseBtn.setAttribute('aria-label', collapsed ? 'Expandir sidebar' : 'Colapsar sidebar');
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initCreateControls();
    initSidebarCollapse();
});

// Iniciar verificación de sesión
checkSession();
