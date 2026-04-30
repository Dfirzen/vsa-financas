/**
 * Conversations Service
 * Manages persistent multi-conversation history for the VSA bot.
 * Stores in userData/data/conversations.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_MESSAGES_PER_CONVERSATION = 60;

class ConversationsService {
    constructor() {
        this._dataDir = null;
        this._conversationsFile = null;
    }

    _initPaths() {
        if (this._dataDir) return;
        try {
            const { app } = require('electron');
            const userDataPath = app.getPath('userData');
            this._dataDir = path.join(userDataPath, 'data');
        } catch (_) {
            this._dataDir = path.join(require('os').homedir(), 'VSA', 'data');
        }
        if (!fs.existsSync(this._dataDir)) {
            fs.mkdirSync(this._dataDir, { recursive: true });
        }
        this._conversationsFile = path.join(this._dataDir, 'conversations.json');
    }

    _load() {
        this._initPaths();
        if (!fs.existsSync(this._conversationsFile)) {
            return { active_id: null, conversations: [] };
        }
        try {
            return JSON.parse(fs.readFileSync(this._conversationsFile, 'utf-8'));
        } catch (e) {
            console.error('[ConversationsService] Parse error:', e.message);
            return { active_id: null, conversations: [] };
        }
    }

    _save(data) {
        this._initPaths();
        fs.writeFileSync(this._conversationsFile, JSON.stringify(data, null, 2), 'utf-8');
    }

    /**
     * Create a new conversation.
     * Returns the new conversation object.
     */
    createConversation(title = null) {
        const data = this._load();
        const id = crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`;
        const conv = {
            id,
            title: title || `Conversa ${new Date().toLocaleDateString('pt-BR')}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            messages: []
        };
        data.conversations.unshift(conv); // newest first
        data.active_id = id;
        this._save(data);
        return conv;
    }

    /**
     * Returns the active conversation, or creates one if none exists.
     */
    getOrCreateActiveConversation() {
        const data = this._load();
        if (data.active_id) {
            const found = data.conversations.find(c => c.id === data.active_id);
            if (found) return found;
        }
        // None found — create first conversation
        return this.createConversation('Primeira conversa');
    }

    /**
     * List all conversations (without messages, for sidebar display).
     */
    getAllConversations() {
        const data = this._load();
        return data.conversations.map(c => ({
            id: c.id,
            title: c.title,
            created_at: c.created_at,
            updated_at: c.updated_at,
            message_count: c.messages.length,
            preview: c.messages.length > 0
                ? (c.messages[c.messages.length - 1].content || '').substring(0, 60)
                : ''
        }));
    }

    getActiveId() {
        return this._load().active_id;
    }

    setActiveConversation(conversationId) {
        const data = this._load();
        const found = data.conversations.find(c => c.id === conversationId);
        if (!found) return false;
        data.active_id = conversationId;
        this._save(data);
        return true;
    }

    /**
     * Returns ALL messages for a conversation (for display).
     */
    getMessages(conversationId) {
        const data = this._load();
        const conv = data.conversations.find(c => c.id === conversationId);
        if (!conv) return [];
        return conv.messages;
    }

    /**
     * Appends a message to a conversation.
     * Auto-truncates old messages beyond MAX_MESSAGES_PER_CONVERSATION.
     * Returns the updated message list.
     */
    appendMessage(conversationId, role, content) {
        const data = this._load();
        const conv = data.conversations.find(c => c.id === conversationId);
        if (!conv) return [];

        conv.messages.push({
            id: `msg_${Date.now()}`,
            role, // 'user' | 'bot'
            content,
            timestamp: new Date().toISOString()
        });

        // Auto-truncate: keep last MAX_MESSAGES messages
        if (conv.messages.length > MAX_MESSAGES_PER_CONVERSATION) {
            conv.messages = conv.messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
        }

        conv.updated_at = new Date().toISOString();
        // Update title from first user message if default
        if (conv.messages.filter(m => m.role === 'user').length === 1 && role === 'user') {
            conv.title = content.substring(0, 40) + (content.length > 40 ? '…' : '');
        }

        this._save(data);
        return conv.messages;
    }

    /**
     * Delete a conversation. If it was active, sets active to the next available.
     */
    deleteConversation(conversationId) {
        const data = this._load();
        const idx = data.conversations.findIndex(c => c.id === conversationId);
        if (idx === -1) return false;

        data.conversations.splice(idx, 1);

        if (data.active_id === conversationId) {
            data.active_id = data.conversations.length > 0 ? data.conversations[0].id : null;
        }

        this._save(data);
        return true;
    }

    /**
     * Rename a conversation.
     */
    renameConversation(conversationId, newTitle) {
        const data = this._load();
        const conv = data.conversations.find(c => c.id === conversationId);
        if (!conv) return false;
        conv.title = newTitle;
        conv.updated_at = new Date().toISOString();
        this._save(data);
        return true;
    }
}

const conversationsService = new ConversationsService();
module.exports = { conversationsService };
