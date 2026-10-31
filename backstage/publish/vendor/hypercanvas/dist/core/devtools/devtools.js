/**
 * Storyboard Core UI Bar — React-based floating toolbar.
 *
 * Mounts the CoreUIBar React component into the DOM.
 * Contains the command menu and mode-specific buttons (workshop, etc.).
 * Uses dynamic import() for the React component to avoid
 * breaking non-React test environments.
 *
 * Usage:
 *   import { mountDevTools } from '../index.js'
 *   mountDevTools() // call once at app startup
 */
let root = null;
let wrapper = null;
let skipLink = null;
/**
 * Mount the Storyboard Core UI Bar to the DOM.
 * Call once at app startup. Safe to call multiple times (no-ops after first).
 *
 * @param {object} [options]
 * @param {HTMLElement} [options.container=document.body] - Where to mount
 * @param {string} [options.basePath='/'] - Base URL path
 * @param {object} [options.toolbarConfig] - Merged toolbar config
 * @param {Record<string, () => Promise<unknown>>} [options.customHandlers] - Custom tool handlers
 */
export async function mountDevTools(options = {}) {
    const container = options.container || document.body;
    const basePath = options.basePath || '/';
    // Prevent double-mount
    if (wrapper)
        return;
    // Skip mounting entirely when loaded inside a prototype embed iframe
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('_sb_embed'))
        return;
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { default: CoreUIBar } = await import('../ui/CoreUIBar.jsx');
    // Inject skip link as the first child of <body> so it is the
    // first element in the tab order, regardless of where CoreUIBar
    // is mounted. Works in both this repo and client repos.
    const link = document.createElement('a');
    skipLink = link;
    link.href = '#storyboard-controls';
    link.textContent = 'Skip to controls';
    link.setAttribute('data-sb-skip-link', '');
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const firstBtn = document.querySelector('[data-core-ui-bar] [data-slot="button"]');
        if (firstBtn)
            firstBtn.focus();
    });
    // Inline styles so it works without any CSS framework loaded
    Object.assign(link.style, {
        position: 'fixed',
        top: '1rem',
        left: '1rem',
        zIndex: '10000',
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textDecoration: 'none',
    });
    link.addEventListener('focus', () => {
        Object.assign(link.style, {
            clip: 'auto',
            clipPath: 'none',
            width: 'auto',
            height: 'auto',
            overflow: 'visible',
            padding: '0.375rem 0.75rem',
            background: '#fff',
            color: '#111',
            border: '1px solid #ddd',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '0.875rem',
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        });
    });
    link.addEventListener('blur', () => {
        Object.assign(link.style, {
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            padding: '0',
            background: '',
            color: '',
            border: '',
            borderRadius: '',
            boxShadow: '',
            fontSize: '',
            fontFamily: '',
        });
    });
    document.body.insertBefore(link, document.body.firstChild);
    const mountNode = document.createElement('div');
    wrapper = mountNode;
    mountNode.id = 'sb-core-ui';
    container.appendChild(mountNode);
    const reactRoot = createRoot(mountNode);
    root = reactRoot;
    const coreUiBarProps = {
        basePath,
        toolbarConfig: options.toolbarConfig,
        ...(options.customHandlers === undefined ? {} : { customHandlers: options.customHandlers }),
    };
    reactRoot.render(createElement(CoreUIBar, coreUiBarProps));
}
/**
 * Remove the Core UI Bar from the DOM.
 */
export async function unmountDevTools() {
    if (root) {
        root.unmount();
        root = null;
    }
    if (wrapper) {
        wrapper.remove();
        wrapper = null;
    }
    if (skipLink) {
        skipLink.remove();
        skipLink = null;
    }
}
/**
 * @deprecated Use mountDevTools instead.
 */
export function mountFlowDebug(options = {}) {
    return mountDevTools(options);
}
/**
 * @deprecated Use mountDevTools instead.
 */
export function mountSceneDebug(options = {}) {
    return mountDevTools(options);
}
