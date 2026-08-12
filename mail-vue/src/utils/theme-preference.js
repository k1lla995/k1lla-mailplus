const THEME_MODES = new Set(['light', 'dark', 'system'])

function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredThemeMode() {
    try {
        const saved = JSON.parse(localStorage.getItem('ui'))
        return THEME_MODES.has(saved?.themeMode) ? saved.themeMode : null
    } catch {
        return null
    }
}

export function applyTheme(isDark) {
    document.documentElement.classList.toggle('dark', isDark)
    const metaTag = document.getElementById('theme-color-meta')
    const isMobile = !window.matchMedia('(pointer: fine) and (hover: hover)').matches
    metaTag?.setAttribute('content', isDark ? (isMobile ? '#141414' : '#000000') : (isMobile ? '#FFFFFF' : '#F1F1F1'))
}

export function resolveTheme(mode) {
    return (mode === 'system' ? getSystemTheme() : mode) === 'dark'
}

export function initializeThemePreference(uiStore) {
    const savedMode = getStoredThemeMode()
    const mode = savedMode || uiStore.themeMode || (uiStore.dark ? 'dark' : 'light')
    uiStore.themeMode = THEME_MODES.has(mode) ? mode : 'system'
    uiStore.dark = resolveTheme(uiStore.themeMode)
    applyTheme(uiStore.dark)
}

export function setThemePreference(uiStore, mode) {
    if (!THEME_MODES.has(mode)) return
    uiStore.themeMode = mode
    uiStore.dark = resolveTheme(mode)
    applyTheme(uiStore.dark)
}

export function watchSystemTheme(uiStore) {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
        if (uiStore.themeMode !== 'system') return
        uiStore.dark = media.matches
        applyTheme(uiStore.dark)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}
