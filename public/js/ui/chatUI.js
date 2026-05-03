function addMessage(data, currentUserId) {
    const container = document.getElementById('messages');
    const isMine = data.userId === currentUserId;

    if (data.type === 'system') {
        const el = document.createElement('div');
        el.className = 'msg-system';
        el.textContent = data.text;
        container.appendChild(el);
    } else {
        const time = new Date(data.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const isGoogle = data.img && data.img.startsWith('http');
        const avatarInner = isGoogle
            ? `<img src="${data.img}" alt="${data.name}" referrerpolicy="no-referrer">`
            : (data.name ? data.name[0].toUpperCase() : '?');

        const el = document.createElement('div');
        el.className = 'msg-bubble' + (isMine ? ' mine' : '');

        // PUNTO 10: Mostrar "Tú" si es el usuario actual
        const displayName = isMine ? 'Tú' : data.name;

        el.innerHTML = `
            <div class="msg-avatar ${isGoogle ? 'google' : ''}">${avatarInner}</div>
            <div class="msg-content">
                <span class="msg-name">${displayName}</span>
                <div class="msg-text">${escapeHtml(data.text)}</div>
                <span class="msg-time">${time}</span>
            </div>
        `;
        container.appendChild(el);
    }

    // PUNTO 14: Siempre scroll al final cuando el mensaje es largo
    container.scrollTop = container.scrollHeight;
}

// Escapar HTML para evitar inyecciones en mensajes
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) container.innerHTML = '';
}

function renderMessages(messages, currentUserId) {
    clearMessages();
    messages.forEach(message => addMessage(message, currentUserId));
}

function updateUserList(users) {
    const onlineList   = document.getElementById('onlineList');
    const offlineList  = document.getElementById('offlineList');
    const onlineLabel  = document.getElementById('onlineLabel');
    const offlineLabel = document.getElementById('offlineLabel');
    const onlineCount  = document.getElementById('onlineCount');

    if (!onlineList || !offlineList) return;

    onlineList.innerHTML  = '';
    offlineList.innerHTML = '';

    let onlineN = 0, offlineN = 0;

    users.forEach(u => {
        const initials = u.name ? u.name[0].toUpperCase() : '?';
        const isGoogle = u.provider === 'google';
        const handle = u.email ? '@' + u.email.split('@')[0] : '@' + u.name.toLowerCase().replace(/\s+/g, '');

        // PUNTO 7: Badge si es admin
        const isAdmin = u.rol === 'admin';
        const adminBadge = isAdmin ? '<span class="badge-admin">ADMIN</span>' : '';

        const li = document.createElement('li');
        li.className = 'people-item';

        const avatarClass = `people-avatar ${u.connected ? 'online' : ''} ${isGoogle ? 'google' : ''}`;
        const avatarInner = (isGoogle && u.img)
            ? `<img src="${u.img}" alt="${u.name}" referrerpolicy="no-referrer">`
            : initials;

        li.innerHTML = `
            <div class="${avatarClass}">${avatarInner}</div>
            <div class="people-info">
                <div class="people-name">${u.name} ${adminBadge}</div>
                <div class="people-handle">${handle}</div>
            </div>
        `;

        if (u.connected) {
            onlineList.appendChild(li);
            onlineN++;
        } else {
            offlineList.appendChild(li);
            offlineN++;
        }
    });

    if (onlineLabel)  onlineLabel.textContent  = `En línea - ${onlineN} persona${onlineN !== 1 ? 's' : ''}`;
    if (offlineLabel) offlineLabel.textContent = `Desconectados - ${offlineN} persona${offlineN !== 1 ? 's' : ''}`;
    if (onlineCount)  onlineCount.textContent  = `${onlineN} en línea`;
}
