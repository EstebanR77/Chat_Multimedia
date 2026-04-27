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
    container.scrollTop = container.scrollHeight;
}

// Actualiza ambos sidebars: izquierdo (canales) y derecho (personas)
function updateUserList(users) {
    const onlineList  = document.getElementById('onlineList');
    const offlineList = document.getElementById('offlineList');
    const onlineLabel  = document.getElementById('onlineLabel');
    const offlineLabel = document.getElementById('offlineLabel');
    const onlineCount  = document.getElementById('onlineCount');

    if (!onlineList || !offlineList) return;

    onlineList.innerHTML  = '';
    offlineList.innerHTML = '';

    let onlineN = 0, offlineN = 0;

    users.forEach(u => {
        const initials = u.name[0].toUpperCase();
        const isGoogle = u.provider === 'google';
        const handle   = u.email ? '@' + u.email.split('@')[0] : '@' + u.name.toLowerCase().replace(' ', '');

        const li = document.createElement('li');
        li.className = 'people-item';

        const avatarClass = `people-avatar ${u.connected ? 'online' : ''} ${isGoogle ? 'google' : ''}`;
        const avatarInner = (isGoogle && u.img)
            ? `<img src="${u.img}" alt="${u.name}" referrerpolicy="no-referrer">`
            : initials;

        li.innerHTML = `
            <div class="${avatarClass}">${avatarInner}</div>
            <div class="people-info">
                <div class="people-name">${u.name}</div>
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

    onlineLabel.textContent  = `En línea · ${onlineN} persona${onlineN !== 1 ? 's' : ''}`;
    offlineLabel.textContent = `Desconectados · ${offlineN} persona${offlineN !== 1 ? 's' : ''}`;
    onlineCount.textContent  = `${onlineN} en línea`;
}
