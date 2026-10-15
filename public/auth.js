// QUANTUM NET — Client Authentication & Telemetry Helper
const Auth = {
    get token() { return localStorage.getItem('agent_token'); },
    get email() { return localStorage.getItem('agent_email'); },
    get role()  { return (localStorage.getItem('agent_role') || '').toUpperCase(); },
    get name()  { return localStorage.getItem('agent_name') || ''; },
    get id()    { return localStorage.getItem('agent_id'); },

    save(d) {
        if (d.token) localStorage.setItem('agent_token', d.token);
        const user = d.user || d;
        if (user.email) localStorage.setItem('agent_email', user.email);
        if (user.role) localStorage.setItem('agent_role', user.role.toUpperCase());
        if (user.name) localStorage.setItem('agent_name', user.name);
        if (user.id) localStorage.setItem('agent_id', user.id);
    },

    require(role) {
        if (!this.token) {
            location.replace('/login.html');
            return false;
        }
        if (role === 'admin' && this.role !== 'ADMIN') {
            location.replace('/events.html');
            return false;
        }
        return true;
    },

    logout() {
        ['agent_token', 'agent_email', 'agent_role', 'agent_name', 'agent_id'].forEach(k => localStorage.removeItem(k));
        location.replace('/login.html');
    }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Authenticated fetch wrapper
async function api(url, opts = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(Auth.token ? { 'Authorization': 'Bearer ' + Auth.token } : {}),
        ...(opts.headers || {})
    };

    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401 && Auth.token) {
        console.warn('Session expired or unauthorized. Logging out.');
        Auth.logout();
    }
    return res;
}

// Navigation state updater for public pages
document.addEventListener('DOMContentLoaded', () => {
    const authLinks = document.querySelectorAll('nav a[href="/login.html"]');
    authLinks.forEach(link => {
        if (Auth.token) {
            const isAdmin = Auth.role === 'ADMIN';
            link.href = isAdmin ? '/admin.html' : '/dashboard.html';
            link.textContent = isAdmin ? 'Admin HUD' : 'Dashboard';

            const out = document.createElement('button');
            out.textContent = 'Sign Out';
            out.className = 'text-red-400 hover:text-red-300 ml-4 font-bold text-xs uppercase cursor-pointer';
            out.onclick = () => Auth.logout();
            link.after(out);
        } else {
            const up = link.cloneNode(true);
            up.href = '/register.html';
            up.textContent = 'Sign Up';
            up.className = 'text-slate-400 hover:text-cyan-300 ml-4';
            link.after(up);
        }
    });
});
