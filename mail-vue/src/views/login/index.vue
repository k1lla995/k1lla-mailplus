<template>
  <div id="login-box">
    <div class="login-background" :style="background"></div>
    <div class="mail-motion" aria-hidden="true">
      <div class="mail-route route-one"></div>
      <div class="mail-route route-two"></div>
      <div class="mail-route route-three"></div>
      <div class="mail-arc arc-one"></div>
      <div class="mail-arc arc-two"></div>
      <div class="mail-hub">
        <Icon icon="mingcute:mail-send-line" width="42" height="42"/>
      </div>
      <div class="mail-packet packet-one"><Icon icon="mingcute:mail-line" width="20" height="20"/></div>
      <div class="mail-packet packet-two"><Icon icon="mingcute:mail-line" width="18" height="18"/></div>
      <div class="mail-packet packet-three"><Icon icon="mingcute:mail-line" width="20" height="20"/></div>
      <div class="mail-packet packet-four"><Icon icon="mingcute:mail-line" width="18" height="18"/></div>
      <span class="mail-signal signal-one"></span>
      <span class="mail-signal signal-two"></span>
      <span class="mail-signal signal-three"></span>
      <span class="mail-signal signal-four"></span>
    </div>
    <div class="form-wrapper">
      <div class="container">
        <span class="form-title">{{ settingStore.settings.title }}</span>
        <span class="form-desc">{{ show === 'login' ? $t('loginTitle') : $t('regTitle') }}</span>
        <div v-show="show === 'login'">
          <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="form.email"
                    type="text" :placeholder="$t('emailAccount')" autocomplete="off">
            <template #append v-if="!hideLoginDomain">
              <div @click.stop="openSelect">
                <el-select
                    ref="mySelect"
                    v-model="suffix"
                    :placeholder="$t('select')"
                    class="select"
                >
                  <el-option
                      v-for="item in domainList"
                      :key="item"
                      :label="item"
                      :value="item"
                  />
                </el-select>
                <div style="color: var(--el-text-color-primary)">
                  <span>{{ suffix }}</span>
                  <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
                </div>
              </div>
            </template>
          </el-input>
          <el-input v-model="form.password" :placeholder="$t('password')" type="password" autocomplete="off">
          </el-input>
          <div v-show="loginVerifyShow"
               class="login-turnstile"
               :data-sitekey="settingStore.settings.siteKey"
               data-callback="onLoginTurnstileSuccess"
               data-error-callback="onLoginTurnstileError"
          >
            <span style="font-size: 12px;color: #F56C6C" v-if="loginBotJsError">{{ $t('verifyModuleFailed') }}</span>
          </div>
          <el-button class="btn" type="primary" @click="submit" :loading="loginLoading"
          >{{ $t('loginBtn') }}
          </el-button>
        </div>
        <div v-show="show === 'register'">
          <el-input :class="!hideLoginDomain ? 'email-input' : ''" v-model="registerForm.email"
                    type="text" :placeholder="$t('emailAccount')" autocomplete="off">
            <template #append v-if="!hideLoginDomain">
              <div @click.stop="openSelect">
                <el-select ref="mySelect" v-model="suffix" :placeholder="$t('select')" class="select">
                  <el-option v-for="item in domainList" :key="item" :label="item" :value="item"/>
                </el-select>
                <div style="color: var(--el-text-color-primary)">
                  <span>{{ suffix }}</span>
                  <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
                </div>
              </div>
            </template>
          </el-input>
          <el-input v-model="registerForm.password" :placeholder="$t('password')" type="password" autocomplete="off"/>
          <el-input v-model="registerForm.confirmPassword" :placeholder="$t('confirmPwd')" type="password" autocomplete="off"/>
          <el-input v-if="settingStore.settings.regKey === 0" v-model="registerForm.code" :placeholder="$t('regKey')" type="text" autocomplete="off"/>
          <el-input v-else-if="settingStore.settings.regKey === 2" v-model="registerForm.code" :placeholder="$t('regKeyOptional')" type="text" autocomplete="off"/>
          <div v-show="registerVerifyShow" class="register-turnstile" :data-sitekey="settingStore.settings.siteKey"
               data-callback="onRegisterTurnstileSuccess" data-error-callback="onRegisterTurnstileError">
            <span style="font-size: 12px;color: #F56C6C" v-if="registerBotJsError">{{ $t('verifyModuleFailed') }}</span>
          </div>
          <el-button class="btn" type="primary" @click="submitRegister" :loading="registerLoading">{{ $t('regBtn') }}</el-button>
        </div>
        <div v-if="settingStore.settings.register === 0" class="switch" @click="toggleForm">
          {{ show === 'login' ? $t('noAccount') : $t('hasAccount') }}
          <span>{{ show === 'login' ? $t('regSwitch') : $t('loginSwitch') }}</span>
        </div>
      </div>
    </div>
    <a v-show="settingStore.settings.projectLink" class="github" href="https://github.com/k1lla995/k1lla-mailplus">
      <Icon icon="mingcute:github-line" color="#1890ff" width="20" height="20" />
    </a>
  </div>
</template>

<script setup>
import router from "@/router";
import {computed, nextTick, reactive, ref} from "vue";
import {login, register} from "@/request/login.js";
import {websiteConfig} from "@/request/setting.js";
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useUserStore} from "@/store/user.js";
import {useUiStore} from "@/store/ui.js";
import {Icon} from "@iconify/vue";
import {cvtR2Url} from "@/utils/convert.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import {useI18n} from "vue-i18n";

const {t} = useI18n();
const accountStore = useAccountStore();
const userStore = useUserStore();
const uiStore = useUiStore();
const settingStore = useSettingStore();
const loginLoading = ref(false)
const registerLoading = ref(false)
const show = ref('login')

const form = reactive({
  email: '',
  password: '',

});
const registerForm = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  code: ''
})
const mySelect = ref()
const suffix = ref('')
const domainList = settingStore.domainList;
suffix.value = domainList[0]
const loginVerifyShow = ref(false)
let loginVerifyToken = ''
let loginTurnstileId = null
const loginBotJsError = ref(false)
let loginVerifyErrorCount = 0
const registerVerifyShow = ref(false)
let registerVerifyToken = ''
let registerTurnstileId = null
const registerBotJsError = ref(false)
let registerVerifyErrorCount = 0

window.onLoginTurnstileSuccess = (token) => {
  loginVerifyToken = token;
};

window.onLoginTurnstileError = () => {
  if (loginVerifyErrorCount >= 4) {
    return
  }
  loginVerifyErrorCount++
  setTimeout(() => {
    renderLoginTurnstile(true)
  }, 1500)
};

window.onRegisterTurnstileSuccess = (token) => {
  registerVerifyToken = token
}

window.onRegisterTurnstileError = () => {
  if (registerVerifyErrorCount >= 4) return
  registerVerifyErrorCount++
  setTimeout(() => renderRegisterTurnstile(true), 1500)
}

window.loadAfter = (e) => {
  console.log('loadAfter')
}

window.loadBefore = (e) => {
  console.log('loadBefore')
}

const loginOpacity = computed(() => {
  const opacity = settingStore.settings.loginOpacity
  return uiStore.dark ? `rgba(0, 0, 0, ${opacity})` : `rgba(255, 255, 255, ${opacity})`
})

const hideLoginDomain = computed(() => settingStore.settings.loginDomain === 1)
const requiresLoginVerification = computed(() => {
  return settingStore.settings.loginVerify === 0 ||
      (settingStore.settings.loginVerify === 2 && settingStore.settings.loginVerifyOpen)
})

const requiresRegisterVerification = computed(() => {
  return settingStore.settings.registerVerify === 0 ||
      (settingStore.settings.registerVerify === 2 && settingStore.settings.regVerifyOpen)
})

const background = computed(() => {

  return settingStore.settings.background ? {
    'background-image': `url(${cvtR2Url(settingStore.settings.background)})`,
    'background-repeat': 'no-repeat',
    'background-size': 'cover',
    'background-position': 'center'
  } : ''
})

const openSelect = () => {
  mySelect.value.toggleMenu()
}

const getFullEmail = (email) => {
  return hideLoginDomain.value ? email : email + suffix.value
}

function toggleForm() {
  show.value = show.value === 'login' ? 'register' : 'login'
  registerVerifyShow.value = false
}

function renderLoginTurnstile(reset = false) {
  loginVerifyShow.value = true
  nextTick(() => {
    try {
      if (!loginTurnstileId) {
        loginTurnstileId = window.turnstile.render('.login-turnstile')
      } else if (reset) {
        window.turnstile.reset(loginTurnstileId)
      }
    } catch (e) {
      loginBotJsError.value = true
    }
  })
}

function renderRegisterTurnstile(reset = false) {
  registerVerifyShow.value = true
  nextTick(() => {
    try {
      if (!registerTurnstileId) {
        registerTurnstileId = window.turnstile.render('.register-turnstile')
      } else if (reset) {
        window.turnstile.reset(registerTurnstileId)
      }
    } catch (e) {
      registerBotJsError.value = true
    }
  })
}

const submit = () => {

  if (!form.email) {
    ElMessage({
      message: t('emptyEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  let email = getFullEmail(form.email);

  if (!isEmail(email)) {
    ElMessage({
      message: t('notEmailMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!form.password) {
    ElMessage({
      message: t('emptyPwdMsg'),
      type: 'error',
      plain: true,
    })
    return
  }

  if (!loginVerifyToken && requiresLoginVerification.value) {
    renderLoginTurnstile()
    if (!loginBotJsError.value) {
      ElMessage({
        message: t('botVerifyMsg'),
        type: 'error',
        plain: true
      })
    }
    return
  }

  loginLoading.value = true
  login(email, form.password, loginVerifyToken).then(async data => {
    await saveToken(data.token)
  }).catch(res => {
    if (requiresLoginVerification.value || res.code === 400) {
      loginVerifyToken = ''
      if (res.code === 400) {
        settingStore.settings.loginVerifyOpen = true
      }
      renderLoginTurnstile(true)
    }
    if (res.code === 501 && settingStore.settings.loginVerify === 2) {
      refreshWebsiteConfig().then(() => {
        if (requiresLoginVerification.value) {
          renderLoginTurnstile()
        }
      })
    }
  }).finally(() => {
    loginLoading.value = false
  })
}

async function saveToken(token) {
  localStorage.setItem('token', token)
  refreshWebsiteConfig()
  const user = await loginUserInfo();
  accountStore.currentAccountId = user.account.accountId;
  accountStore.currentAccount = user.account;
  userStore.user = user;
  const routers = permsToRouter(user.permKeys);
  routers.forEach(routerData => {
    router.addRoute('layout', routerData);
  });
  await router.replace({name: 'layout'})
  uiStore.showNotice()
}

function submitRegister() {
  if (!registerForm.email) {
    ElMessage({message: t('emptyEmailMsg'), type: 'error', plain: true})
    return
  }

  const email = getFullEmail(registerForm.email)
  if (!isEmail(email)) {
    ElMessage({message: t('notEmailMsg'), type: 'error', plain: true})
    return
  }
  if (!registerForm.password) {
    ElMessage({message: t('emptyPwdMsg'), type: 'error', plain: true})
    return
  }
  if (registerForm.password.length < 6) {
    ElMessage({message: t('pwdLengthMsg'), type: 'error', plain: true})
    return
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage({message: t('confirmPwdFailMsg'), type: 'error', plain: true})
    return
  }
  if (settingStore.settings.regKey === 0 && !registerForm.code) {
    ElMessage({message: t('emptyRegKeyMsg'), type: 'error', plain: true})
    return
  }
  if (!registerVerifyToken && requiresRegisterVerification.value) {
    renderRegisterTurnstile()
    if (!registerBotJsError.value) {
      ElMessage({message: t('botVerifyMsg'), type: 'error', plain: true})
    }
    return
  }

  registerLoading.value = true
  register({email, password: registerForm.password, token: registerVerifyToken, code: registerForm.code})
      .then(({regVerifyOpen}) => {
        show.value = 'login'
        registerForm.email = ''
        registerForm.password = ''
        registerForm.confirmPassword = ''
        registerForm.code = ''
        registerVerifyToken = ''
        registerVerifyShow.value = false
        settingStore.settings.regVerifyOpen = regVerifyOpen
        ElMessage({message: t('regSuccessMsg'), type: 'success', plain: true})
      })
      .catch((res) => {
        if (res.code === 400) {
          registerVerifyToken = ''
          settingStore.settings.regVerifyOpen = true
          renderRegisterTurnstile(true)
        }
      })
      .finally(() => {
        registerLoading.value = false
      })
}

function refreshWebsiteConfig() {
  return websiteConfig().then(setting => {
    settingStore.settings = setting
    settingStore.domainList = setting.domainList
    if (!suffix.value && setting.domainList.length > 0) {
      suffix.value = setting.domainList[0]
    }
    document.title = setting.title
  }).catch(e => {
    console.error(e)
  })
}
</script>


<style>
.el-select-dropdown__item {
  padding: 0 15px;
}

.no-autofill-pwd {
  .el-input__inner {
    -webkit-text-security: disc !important;
  }
}
</style>

<style lang="scss" scoped>

.form-wrapper {
  position: fixed;
  inset: 0;
  height: 100%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  @media (max-width: 767px), (max-height: 540px) and (pointer: coarse) {
    position: relative;
    width: 100%;
    min-height: 100dvh;
    height: auto;
    padding: max(16px, env(safe-area-inset-top)) 0 max(24px, env(safe-area-inset-bottom));
    align-items: center;
  }
}

.container {
  background: v-bind(loginOpacity);
  padding: 42px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(450px, calc(100% - 40px));
  min-height: 430px;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--ds-radius-md);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
  @media (max-width: 1024px) {
    width: min(420px, calc(100% - 40px));
  }
  @media (max-width: 767px), (max-height: 540px) and (pointer: coarse) {
    padding: 20px 18px;
    min-height: 0;
    width: calc(100% - 36px);

    .btn {
      height: 44px;
    }

    .el-input {
      height: 44px;
      margin-bottom: 14px;

      :deep(.el-input__inner) {
        height: 42px;
        font-size: 16px;
      }
    }
  }

  .btn {
    height: 36px;
    width: 100%;
    border-radius: var(--ds-radius-md);
  }

  .form-desc {
    margin-top: 5px;
    margin-bottom: 18px;
    color: var(--form-desc-color);
  }

  .form-title {
    font-weight: bold;
    font-size: 22px !important;
  }

  .switch {
    margin-top: 20px;
    text-align: center;

    span {
      color: var(--login-switch-color);
      cursor: pointer;
    }
  }

  :deep(.el-input__wrapper) {
    border-radius: var(--ds-radius-md);
    background: var(--el-bg-color);
  }

  .email-input :deep(.el-input__wrapper) {
    border-radius: var(--ds-radius-md) 0 0 var(--ds-radius-md);
    background: var(--el-bg-color);
  }

  .el-input {
    height: 38px;
    width: 100%;
    margin-bottom: 18px;

    :deep(.el-input__inner) {
      height: 36px;
    }
  }
}

:deep(.el-select-dropdown__item) {
  padding: 0 10px;
}

.setting-icon {
  position: relative;
  top: 6px;
}

.github {
  position: fixed;
  width: 35px;
  height: 35px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  background: var(--el-bg-color);
  bottom: 10px;
  right: 10px;
  z-index: 1000;
  border: 1px solid var(--el-border-color-light);
  box-shadow: var(--el-box-shadow-light);
  cursor: pointer;

  @media (max-width: 767px), (max-height: 540px) and (pointer: coarse) {
    width: 44px;
    height: 44px;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
  }
}

:deep(.el-input-group__append) {
  padding: 0 !important;
  padding-left: 8px !important;
  padding-right: 4px !important;
  background: var(--el-bg-color);
  border-radius: 0 8px 8px 0;
}

:deep(.el-button+.el-button) {
  margin: 0;
}


.login-turnstile {
  margin-bottom: 18px;
}

.register-turnstile {
  margin-bottom: 18px;
}

.select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

.custom-style {
  margin-bottom: 10px;
}

.custom-style .el-segmented {
  --el-border-radius-base: 6px;
  width: 180px;
}


#login-box {
  background: var(--el-bg-color-page, #f4f7fb);
  font: inherit;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  display: grid;
  grid-template-columns: 1fr;
  position: relative;

  @media (max-width: 767px), (max-height: 540px) and (pointer: coarse) {
    display: block;
    min-height: 100dvh;
    height: auto;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
}

.mail-motion {
  position: fixed;
  inset: 50% auto auto 50%;
  width: min(920px, 82vw);
  aspect-ratio: 1.7;
  z-index: 1;
  pointer-events: none;
  transform: translate(-50%, -50%);
  opacity: 0.82;
}

.mail-route {
  position: absolute;
  border: 2px solid color-mix(in srgb, var(--route-color) 72%, transparent);
  border-radius: 50%;
  will-change: transform, opacity;
  animation: route-drift var(--route-duration) ease-in-out infinite alternate;
}

.route-one {
  --route-color: #2f8cff;
  --route-duration: 9s;
  width: 76%;
  height: 62%;
  top: 18%;
  left: 12%;
  --route-rotation: -14deg;
}

.route-two {
  --route-color: #20b991;
  --route-duration: 11s;
  width: 58%;
  height: 80%;
  top: 8%;
  left: 21%;
  --route-rotation: 32deg;
}

.route-three {
  --route-color: #f3a629;
  --route-duration: 10s;
  width: 90%;
  height: 42%;
  top: 28%;
  left: 5%;
  --route-rotation: 11deg;
}

.mail-arc {
  position: absolute;
  border: 2px solid transparent;
  border-radius: 50%;
  will-change: transform, opacity;
}

.arc-one {
  width: 54%;
  height: 96%;
  top: 1%;
  left: 23%;
  border-top-color: rgba(229, 82, 132, 0.76);
  border-right-color: rgba(229, 82, 132, 0.44);
  transform: rotate(-26deg);
  animation: arc-sway-one 12s ease-in-out infinite alternate;
}

.arc-two {
  width: 88%;
  height: 52%;
  top: 23%;
  left: 6%;
  border-bottom-color: rgba(99, 106, 238, 0.78);
  border-left-color: rgba(99, 106, 238, 0.42);
  transform: rotate(22deg);
  animation: arc-sway-two 14s ease-in-out -3s infinite alternate;
}

.mail-hub,
.mail-packet {
  position: absolute;
  display: grid;
  place-items: center;
  color: var(--el-color-primary);
  will-change: transform, opacity;
}

.mail-hub {
  top: 50%;
  left: 50%;
  width: 80px;
  height: 64px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 48%, transparent);
  border-radius: var(--ds-radius-md);
  background: color-mix(in srgb, var(--el-bg-color) 76%, transparent);
  box-shadow: 0 10px 28px color-mix(in srgb, var(--el-color-primary) 14%, transparent);
  transform: translate(-50%, -50%);
  animation: hub-pulse 6s ease-in-out infinite;
}

.mail-packet {
  width: 36px;
  height: 28px;
  border: 1px solid currentColor;
  border-radius: 5px;
  background: color-mix(in srgb, var(--el-bg-color) 82%, transparent);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
}

.packet-one {
  top: 28%;
  left: 16%;
  animation: packet-one 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.packet-two {
  top: 71%;
  left: 31%;
  color: #2dbf8d;
  animation: packet-two 10s cubic-bezier(0.4, 0, 0.2, 1) -2.5s infinite;
}

.packet-three {
  top: 16%;
  left: 64%;
  color: #f0a93a;
  animation: packet-three 9s cubic-bezier(0.4, 0, 0.2, 1) -4s infinite;
}

.packet-four {
  top: 66%;
  left: 73%;
  color: var(--el-color-primary);
  animation: packet-four 11s cubic-bezier(0.4, 0, 0.2, 1) -6s infinite;
}

.mail-signal {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--signal-color);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--signal-color) 17%, transparent);
  will-change: transform, opacity;
  animation: signal-pulse 3.8s ease-in-out var(--signal-delay) infinite;
}

.signal-one {
  --signal-color: #2f8cff;
  --signal-delay: -1.2s;
  top: 18%;
  left: 23%;
}

.signal-two {
  --signal-color: #20b991;
  --signal-delay: -2.1s;
  top: 73%;
  left: 19%;
}

.signal-three {
  --signal-color: #f3a629;
  --signal-delay: -0.4s;
  top: 19%;
  left: 76%;
}

.signal-four {
  --signal-color: #e55284;
  --signal-delay: -2.8s;
  top: 74%;
  left: 79%;
}

@keyframes hub-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.04); }
}

@keyframes route-drift {
  from { transform: rotate(var(--route-rotation)) scale(0.98); opacity: 0.62; }
  to { transform: rotate(var(--route-rotation)) scale(1.02); opacity: 1; }
}

@keyframes arc-sway-one {
  from { transform: rotate(-30deg) scale(0.98); opacity: 0.5; }
  to { transform: rotate(-20deg) scale(1.03); opacity: 1; }
}

@keyframes arc-sway-two {
  from { transform: rotate(18deg) scale(0.98); opacity: 0.45; }
  to { transform: rotate(27deg) scale(1.02); opacity: 1; }
}

@keyframes signal-pulse {
  0%, 100% { transform: scale(0.82); opacity: 0.5; }
  45% { transform: scale(1.18); opacity: 1; }
}

@keyframes packet-one {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-8deg); opacity: 0.35; }
  50% { transform: translate3d(360px, 86px, 0) rotate(8deg); opacity: 1; }
}

@keyframes packet-two {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(8deg); opacity: 0.3; }
  50% { transform: translate3d(218px, -214px, 0) rotate(-10deg); opacity: 1; }
}

@keyframes packet-three {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(10deg); opacity: 0.35; }
  50% { transform: translate3d(-246px, 190px, 0) rotate(-8deg); opacity: 1; }
}

@keyframes packet-four {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-6deg); opacity: 0.3; }
  50% { transform: translate3d(-320px, -134px, 0) rotate(9deg); opacity: 1; }
}

.login-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--el-bg-color-page, #f4f7fb);
}

@media (max-width: 767px), (max-height: 540px) and (pointer: coarse) {
  .mail-motion {
    position: absolute;
    inset: 50% auto auto 50%;
    width: min(620px, 154vw);
    opacity: 0.48;
    transform: translate(-50%, -50%) scale(0.82);
    transform-origin: center;
  }

  .mail-hub {
    width: 62px;
    height: 50px;
  }

  .mail-hub :deep(svg) {
    width: 32px;
    height: 32px;
  }

  .mail-packet {
    width: 30px;
    height: 24px;
  }

  .packet-one {
    top: 12%;
    left: 11%;
  }

  .packet-two {
    top: 79%;
    left: 12%;
  }

  .packet-three,
  .packet-four {
    display: none;
  }

  .mail-signal {
    width: 8px;
    height: 8px;
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--signal-color) 17%, transparent);
  }

  .signal-one {
    top: 9%;
    left: 27%;
  }

  .signal-two {
    top: 86%;
    left: 24%;
  }

  .signal-three {
    top: 12%;
    left: 72%;
  }

  .signal-four {
    top: 84%;
    left: 75%;
  }

  .packet-one {
    animation-name: mobile-packet-one;
  }

  .packet-two {
    animation-name: mobile-packet-two;
  }
}

@keyframes mobile-packet-one {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-8deg); opacity: 0.3; }
  50% { transform: translate3d(192px, 58px, 0) rotate(8deg); opacity: 1; }
}

@keyframes mobile-packet-two {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(8deg); opacity: 0.3; }
  50% { transform: translate3d(180px, -120px, 0) rotate(-10deg); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .mail-hub,
  .mail-packet,
  .mail-route,
  .mail-arc,
  .mail-signal {
    animation: none;
  }
}

</style>
