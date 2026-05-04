const TEXT_LIMITS = {
    name: 80,
    email: 120,
    role: 40,
    projectName: 60,
    channelName: 40,
    id: 80
};

function sanitizeText(value, maxLength = 500) {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]/g, '')  // elimina caracteres de control
        .replace(/[<>]/g, '')                    // bloquea inyección HTML
        .replace(/[{}\\]/g, '')                  // bloquea inyección CSS
        .trim()
        .slice(0, maxLength);
}

function sanitizeEmail(value) {
    return sanitizeText(value, TEXT_LIMITS.email).toLowerCase();
}

function sanitizeUrl(value) {
    const text = sanitizeText(value, 500);
    if (!text) return '';

    try {
        const url = new URL(text);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function slugify(value) {
    return sanitizeText(value, TEXT_LIMITS.id)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

function sanitizeUser(user = {}) {
    return {
        id: Number(user.id),
        name: sanitizeText(user.name, TEXT_LIMITS.name) || 'Usuario',
        rol: sanitizeText(user.rol, TEXT_LIMITS.role) || 'user',
        email: sanitizeEmail(user.email),
        img: sanitizeUrl(user.img || user.avatar),
        avatar: sanitizeUrl(user.avatar || user.img),
        provider: sanitizeText(user.provider, TEXT_LIMITS.role) || 'local',
        password: typeof user.password === 'string' ? user.password : ''
    };
}

function sanitizeChannel(channel = {}) {
    const name = sanitizeText(channel.name, TEXT_LIMITS.channelName) || 'General';
    return {
        id: slugify(channel.id || name),
        name
    };
}

function sanitizeProject(project = {}) {
    const name = sanitizeText(project.name, TEXT_LIMITS.projectName);
    const id = slugify(project.id || name);
    const memberIds = Array.isArray(project.memberIds)
        ? project.memberIds.map(Number).filter(Number.isFinite)
        : [];
    const channels = Array.isArray(project.channels)
        ? project.channels.map(sanitizeChannel)
        : [];

    return { id, name, memberIds, channels };
}

module.exports = {
    TEXT_LIMITS,
    sanitizeText,
    sanitizeEmail,
    sanitizeUrl,
    slugify,
    sanitizeUser,
    sanitizeChannel,
    sanitizeProject
};
