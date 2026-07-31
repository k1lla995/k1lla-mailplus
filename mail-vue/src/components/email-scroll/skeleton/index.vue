<template>
  <div ref="skeletonRoot" class="skeleton-root">
  <div v-for="item in rows" style="background: var(--el-bg-color)">
    <div :class="'email-row ' + type ">
      <el-checkbox disabled :class=" props.type === 'all-email' ? 'all-email-checkbox' : 'checkbox'"
      ></el-checkbox>
      <div class="pc-star" v-if="showStar">
        <Icon style="color: var(--el-border-color)" icon="solar:star-line-duotone" width="18" height="18"/>
      </div>
      <div v-if="!showStar"></div>
      <div class="title" :class="accountShow ? 'title-column' : 'title-column'">

        <div class="email-sender">
          <div class="email-status" v-if="showStatus">

          </div>
          <div v-else></div>
          <span class="name">
             <span>
               <el-skeleton animated>
                 <template #template>
                   <el-skeleton-item variant="text" class="name-skeleton"/>
                 </template>
               </el-skeleton>
             </span>
             <span></span>
          </span>
          <span class="phone-time">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="text" style="width: 50px;height: 1rem;"/>
              </template>
            </el-skeleton>
          </span>
        </div>
        <div>
          <div class="email-text-skeleton">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="text" class="text-skeleton-one"/>
                <el-skeleton-item variant="text" class="text-skeleton-two"/>
              </template>
            </el-skeleton>
          </div>
          <div class="user-info" v-if="showUserInfo">
            <div class="user">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="text"
                                    style="width: 180px;margin-right: 5px;height: 1rem;margin-bottom: 4px;"/>
                </template>
              </el-skeleton>
            </div>
            <div class="account">
              <el-skeleton animated>
                <template #template>
                  <el-skeleton-item variant="text"
                                    style="width: 180px;margin-right: 5px;height: 1rem;margin-bottom: 4px;"/>
                </template>
              </el-skeleton>
            </div>
            <div class="del-status" v-if="item.isDel">
              <el-tag type="danger" size="small">{{ $t('deleted') }}</el-tag>
            </div>
          </div>
        </div>
      </div>
      <div class="email-right-skeleton" :style="showUserInfo ? 'align-self: start;':''">
        <el-skeleton animated>
          <template #template>
            <el-skeleton-item variant="text" style="width: 60px;margin-right: 15px;height: 1rem;"/>
          </template>
        </el-skeleton>
      </div>
    </div>
  </div>
  </div>
</template>
<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap, reduceMotion } from '@/utils/motion.js'
const props = defineProps({
  rows: {
    type: Number,
    default: 1
  },
  showStar: {
    type: Boolean,
    default: true
  },
  accountShow: {
    type: Boolean,
    default: false
  },
  showStatus: {
    type: Boolean,
    default: false
  },
  showUserInfo: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: ''
  }
})
const skeletonRoot = ref(null)
let shimmer

onMounted(() => {
  if (reduceMotion()) return
  const items = skeletonRoot.value?.querySelectorAll('.el-skeleton__item')
  shimmer = gsap.to(items, { backgroundPosition: '200% 0', duration: 1.25, ease: 'none', repeat: -1, stagger: 0.025 })
})

onUnmounted(() => shimmer?.kill())
import {Icon} from "@iconify/vue";
</script>

<style scoped lang="scss">

.phone-star {
  display: none;
}

.pc-star {
  display: flex;
  width: 40px;
}

:deep(.el-skeleton__item) {
  position: relative;
  top: 2px;
  background: linear-gradient(100deg, var(--el-fill-color-light) 24%, color-mix(in srgb, var(--el-fill-color-light) 62%, #fff) 42%, var(--el-fill-color-light) 60%);
  background-size: 200% 100%;
}

@media (max-width: 1366px) {
  .pc-star {
    display: none;
  }
  .phone-star {
    display: block;
    align-self: end;
    padding-right: 16px;
    padding-top: 8px;
  }
  .star-pd {
    padding-top: 6px !important;
  }
}

</style>
