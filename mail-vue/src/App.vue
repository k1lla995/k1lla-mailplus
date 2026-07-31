<template>
  <el-config-provider :locale="settingStore.lang === 'zh' ? zhCn : null">
    <router-view />
  </el-config-provider>
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { watch } from "vue";
import { onMounted, onUnmounted } from 'vue'
import {useSettingStore} from "@/store/setting.js";
import { gsap, reduceMotion } from '@/utils/motion.js'
const settingStore = useSettingStore()
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import('@/icons/index.js')
const { locale } = useI18n()
locale.value = settingStore.lang
watch(() => settingStore.lang, () => locale.value = settingStore.lang)

let portalObserver
const portalTweens = new Set()

function animatePortal(target) {
  if (!target || target.dataset.motionEntered || reduceMotion()) return
  // Header owns these two poppers so their menu stagger cannot race the global portal tween.
  if (target.matches('.management-menu-popper, .detail-dropdown')) return
  target.dataset.motionEntered = 'true'
  const isDialog = target.matches('.el-dialog, .el-message-box')
  const tween = gsap.fromTo(target,
    { autoAlpha: 0, y: isDialog ? 8 : -7, scale: isDialog ? 0.94 : 0.985 },
    {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: isDialog ? 0.24 : 0.18,
      ease: 'power2.out',
      clearProps: 'transform,visibility',
      onComplete: () => portalTweens.delete(tween)
    }
  )
  portalTweens.add(tween)
}

onMounted(() => {
  portalObserver = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return
      if (node.matches('.el-dialog, .el-message-box, .el-notification, .el-message, .el-popper')) animatePortal(node)
      node.querySelectorAll?.('.el-dialog, .el-message-box, .el-notification, .el-message, .el-popper').forEach(animatePortal)
    }))
  })
  portalObserver.observe(document.body, { childList: true, subtree: true })
})

onUnmounted(() => {
  portalObserver?.disconnect()
  portalTweens.forEach(tween => tween.kill())
  portalTweens.clear()
})
</script>
