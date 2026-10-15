/**
 * QUANTUM NET — Global Aura-Net AI Chatbot Component (aura-net.js)
 * Autonomous, context-aware AI telemetry assistant loaded across all interfaces.
 */
(function () {
    'use strict';

    // Avoid duplicate initialization
    if (window.AuraNetInitialized) return;
    window.AuraNetInitialized = true;

    // Detect Page Context
    const pathname = window.location.pathname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);
    const eventIdParam = searchParams.get('id') || searchParams.get('event_id');

    // Page-specific suggested chips mapping
    function getContextualSuggestions() {
        if (pathname.includes('event-details') || pathname.includes('event-detail')) {
            return [
                'Summarize this event',
                'How many seats are available?',
                'What is the schedule & venue?',
                'Has this event changed?',
                'How do I register?'
            ];
        }
        if (pathname.includes('events')) {
            return [
                'Show upcoming events',
                'Which events have seats left?',
                'Recommend an AI workshop',
                'Are there any hackathons?',
                'What are the event venues?'
            ];
        }
        if (pathname.includes('dashboard')) {
            return [
                'Show my registered passes',
                'What is my ticket ID?',
                'How do I cancel a registration?',
                'Check my notifications',
                'Upcoming events'
            ];
        }
        if (pathname.includes('ticket')) {
            return [
                'Explain my pass telemetry',
                'What should I bring to the event?',
                'What happens if event is cancelled?',
                'Is my pass confirmed?'
            ];
        }
        if (pathname.includes('admin')) {
            return [
                'Summarize system analytics',
                'Check seat capacity stats',
                'Show recent event changes',
                'Explain venue conflict checks',
                'How to deploy a new event'
            ];
        }
        if (pathname.includes('login') || pathname.includes('register') || pathname.includes('signup')) {
            return [
                'How do I create an account?',
                'What credentials can I use to test?',
                'What are the registration rules?',
                'What events are coming up?'
            ];
        }
        if (pathname.includes('payment')) {
            return [
                'Explain Q-Credits payment',
                'What is the refund policy?',
                'What if the event is cancelled?',
                'How does the waitlist work?'
            ];
        }
        if (pathname.includes('participate')) {
            return [
                'How do I participate?',
                'Are there prerequisites?',
                'How does waitlist promotion work?',
                'Upcoming events schedule'
            ];
        }
        if (pathname.includes('contact')) {
            return [
                'How do I reach the team?',
                'Who organizes Quantum Net?',
                'Upcoming event schedule',
                'Seats remaining status'
            ];
        }
        // Default / Index / About
        return [
            'What events are coming up?',
            'How do I register for an event?',
            'Which events have open seats?',
            'Explain the Anomaly Engine',
            'What is Quantum Net?'
        ];
    }

    // Context banner tag label
    function getContextLabel() {
        if (pathname.includes('event-details') || pathname.includes('event-detail')) {
            return `📍 EVENT BRIEF #${eventIdParam || 'ACTIVE'}`;
        }
        if (pathname.includes('events')) return '📍 EVENT GRID DIRECTORY';
        if (pathname.includes('dashboard')) return '📍 AGENT DASHBOARD';
        if (pathname.includes('ticket')) return '📍 PASS VERIFICATION';
        if (pathname.includes('admin')) return '📍 ADMINISTRATIVE HUD';
        if (pathname.includes('login') || pathname.includes('register')) return '📍 AUTHENTICATION PORTAL';
        if (pathname.includes('contact')) return '📍 COMMUNICATIONS CHANNEL';
        return '📍 MAINFRAME GLOBAL';
    }

    // Ensure CSS is loaded
    function injectStyles() {
        if (!document.querySelector('link[href*="aura-net.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/aura-net.css';
            document.head.appendChild(link);
        }
    }

    // Clean up any old static widget containers in index.html or contact.html
    function removeLegacyWidgets() {
        const legacy = document.getElementById('aura-widget-container');
        if (legacy) legacy.remove();
    }

    // State management
    const STORAGE_KEY = 'quantum_aura_chat_session';
    const MODAL_STATE_KEY = 'quantum_aura_modal_state';

    const defaultGreeting = {
        role: 'assistant',
        text: 'Greetings Agent. I am **Aura-Net**, grounded in live Quantum Net PostgreSQL telemetry. Ask me about upcoming events, seat counts, venue modifications, or your registered passes.'
    };

    let sessionMessages = [];
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) sessionMessages = JSON.parse(saved);
    } catch (e) {
        sessionMessages = [];
    }

    if (!sessionMessages || sessionMessages.length === 0) {
        sessionMessages = [defaultGreeting];
    }

    let isSending = false;
    let lastFailedQuery = null;

    // Build DOM
    function buildChatDOM() {
        removeLegacyWidgets();
        injectStyles();

        // 1. Wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'aura-launcher-wrapper';

        // Tooltip Pill
        const pill = document.createElement('div');
        pill.id = 'aura-launcher-pill';
        pill.textContent = '⚡ AURA-NET // AI TELEMETRY';
        wrapper.appendChild(pill);

        // Chat Modal
        const modal = document.createElement('div');
        modal.id = 'aura-chat-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-label', 'Aura-Net AI Telemetry Assistant');

        modal.innerHTML = `
            <!-- Header -->
            <div class="aura-header">
                <div class="aura-header-left">
                    <span class="aura-status-dot"></span>
                    <div class="aura-title-block">
                        <span class="aura-brand-title">AURA-NET // TELEMETRY</span>
                        <span class="aura-brand-subtitle">Cosmic Event Intelligence</span>
                    </div>
                </div>
                <div class="aura-header-controls">
                    <button id="aura-clear-btn" class="aura-ctrl-btn" title="Reset Session" aria-label="Clear chat">🗑️</button>
                    <button id="aura-minimize-btn" class="aura-ctrl-btn" title="Minimize" aria-label="Minimize chat">—</button>
                    <button id="aura-close-btn" class="aura-ctrl-btn" title="Close" aria-label="Close chat">✕</button>
                </div>
            </div>

            <!-- Body Container -->
            <div id="aura-body-container">
                <!-- Context Banner -->
                <div class="aura-context-banner">
                    <span id="aura-context-text">${getContextLabel()}</span>
                    <span class="aura-context-tag">GROUNDED</span>
                </div>

                <!-- Messages List -->
                <div id="aura-messages-list" role="log" aria-live="polite"></div>

                <!-- Chips Carousel -->
                <div id="aura-chips-bar" class="aura-chips-container" role="toolbar" aria-label="Suggested Prompts"></div>

                <!-- Input Form -->
                <form id="aura-input-form" class="aura-input-form">
                    <input 
                        type="text" 
                        id="aura-chat-input" 
                        class="aura-input-field" 
                        placeholder="Transmit query to Aura-Net..." 
                        autocomplete="off" 
                        maxlength="1000"
                        aria-label="Your query for Aura-Net"
                    />
                    <button type="submit" id="aura-submit-btn" class="aura-send-btn" aria-label="Send message">
                        <span>SEND</span>
                    </button>
                </form>
            </div>
        `;

        wrapper.appendChild(modal);

        // 2. Floating Launcher Button
        const btn = document.createElement('button');
        btn.id = 'aura-launcher-btn';
        btn.setAttribute('aria-label', 'Toggle Aura-Net AI Chatbot');
        btn.innerHTML = `
            <div class="aura-pulse-ring"></div>
            <span id="aura-launcher-badge"></span>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
        `;

        wrapper.appendChild(btn);
        document.body.appendChild(wrapper);

        // Bind events
        btn.addEventListener('click', toggleChat);
        document.getElementById('aura-close-btn').addEventListener('click', closeChat);
        document.getElementById('aura-minimize-btn').addEventListener('click', toggleMinimize);
        document.getElementById('aura-clear-btn').addEventListener('click', clearChat);
        document.getElementById('aura-input-form').addEventListener('submit', handleFormSubmit);

        // Render initial chips & messages
        renderSuggestedChips();
        renderMessages();

        // Restore open/closed state if was open in session
        try {
            const savedState = sessionStorage.getItem(MODAL_STATE_KEY);
            if (savedState === 'open') {
                openChat();
            }
        } catch (e) {}
    }

    // Toggle Chat
    function toggleChat() {
        const modal = document.getElementById('aura-chat-modal');
        if (modal.classList.contains('aura-visible')) {
            closeChat();
        } else {
            openChat();
        }
    }

    function openChat() {
        const modal = document.getElementById('aura-chat-modal');
        modal.classList.add('aura-visible');
        modal.classList.remove('aura-minimized');
        document.getElementById('aura-minimize-btn').textContent = '—';
        try { sessionStorage.setItem(MODAL_STATE_KEY, 'open'); } catch (e) {}
        scrollMessagesToBottom();
        setTimeout(() => {
            const input = document.getElementById('aura-chat-input');
            if (input) input.focus();
        }, 100);
    }

    function closeChat() {
        const modal = document.getElementById('aura-chat-modal');
        modal.classList.remove('aura-visible');
        try { sessionStorage.setItem(MODAL_STATE_KEY, 'closed'); } catch (e) {}
    }

    function toggleMinimize() {
        const modal = document.getElementById('aura-chat-modal');
        const minBtn = document.getElementById('aura-minimize-btn');
        if (modal.classList.contains('aura-minimized')) {
            modal.classList.remove('aura-minimized');
            minBtn.textContent = '—';
        } else {
            modal.classList.add('aura-minimized');
            minBtn.textContent = '▢';
        }
    }

    function clearChat() {
        sessionMessages = [defaultGreeting];
        lastFailedQuery = null;
        try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
        renderMessages();
    }

    // Markdown Formatter
    function formatMarkdown(text) {
        if (!text) return '';
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks: `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold: **text**
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text*
        escaped = escaped.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');

        // Markdown links: [text](url)
        escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_self">$1</a>');

        // Bullet lists: • or -
        escaped = escaped.replace(/^[\s]*[•-][\s]+(.*)$/gm, '• $1');

        // Preserve newlines
        escaped = escaped.replace(/\n/g, '<br/>');

        return escaped;
    }

    // Render Messages
    function renderMessages() {
        const list = document.getElementById('aura-messages-list');
        if (!list) return;

        list.innerHTML = '';
        sessionMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `aura-msg aura-msg-${msg.role}`;
            div.innerHTML = formatMarkdown(msg.text);
            list.appendChild(div);
        });

        if (lastFailedQuery) {
            const errDiv = document.createElement('div');
            errDiv.className = 'aura-msg-error';
            errDiv.innerHTML = `
                <div>Transmission anomaly detected. Mainz server or network unreachable.</div>
                <button class="aura-retry-btn" id="aura-retry-action">⚡ RETRY TRANSMISSION</button>
            `;
            list.appendChild(errDiv);

            const retryBtn = document.getElementById('aura-retry-action');
            if (retryBtn) {
                retryBtn.onclick = () => {
                    const q = lastFailedQuery;
                    lastFailedQuery = null;
                    sendUserQuery(q);
                };
            }
        }

        scrollMessagesToBottom();
    }

    function scrollMessagesToBottom() {
        const list = document.getElementById('aura-messages-list');
        if (list) {
            list.scrollTop = list.scrollHeight;
        }
    }

    // Render Contextual Chips
    function renderSuggestedChips() {
        const container = document.getElementById('aura-chips-bar');
        if (!container) return;

        container.innerHTML = '';
        const chips = getContextualSuggestions();
        chips.forEach(chipText => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'aura-chip';
            chip.textContent = chipText;
            chip.onclick = () => {
                if (isSending) return;
                sendUserQuery(chipText);
            };
            container.appendChild(chip);
        });
    }

    // Submit handler
    function handleFormSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('aura-chat-input');
        const text = (input ? input.value : '').trim();
        if (!text || isSending) return;

        input.value = '';
        sendUserQuery(text);
    }

    // Send query to backend
    async function sendUserQuery(text) {
        if (!text || isSending) return;
        isSending = true;

        const input = document.getElementById('aura-chat-input');
        const submitBtn = document.getElementById('aura-submit-btn');
        if (input) input.disabled = true;
        if (submitBtn) submitBtn.disabled = true;

        // Push user message
        sessionMessages.push({ role: 'user', text });
        renderMessages();

        // Show typing indicator
        const list = document.getElementById('aura-messages-list');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'aura-typing-bubble';
        typingDiv.id = 'aura-typing-indicator';
        typingDiv.innerHTML = `
            <span>Aura-Net telemetry core reasoning</span>
            <div class="aura-typing-dots">
                <span class="aura-typing-dot"></span>
                <span class="aura-typing-dot"></span>
                <span class="aura-typing-dot"></span>
            </div>
        `;
        list.appendChild(typingDiv);
        scrollMessagesToBottom();

        // Gather token from Auth helper or localStorage
        let token = null;
        try {
            if (window.Auth && window.Auth.token) {
                token = window.Auth.token;
            } else {
                token = localStorage.getItem('agent_token');
            }
        } catch (e) {}

        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const payload = {
            message: text,
            page: window.location.pathname,
            eventId: eventIdParam || null,
            history: sessionMessages.slice(-6).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                text: m.text
            }))
        };

        try {
            const res = await fetch('/api/ai-chat', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            const typingInd = document.getElementById('aura-typing-indicator');
            if (typingInd) typingInd.remove();

            if (res.ok && data.success) {
                const reply = data.response || data.reply || 'Transmission received.';
                sessionMessages.push({ role: 'assistant', text: reply });
                lastFailedQuery = null;
            } else {
                const errMsg = (data && data.message) || 'Aura-Net telemetry channel anomaly.';
                sessionMessages.push({
                    role: 'assistant',
                    text: `⚠️ **Mainframe Notice**: ${errMsg}`
                });
            }
        } catch (err) {
            const typingInd = document.getElementById('aura-typing-indicator');
            if (typingInd) typingInd.remove();
            lastFailedQuery = text;
        } finally {
            isSending = false;
            if (input) input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;

            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionMessages.slice(-20)));
            } catch (e) {}

            renderMessages();
            if (input) input.focus();
        }
    }

    // Expose Global API for programmatic trigger if desired
    window.AuraNet = {
        open: openChat,
        close: closeChat,
        toggle: toggleChat,
        send: sendUserQuery,
        clear: clearChat
    };

    // Auto-mount when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildChatDOM);
    } else {
        buildChatDOM();
    }
})();
