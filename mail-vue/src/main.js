import {createApp} from 'vue';
import App from './App.vue';
import router from './router';
import './style.css';
import { init } from '@/init/init.js';
import { createPinia } from 'pinia';
import piniaPersistedState from 'pinia-plugin-persistedstate';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import perm from "@/perm/perm.js";
import {useUiStore} from "@/store/ui.js";
import {initializeThemePreference, watchSystemTheme} from "@/utils/theme-preference.js";
const pinia = createPinia().use(piniaPersistedState)
import i18n from "@/i18n/index.js";
const app = createApp(App).use(pinia)
const uiStore = useUiStore(pinia)
initializeThemePreference(uiStore)
watchSystemTheme(uiStore)
try {
    await init()
} catch (error) {
    // Do not leave the pre-mount loader on screen if an unrelated initialization step fails.
    console.error(error)
}
app.use(router).use(i18n).directive('perm',perm)
app.config.devtools = true;

app.mount('#app');
