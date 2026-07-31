<template>
  <div ref="mainRoot" :class="accountShow && hasPerm('account:query') ? 'main-box-show' : 'main-box-hide'">
    <div :class="accountShow && hasPerm('account:query') ? 'block-show' : 'block-hide'" @click="uiStore.accountShow = false"></div>
    <account  :class="accountShow && hasPerm('account:query') ? 'show' : 'hide'" />
    <main class="main-view">
      <router-view v-slot="{ Component,route }">
        <Transition mode="out-in" :css="false" @enter="enterRoute" @leave="leaveRoute">
          <keep-alive :include="['email','all-email','send','sys-setting','star','user','role','analysis','reg-key','draft','contact','recycle']">
            <component :is="Component" :key="route.name"/>
          </keep-alive>
        </Transition>
      </router-view>
    </main>
  </div>
</template>
<script setup>
import account from '@/layout/account/index.vue'
import {useUiStore} from "@/store/ui.js";
import {useSettingStore} from "@/store/setting.js";
import {computed, onBeforeUnmount, onMounted, ref, watch} from "vue";
import { useRoute } from 'vue-router'
import { hasPerm } from "@/perm/perm.js"
import { gsap, motionDuration, reduceMotion } from '@/utils/motion.js'

const settingStore = useSettingStore()
const uiStore = useUiStore();
const route = useRoute()
const mainRoot = ref(null)
let  innerWidth =  window.innerWidth

let elNotification = null

const accountShow = computed(() => {
  return uiStore.accountShow && settingStore.settings.manyEmail === 0
})

function enterRoute(element, done) {
  if (reduceMotion()) return done()
  gsap.fromTo(element, { autoAlpha: 0, y: 14 }, {
    autoAlpha: 1,
    y: 0,
    duration: motionDuration(0.52),
    ease: 'power2.out',
    clearProps: 'transform,visibility',
    onComplete: done
  })
}

function leaveRoute(element, done) {
  if (reduceMotion()) return done()
  gsap.to(element, {
    autoAlpha: 0,
    y: -7,
    duration: motionDuration(0.18),
    ease: 'power2.in',
    onComplete: done
  })
}

watch(() => uiStore.changeNotice, () => {

  const settings = settingStore.settings

  let data = {
    notice: settings.notice,
    noticeWidth: settings.noticeWidth,
    noticeTitle: settings.noticeTitle,
    noticeContent: settings.noticeContent,
    noticeType: settings.noticeType,
    noticeDuration: settings.noticeDuration,
    noticePosition: settings.noticePosition,
    noticeOffset: settings.noticeOffset
  }

  showNotice(data)
})

watch(() => uiStore.changePreview, () => {
  showNotice(uiStore.previewData)
})

function showNotice(data) {

  if (data.notice === 1) {
    return;
  }

  if (elNotification) {
    elNotification.close()
  }

  const style = document.createElement('style');
  style.innerHTML = `
  .custom-notice.el-notification {
    --el-notification-width: min(${data.noticeWidth}px,calc(100% - 30px)) !important;
  }
  `;

  document.head.appendChild(style);

  elNotification = ElNotification({
    title: data.noticeTitle,
    message: `<div style="width: 100%;height: 100%;">${data.noticeContent}</div>`,
    type: data.noticeType === 'none' ? '' : data.noticeType,
    duration: data.noticeDuration,
    position: data.noticePosition,
    offset: data.noticeOffset,
    dangerouslyUseHTMLString: true,
    customClass: 'custom-notice'
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
  if (!reduceMotion()) {
    gsap.from(mainRoot.value, { autoAlpha: 0, y: 16, duration: 0.62, ease: 'power2.out', clearProps: 'transform,visibility' })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  if (['content','email','send'].includes(route.meta.name)) {
    if (innerWidth !==  window.innerWidth) {
      innerWidth = window.innerWidth;
      uiStore.accountShow = window.innerWidth >= 767;
    }
  }
}

</script>
<style lang="scss" scoped>

.block-show {
  position: fixed;
  @media (max-width: 767px) {
    position: absolute;
    right: 0;
    border: 0;
    height: 100%;
    width: 100%;
    background: #000000;
    opacity: 0.6;
    z-index: 10;
    transition: opacity var(--ds-duration-slow) var(--ds-ease-standard);
  }
}

.block-hide {
  position: fixed;
  pointer-events: none;
  transition: opacity var(--ds-duration-slow) var(--ds-ease-standard);
}

.show {
  transition: transform var(--ds-duration-fast) var(--ds-ease-standard), opacity var(--ds-duration-fast) var(--ds-ease-standard);
  @media (max-width: 767px) {
    position: fixed;
    z-index: 100;
    width: 260px;
  }
}

.hide {
  transition: transform var(--ds-duration-fast) var(--ds-ease-standard), opacity var(--ds-duration-fast) var(--ds-ease-standard);
  position: fixed;
  transform: translateX(-100%);
  opacity: 0;
  @media (max-width: 1024px) {
    width: 260px;
    z-index: 100;
  }
}


.main-box-show {
  display: grid;
  grid-template-columns: 260px  1fr;
  height: calc(100% - 60px);
  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
}

.main-box-hide {
  display: grid;
  grid-template-columns: 1fr;
  height: calc(100% - 60px);
}


.main-view {
  background: var(--el-bg-color);
}


.navigation {
  height: 30px;
  border-bottom: solid 1px var(--el-menu-border-color);
  display: inline-flex;
  justify-items: center;
  align-items: center;
  width: 100%;
  .tag {
    background: var(--el-bg-color);
    margin-left: 5px;
  }
}
</style>
