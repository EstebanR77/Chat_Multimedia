function safeText(value, fallback = '') {
    return String(value ?? fallback)
        .replace(/[\u0000-\u001f\u007f]/g, '')  // caracteres de control
        .replace(/[<>]/g, '')                    // inyección HTML
        .replace(/[{}\\]/g, '')                  // inyección CSS
        .trim();
}

function safeImageUrl(value) {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function createAvatar(imageUrl, displayName, baseClass) {
    const avatar = document.createElement('div');
    const safeUrl = safeImageUrl(imageUrl);
    const name = safeText(displayName, 'Usuario');
    avatar.className = baseClass + (safeUrl ? ' google' : '');

    if (safeUrl) {
        const img = document.createElement('img');
        img.src = safeUrl;
        img.alt = name;
        img.referrerPolicy = 'no-referrer';
        // Si la imagen falla, mostrar inicial en lugar de icono roto (evita onerror JS injection)
        img.onerror = function () {
            avatar.removeChild(img);
            avatar.classList.remove('google');
            avatar.textContent = name ? name[0].toUpperCase() : '?';
        };
        avatar.appendChild(img);
    } else {
        avatar.textContent = name ? name[0].toUpperCase() : '?';
    }

    return avatar;
}

function addMessage(data, currentUserId, options = {}) {
    const container = document.getElementById('messages');
    if (!container) return;

    const isMine = data.userId === currentUserId;
    const shouldScroll = options.scroll !== false;

    if (data.type === 'system') {
        const el = document.createElement('div');
        el.className = 'msg-system';
        el.textContent = safeText(data.text);
        container.appendChild(el);
    } else {
        const time = new Date(data.time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const el = document.createElement('div');
        el.className = 'msg-bubble' + (isMine ? ' mine' : '');

        const avatar = createAvatar(data.img, data.name, 'msg-avatar');
        const content = document.createElement('div');
        content.className = 'msg-content';

        const name = document.createElement('span');
        name.className = 'msg-name';
        name.textContent = isMine ? 'Tú' : safeText(data.name, 'Usuario');

        const text = document.createElement('div');
        text.className = 'msg-text';
        text.textContent = safeText(data.text);

        const messageTime = document.createElement('span');
        messageTime.className = 'msg-time';
        messageTime.textContent = time;

        content.append(name, text, messageTime);
        el.append(avatar, content);
        container.appendChild(el);
    }

    if (shouldScroll) {
        container.scrollTop = container.scrollHeight;
        if (typeof updateRecentMessagesButton === 'function') updateRecentMessagesButton();
    }
}

function clearMessages() {
    const container = document.getElementById('messages');
    if (container) container.replaceChildren();
}

function renderMessages(messages, currentUserId) {
    const container = document.getElementById('messages');
    if (!container) return;

    container.classList.add('no-smooth');
    clearMessages();
    messages.forEach(message => addMessage(message, currentUserId, { scroll: false }));
    container.scrollTop = container.scrollHeight;
    if (typeof updateRecentMessagesButton === 'function') updateRecentMessagesButton();

    requestAnimationFrame(() => {
        container.classList.remove('no-smooth');
    });
}

function updateUserList(users) {
    const onlineList = document.getElementById('onlineList');
    const offlineList = document.getElementById('offlineList');
    const mobileOnlineList = document.getElementById('mobileOnlineList');
    const mobileOnlineLabel = document.getElementById('mobileOnlineLabel');
    const onlineLabel = document.getElementById('onlineLabel');
    const offlineLabel = document.getElementById('offlineLabel');
    const onlineCount = document.getElementById('onlineCount');

    if (!onlineList || !offlineList) return;

    onlineList.replaceChildren();
    offlineList.replaceChildren();
    if (mobileOnlineList) mobileOnlineList.replaceChildren();

    let onlineN = 0;
    let offlineN = 0;

    users.forEach(u => {
        const userName = safeText(u.name, 'Usuario');
        const email = safeText(u.email);
        const handle = email ? '@' + email.split('@')[0] : '@' + userName.toLowerCase().replace(/\s+/g, '');
        const isAdmin = safeText(u.rol).toLowerCase() === 'admin';

        const li = document.createElement('li');
        li.className = 'people-item';

        const avatar = createAvatar(u.img, userName, 'people-avatar');
        avatar.classList.toggle('online', Boolean(u.connected));

        const info = document.createElement('div');
        info.className = 'people-info';

        const name = document.createElement('div');
        name.className = 'people-name';
        name.textContent = userName + (isAdmin ? ' ' : '');
        if (isAdmin) {
            const adminBadge = document.createElement('span');
            adminBadge.className = 'badge-admin';
            adminBadge.textContent = 'ADMIN';
            name.appendChild(adminBadge);
        }

        const userHandle = document.createElement('div');
        userHandle.className = 'people-handle';
        userHandle.textContent = handle;

        info.append(name, userHandle);
        li.append(avatar, info);

        if (u.connected) {
            onlineList.appendChild(li);
            if (mobileOnlineList) mobileOnlineList.appendChild(createMobileOnlineUser(u, userName));
            onlineN++;
        } else {
            offlineList.appendChild(li);
            offlineN++;
        }
    });

    if (onlineLabel) onlineLabel.textContent = `En linea - ${onlineN} persona${onlineN !== 1 ? 's' : ''}`;
    if (mobileOnlineLabel) mobileOnlineLabel.textContent = `En linea - ${onlineN} persona${onlineN !== 1 ? 's' : ''}`;
    if (offlineLabel) offlineLabel.textContent = `Desconectados - ${offlineN} persona${offlineN !== 1 ? 's' : ''}`;
    if (onlineCount) onlineCount.textContent = `${onlineN} en linea`;
}

function createMobileOnlineUser(user, userName) {
    const item = document.createElement('div');
    item.className = 'mobile-online-user';

    const avatar = createAvatar(user.img, userName, 'mobile-online-avatar');
    avatar.classList.add('online');

    const name = document.createElement('span');
    name.textContent = userName.split(/\s+/)[0] || 'Usuario';

    item.append(avatar, name);
    return item;
}
