export const DEFAULT_PRIMARY_COLOR = '#1890ff'
const PRIMARY_COLOR_STORAGE_KEY = 'mailplus.primary-color'

function hexToRgb(hex) {
    const normalized = hex.replace('#', '')
    const value = normalized.length === 3
        ? normalized.split('').map(char => char + char).join('')
        : normalized

    if (!/^[0-9a-f]{6}$/i.test(value)) return null

    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    }
}

function mix(color, target, amount) {
    return Math.round(color + (target - color) * amount)
}

function toHex(value) {
    return value.toString(16).padStart(2, '0')
}

function mixColor(rgb, target, amount) {
    return `#${toHex(mix(rgb.r, target, amount))}${toHex(mix(rgb.g, target, amount))}${toHex(mix(rgb.b, target, amount))}`
}

export function applyPrimaryColor(color) {
    const value = typeof color === 'string' && hexToRgb(color) ? color : DEFAULT_PRIMARY_COLOR
    const rgb = hexToRgb(value)
    const root = document.documentElement

    root.style.setProperty('--el-color-primary', value)
    root.style.setProperty('--el-color-primary-dark-2', mixColor(rgb, 0, 0.2))
    root.style.setProperty('--el-color-primary-light-3', mixColor(rgb, 255, 0.3))
    root.style.setProperty('--el-color-primary-light-5', mixColor(rgb, 255, 0.5))
    root.style.setProperty('--el-color-primary-light-7', mixColor(rgb, 255, 0.7))
    root.style.setProperty('--el-color-primary-light-8', mixColor(rgb, 255, 0.8))
    root.style.setProperty('--el-color-primary-light-9', mixColor(rgb, 255, 0.9))
    root.style.setProperty('--loading-primary', value)

    try {
        localStorage.setItem(PRIMARY_COLOR_STORAGE_KEY, value)
    } catch {
        // The active session still receives the theme color when storage is unavailable.
    }

    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute('content', value)

    return value
}
