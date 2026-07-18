<template>
  <div class="recycle-page">
    <div class="recycle-toolbar">
      <label class="recycle-search">
        <Icon icon="iconoir:search" width="19" height="19" aria-hidden="true" />
        <input v-model="query" type="text" autocomplete="off" :placeholder="$t('searchRecycle')" :aria-label="$t('searchRecycle')" />
        <button v-if="query" type="button" :aria-label="$t('clear')" @click="query = ''"><Icon icon="mingcute:close-circle-fill" width="17" height="17" /></button>
      </label>
      <div class="recycle-filters" :aria-label="$t('recycleReasonFilter')">
        <button
          v-for="filter in recycleFilters"
          :key="filter.value || 'all'"
          type="button"
          class="recycle-filter"
          :class="[{ active: recycleReason === filter.value }, filter.value && `recycle-filter--${filter.value}`]"
          :aria-pressed="recycleReason === filter.value"
          @click="recycleReason = filter.value"
        >
          {{ $t(filter.label) }}
        </button>
      </div>
    </div>
    <el-alert v-if="expiringCount" class="expiry-alert" :title="$t('recycleExpiryNotice', { count: expiringCount })" type="warning" :closable="false" show-icon />
    <emailScroll
      ref="scroll"
      type="recycle"
      recycle-mode
      :get-email-list="getRecycleList"
      :email-restore="emailRestore"
      :email-permanent-delete="emailPermanentDelete"
      :empty-description="$t('recycleEmpty')"
      :show-account-icon="false"
      :show-star="false"
      @jump="jumpContent"
    >
      <template #first>
        <el-tooltip :content="$t('emptyRecycle')" placement="bottom">
          <button class="clear-recycle" type="button" :aria-label="$t('emptyRecycle')" @click="clearRecycle">
            <Icon icon="material-symbols:delete-sweep-outline-rounded" width="21" height="21" />
          </button>
        </el-tooltip>
      </template>
    </emailScroll>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import emailScroll from '@/components/email-scroll/index.vue'
import { emailPermanentDelete, emailRestore, recycleClear, recycleList } from '@/request/email.js'
import { useEmailStore } from '@/store/email.js'

defineOptions({ name: 'recycle' })

const { t } = useI18n()
const emailStore = useEmailStore()
const scroll = ref({})
const expiringCount = ref(0)
const query = ref('')
const recycleReason = ref('')
const recycleFilters = [
  { value: '', label: 'recycleFilterAll' },
  { value: 'auto_spam', label: 'recycleReasonAutoSpam' },
  { value: 'manual_rule', label: 'recycleReasonManualRule' },
  { value: 'blacklist', label: 'recycleReasonBlacklist' },
  { value: 'recent_delete', label: 'recycleReasonRecentDelete' }
]
let expiryNotified = false
let cleanupNotified = false
let searchTimer

watch([query, recycleReason], () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => scroll.value.refreshList(), 180)
})

onBeforeUnmount(() => clearTimeout(searchTimer))

async function getRecycleList(emailId, size) {
  const data = await recycleList(emailId, size, 0, query.value, recycleReason.value)
  expiringCount.value = data.expiringCount || 0
  if (data.expiringCount && !expiryNotified) {
    expiryNotified = true
    ElNotification({ title: t('recycleBin'), message: t('recycleExpiryNotice', { count: data.expiringCount }), type: 'warning', position: 'top-right', duration: 5000 })
  }
  if (data.autoCleaned && !cleanupNotified) {
    cleanupNotified = true
    ElMessage({ message: t('recycleAutoCleaned', { count: data.autoCleaned }), type: 'success', plain: true })
  }
  return data
}

function jumpContent(email) {
  emailStore.contentData.email = email
  emailStore.contentData.delType = 'recycle'
  emailStore.contentData.showStar = false
  emailStore.contentData.showReply = false
  emailStore.contentData.showUnread = false
  router.push('/message')
}

function clearRecycle() {
  ElMessageBox.confirm(t('emptyRecycleWarning'), t('permanentDeleteTitle'), {
    confirmButtonText: t('emptyRecycle'),
    confirmButtonClass: 'el-button--danger',
    cancelButtonText: t('cancel'),
    type: 'error'
  }).then(async () => {
    try {
      const data = await recycleClear()
      ElMessage({ message: t('recycleCleared', { count: data.count || 0 }), type: 'success', plain: true })
      scroll.value.refreshList()
    } catch {
      ElMessage({ message: t('permanentDeleteFailed'), type: 'error', plain: true })
    }
  })
}
</script>

<style scoped lang="scss">
.recycle-page { height: 100%; display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
.recycle-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 15px; border-bottom: 1px solid var(--el-border-color-lighter); overflow-x: auto; }.recycle-search { flex: 0 1 440px; min-width: 220px; height: 36px; display: flex; align-items: center; gap: 8px; padding: 0 10px; color: var(--el-text-color-regular); border: 1px solid var(--el-border-color); border-radius: 6px; background: var(--el-fill-color-light); }.recycle-search input { width: 100%; min-width: 0; height: 100%; color: var(--el-text-color-primary); background: transparent; }.recycle-search button { display: grid; place-items: center; color: var(--secondary-text-color); }
.recycle-filters { display: flex; align-items: center; gap: 6px; white-space: nowrap; }.recycle-filter { height: 28px; padding: 0 9px; color: var(--secondary-text-color); border: 1px solid var(--el-border-color); border-radius: 999px; background: var(--el-bg-color); font-size: 12px; cursor: pointer; transition: color .16s ease, border-color .16s ease, background .16s ease; }.recycle-filter:hover, .recycle-filter:focus-visible { color: var(--el-color-primary); border-color: var(--el-color-primary-light-5); outline: none; }.recycle-filter.active { color: var(--el-color-primary); border-color: var(--el-color-primary-light-5); background: var(--el-color-primary-light-9); font-weight: 600; }.recycle-filter--auto_spam.active { color: var(--el-color-danger); border-color: var(--el-color-danger-light-5); background: var(--el-color-danger-light-9); }.recycle-filter--manual_rule.active { color: var(--el-color-warning-dark-2); border-color: var(--el-color-warning-light-5); background: var(--el-color-warning-light-9); }.recycle-filter--blacklist.active { color: var(--el-color-info-dark-2); border-color: var(--el-color-info-light-5); background: var(--el-color-info-light-9); }
.expiry-alert { margin: 10px 15px 0; width: auto; }
.clear-recycle { width: 30px; height: 30px; display: grid; place-items: center; color: var(--el-color-danger); border-radius: 5px; cursor: pointer; }.clear-recycle:hover, .clear-recycle:focus-visible { background: var(--el-color-danger-light-9); }
@media (max-width: 760px) { .recycle-toolbar { align-items: stretch; flex-direction: column; overflow-x: visible; }.recycle-search { width: 100%; min-width: 0; flex-basis: 36px; }.recycle-filters { overflow-x: auto; padding-bottom: 1px; } }
</style>
