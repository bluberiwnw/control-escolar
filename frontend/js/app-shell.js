/**
 * Sidebar móvil y cierre al pulsar overlay
 */
(function initAppShell() {
    function bindSidebar() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!toggle || !sidebar) return;

        function setOpen(open) {
            sidebar.classList.toggle('sidebar--open', open);
            document.body.classList.toggle('sidebar-open', open);
            if (overlay) {
                overlay.hidden = !open;
                overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
            }
        }

        toggle.addEventListener('click', () => {
            setOpen(!sidebar.classList.contains('sidebar--open'));
        });
        overlay?.addEventListener('click', () => setOpen(false));
    }

    function markActiveNavLink() {
        const path = window.location.pathname || '';
        const file = path.split('/').pop() || '';
        document.querySelectorAll('.sidebar-menu a[href]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            if (href && (file === href || path.endsWith('/' + href))) {
                a.classList.add('active');
            }
        });
    }

    function boot() {
        bindSidebar();
        markActiveNavLink();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
