(() => {
    const api = window.api;
    const bar = document.getElementById('app-window-bar');
    if (!api || !bar) return;

    if (api.customWindowFrame) {
        document.body.classList.add('windows-custom-frame');
        bar.hidden = false;
    }

    const setMaximized = ({ maximized } = {}) => {
        document.querySelectorAll('[data-window-action="toggle-maximize"]').forEach(button => {
            const label = maximized ? 'Restaurar janela' : 'Maximizar janela';
            button.setAttribute('aria-label', label);
            button.title = label;
        });
    };

    document.querySelectorAll('[data-window-action]').forEach(button => {
        button.addEventListener('click', async () => {
            try { setMaximized(await api.windowAction(button.dataset.windowAction)); }
            catch (error) { console.error('Falha no controle da janela:', error); }
        });
    });
    bar.addEventListener('dblclick', event => {
        if (event.target.closest('button')) return;
        api.windowAction('toggle-maximize').then(setMaximized).catch(console.error);
    });
    api.onWindowState(setMaximized);
    api.windowAction('state').then(setMaximized).catch(console.error);
})();
