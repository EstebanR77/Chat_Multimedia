// Agrega un mensaje al área de chat
function addMessage(data, currentUserId) {
    const container = document.getElementById('messages');
    const isMine = data.userId === currentUserId;

    if (data.type === 'system') {
        const el = document.createElement('div');
        el.className = 'msg-system';
        el.textContent = data.text;
        container.appendChild(el);
    } else {
        const initials = data.name ? data.name[0].toUpperCase() : '?';
        const time = new Date(data.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        const el = document.createElement('div');
        el.className = 'msg-bubble' + (isMine ? ' mine' : '');
        el.innerHTML = `
            <div class="msg-avatar">${initials}</div>
            <div class="msg-content">
                <span class="msg-name">${isMine ? 'Tú' : data.name}</span>
                <div class="msg-text">${data.text}</div>
                <span class="msg-time">${time}</span>
            </div>
        `;
        container.appendChild(el);
    }

    // Scroll automático al último mensaje
    container.scrollTop = container.scrollHeight;
}

// Actualiza la lista de usuarios en el sidebar
function updateUserList(users) {
    const list = document.getElementById('userList');
    const onlineCount = document.getElementById('onlineCount');
    list.innerHTML = '';

    let online = 0;
    users.forEach(u => {
        if (u.connected) online++;
        const initials = u.name[0].toUpperCase();
        const li = document.createElement('li');
        li.className = 'user-item';
        li.innerHTML = `
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
                <div class="user-name">${u.name}</div>
                <div class="user-rol">${u.rol}</div>
            </div>
            <div class="status-dot ${u.connected ? 'online' : ''}"></div>
        `;
        list.appendChild(li);
    });

    onlineCount.textContent = `${online} en línea`;
}
