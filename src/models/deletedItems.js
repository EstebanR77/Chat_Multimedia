const fs = require('fs');
const path = require('path');
const { slugify } = require('../utils/security');

const DB_PATH = path.join(__dirname, '../data/deleted-items.json');

function readDeletedItems() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            return { projects: [], channels: {} };
        }

        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        return {
            projects: Array.isArray(data.projects) ? data.projects.map(slugify) : [],
            channels: data.channels && typeof data.channels === 'object' ? data.channels : {}
        };
    } catch {
        return { projects: [], channels: {} };
    }
}

function saveDeletedItems(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getDeletedItems() {
    return readDeletedItems();
}

function isProjectDeleted(projectId) {
    const data = readDeletedItems();
    return data.projects.includes(slugify(projectId));
}

function isChannelDeleted(projectId, channelId) {
    const data = readDeletedItems();
    const safeProjectId = slugify(projectId);
    const safeChannelId = slugify(channelId);
    return Array.isArray(data.channels[safeProjectId]) && data.channels[safeProjectId].includes(safeChannelId);
}

function markProjectDeleted(projectId) {
    const data = readDeletedItems();
    const safeProjectId = slugify(projectId);
    if (!data.projects.includes(safeProjectId)) {
        data.projects.push(safeProjectId);
    }
    delete data.channels[safeProjectId];
    saveDeletedItems(data);
}

function markChannelDeleted(projectId, channelId) {
    const data = readDeletedItems();
    const safeProjectId = slugify(projectId);
    const safeChannelId = slugify(channelId);
    const channels = Array.isArray(data.channels[safeProjectId]) ? data.channels[safeProjectId] : [];
    if (!channels.includes(safeChannelId)) {
        channels.push(safeChannelId);
    }
    data.channels[safeProjectId] = channels;
    saveDeletedItems(data);
}

module.exports = {
    getDeletedItems,
    isProjectDeleted,
    isChannelDeleted,
    markProjectDeleted,
    markChannelDeleted
};
