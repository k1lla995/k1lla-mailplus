<template>
  <div class="contacts-page">
    <header class="contacts-toolbar">
      <div class="contact-tools" :aria-label="$t('contacts')">
        <el-tooltip :content="$t('addContact')" placement="bottom">
          <button class="tool-button primary" type="button" :aria-label="$t('addContact')" @click="addDialogOpen = true">
            <Icon icon="material-symbols:person-add-outline" width="21" height="21" />
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('deleteContacts')" placement="bottom">
          <button class="tool-button" type="button" :disabled="!selectedIds.length" :aria-label="$t('deleteContacts')" @click="deleteSelected">
            <Icon icon="material-symbols:delete-outline-rounded" width="21" height="21" />
          </button>
        </el-tooltip>
        <el-tooltip :content="$t('refreshContacts')" placement="bottom">
          <button class="tool-button" type="button" :aria-label="$t('refreshContacts')" @click="loadContacts">
            <Icon icon="material-symbols:refresh-rounded" width="21" height="21" />
          </button>
        </el-tooltip>
      </div>

      <label class="contact-search">
        <Icon icon="iconoir:search" width="20" height="20" aria-hidden="true" />
        <input v-model="filters.query" type="search" autocomplete="off" :placeholder="$t('contactSearch')" :aria-label="$t('contactSearch')" />
        <button v-if="filters.query" type="button" :aria-label="$t('clear')" @click="filters.query = ''">
          <Icon icon="mingcute:close-circle-fill" width="18" height="18" />
        </button>
      </label>
    </header>

    <section class="contact-filters" :aria-label="$t('contactSearch')">
      <label><span>{{ $t('contactEmailPrefix') }}</span><input v-model="filters.emailPrefix" type="text" autocomplete="off" /></label>
      <label><span>{{ $t('contactEmailSuffix') }}</span><input v-model="filters.emailSuffix" type="text" autocomplete="off" /></label>
      <label><span>{{ $t('contactBirthday') }}</span><input v-model="filters.birthday" type="date" /></label>
      <label><span>{{ $t('contactAddedAfter') }}</span><input v-model="filters.createAfter" type="date" /></label>
      <label><span>{{ $t('contactAddedBefore') }}</span><input v-model="filters.createBefore" type="date" /></label>
    </section>

    <main v-loading="loading" class="contacts-content" element-loading-background="transparent">
      <section v-if="!loading && !contacts.length" class="contacts-empty">
        <Icon icon="solar:users-group-rounded-linear" width="42" height="42" aria-hidden="true" />
        <p>{{ $t('noContacts') }}</p>
      </section>

      <section v-else class="contact-grid" :aria-label="$t('contacts')">
        <article v-for="contact in contacts" :key="contact.contactId" class="contact-card" :class="{ selected: selectedIds.includes(contact.contactId) }">
          <div class="contact-card-head">
            <el-checkbox :model-value="selectedIds.includes(contact.contactId)" :aria-label="contact.email" @change="toggleContact(contact.contactId, $event)" />
            <div class="contact-avatar">{{ contactInitial(contact) }}</div>
            <div class="contact-identity">
              <strong>{{ contact.nickname || contact.email }}</strong>
              <span>{{ contact.email }}</span>
            </div>
            <el-tooltip :content="$t('contactHistory')" placement="bottom">
              <button class="history-button" type="button" :aria-label="$t('contactHistory')" @click="openHistory(contact)">
                <Icon icon="solar:mailbox-linear" width="20" height="20" />
              </button>
            </el-tooltip>
          </div>
          <dl class="contact-meta">
            <div v-if="contact.birthday"><dt>{{ $t('contactBirthday') }}</dt><dd>{{ contact.birthday }}</dd></div>
            <div v-if="contact.phone"><dt>{{ $t('contactPhone') }}</dt><dd>{{ contact.phone }}</dd></div>
            <div><dt>{{ $t('contactCreatedAt') }}</dt><dd>{{ formatDate(contact.createTime) }}</dd></div>
          </dl>
        </article>
      </section>
    </main>

    <el-dialog v-model="addDialogOpen" :title="$t('addContact')" width="420px" class="contact-dialog" @closed="resetForm">
      <div class="contact-form">
        <label><span>{{ $t('contactEmail') }}</span><el-input v-model="contactForm.email" type="email" autocomplete="off" /></label>
        <label><span>{{ $t('contactNickname') }}</span><el-input v-model="contactForm.nickname" autocomplete="off" /></label>
        <label><span>{{ $t('contactBirthday') }}</span><el-date-picker v-model="contactForm.birthday" value-format="YYYY-MM-DD" type="date" /></label>
        <label><span>{{ $t('contactPhone') }}</span><el-input v-model="contactForm.phone" type="tel" autocomplete="tel" /></label>
      </div>
      <template #footer>
        <el-button @click="addDialogOpen = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" :loading="adding" @click="saveContact">{{ $t('add') }}</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="historyOpen" :title="historyTitle" size="min(480px, 100vw)" class="contact-history-drawer" @closed="historyMessages = []">
      <div v-loading="historyLoading" class="history-list" element-loading-background="transparent">
        <div v-if="!historyLoading && !historyMessages.length" class="history-empty">
          <Icon icon="solar:inbox-line-linear" width="32" height="32" aria-hidden="true" />
          <span>{{ $t('noContactHistory') }}</span>
        </div>
        <button v-for="message in historyMessages" :key="message.emailId" type="button" class="history-message" @click="openMessage(message)">
          <div class="history-direction" :class="message.type === 1 ? 'sent' : 'received'">
            <Icon :icon="message.type === 1 ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'" width="17" height="17" />
          </div>
          <div class="history-copy">
            <strong>{{ message.subject || $t('noSubject') }}</strong>
            <span>{{ message.type === 1 ? $t('sent') : $t('received') }} · {{ message.type === 1 ? message.toEmail : message.sendEmail }}</span>
          </div>
          <time>{{ formatDate(message.createTime) }}</time>
        </button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, defineOptions, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { contactAdd, contactDelete, contactHistory, contactList } from '@/request/contact.js'
import { useEmailStore } from '@/store/email.js'
import { tzDayjs } from '@/utils/day.js'

defineOptions({ name: 'contact' })

const { t } = useI18n()
const emailStore = useEmailStore()
const contacts = ref([])
const selectedIds = ref([])
const loading = ref(false)
const adding = ref(false)
const addDialogOpen = ref(false)
const historyOpen = ref(false)
const historyLoading = ref(false)
const historyContact = ref(null)
const historyMessages = ref([])
let searchTimer

const filters = reactive({ query: '', emailPrefix: '', emailSuffix: '', birthday: '', createAfter: '', createBefore: '' })
const contactForm = reactive({ email: '', nickname: '', birthday: '', phone: '' })
const historyTitle = computed(() => historyContact.value ? `${t('contactHistory')} · ${historyContact.value.nickname || historyContact.value.email}` : t('contactHistory'))

watch(filters, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(loadContacts, 180)
}, { deep: true })

onMounted(loadContacts)
onBeforeUnmount(() => clearTimeout(searchTimer))

async function loadContacts() {
  loading.value = true
  try {
    contacts.value = await contactList({ ...filters })
    selectedIds.value = selectedIds.value.filter(id => contacts.value.some(contact => contact.contactId === id))
  } finally {
    loading.value = false
  }
}

function toggleContact(contactId, checked) {
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, contactId])]
    : selectedIds.value.filter(id => id !== contactId)
}

function resetForm() {
  Object.keys(contactForm).forEach(key => contactForm[key] = '')
}

async function saveContact() {
  const email = contactForm.email.trim()
  if (!email) {
    ElMessage({ message: t('contactEmailRequired'), type: 'error', plain: true })
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ElMessage({ message: t('notEmailMsg'), type: 'error', plain: true })
    return
  }

  adding.value = true
  try {
    await contactAdd({ ...contactForm, email })
    addDialogOpen.value = false
    ElMessage({ message: t('contactAdded'), type: 'success', plain: true })
    await loadContacts()
  } finally {
    adding.value = false
  }
}

function deleteSelected() {
  if (!selectedIds.value.length) {
    ElMessage({ message: t('selectContactsForDeletion'), type: 'warning', plain: true })
    return
  }
  ElMessageBox.confirm(t('deleteContactsConfirm'), t('warning'), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning',
  }).then(async () => {
    await contactDelete(selectedIds.value)
    selectedIds.value = []
    ElMessage({ message: t('delSuccessMsg'), type: 'success', plain: true })
    await loadContacts()
  })
}

async function openHistory(contact) {
  historyContact.value = contact
  historyOpen.value = true
  historyLoading.value = true
  historyMessages.value = []
  try {
    const data = await contactHistory(contact.contactId)
    historyMessages.value = data.list
  } finally {
    historyLoading.value = false
  }
}

function openMessage(message) {
  emailStore.contentData.email = message
  emailStore.contentData.delType = 'logic'
  emailStore.contentData.showStar = true
  emailStore.contentData.showReply = true
  emailStore.contentData.showUnread = true
  historyOpen.value = false
  router.push('/message')
}

function contactInitial(contact) {
  return (contact.nickname || contact.email).trim().charAt(0).toUpperCase() || '?'
}

function formatDate(value) {
  return value ? tzDayjs(value).format('YYYY-MM-DD HH:mm') : ''
}
</script>

<style lang="scss" scoped>
.contacts-page { height: 100%; display: grid; grid-template-rows: auto auto minmax(0, 1fr); color: var(--el-text-color-primary); background: var(--el-bg-color); }
.contacts-toolbar { min-height: 60px; display: grid; grid-template-columns: auto minmax(220px, 440px); align-items: center; justify-content: space-between; gap: 18px; padding: 9px 18px; border-bottom: 1px solid var(--el-border-color); }
.contact-tools { display: flex; align-items: center; gap: 8px; }
.tool-button, .history-button { width: 36px; height: 36px; display: grid; place-items: center; color: var(--el-text-color-regular); border: 1px solid color-mix(in srgb, var(--el-border-color) 82%, transparent); border-radius: 6px; background: color-mix(in srgb, var(--light-ill) 84%, transparent); cursor: pointer; transition: color .18s ease, background .18s ease, border-color .18s ease; }
.tool-button:hover, .tool-button:focus-visible, .history-button:hover, .history-button:focus-visible { color: var(--el-color-primary); border-color: color-mix(in srgb, var(--el-color-primary) 52%, var(--el-border-color)); background: color-mix(in srgb, var(--el-color-primary) 10%, transparent); }
.tool-button.primary { color: #fff; border-color: var(--el-color-primary); background: var(--el-color-primary); }.tool-button.primary:hover { color: #fff; background: var(--el-color-primary-dark-2); }.tool-button:disabled { color: var(--el-text-color-disabled); cursor: not-allowed; opacity: .6; }
.contact-search { height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 10px 0 13px; color: var(--el-text-color-regular); border: 1px solid color-mix(in srgb, var(--el-border-color) 78%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--light-ill) 86%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.24); backdrop-filter: blur(16px) saturate(140%); }
.contact-search input { width: 100%; min-width: 0; height: 100%; color: var(--el-text-color-primary); background: transparent; font-size: 14px; }.contact-search button { display: grid; place-items: center; color: var(--secondary-text-color); }
.contact-filters { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; padding: 10px 18px; border-bottom: 1px solid var(--el-border-color); background: color-mix(in srgb, var(--light-ill) 45%, transparent); }.contact-filters label, .contact-form label { min-width: 0; display: grid; gap: 5px; color: var(--regular-text-color); font-size: 12px; font-weight: 600; }.contact-filters input { width: 100%; min-width: 0; height: 32px; padding: 0 8px; color: var(--el-text-color-primary); border: 1px solid var(--el-border-color); border-radius: 5px; background: var(--el-bg-color); }.contact-filters input:focus { border-color: var(--el-color-primary); outline: 2px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent); outline-offset: -1px; }
.contacts-content { min-height: 0; overflow: auto; padding: 18px; }.contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }.contact-card { min-width: 0; padding: 14px; border: 1px solid color-mix(in srgb, var(--el-border-color) 84%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--light-ill) 62%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.18); transition: border-color .18s ease, background .18s ease, box-shadow .18s ease; }.contact-card:hover, .contact-card.selected { border-color: color-mix(in srgb, var(--el-color-primary) 42%, var(--el-border-color)); background: color-mix(in srgb, var(--el-color-primary) 6%, var(--light-ill)); }.contact-card-head { display: grid; grid-template-columns: auto 38px minmax(0, 1fr) auto; align-items: center; gap: 10px; }.contact-avatar { width: 38px; height: 38px; display: grid; place-items: center; color: var(--el-color-primary-dark-2); background: var(--el-color-primary-light-9); border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent); border-radius: 50%; font-weight: 700; }.contact-identity { min-width: 0; display: grid; gap: 2px; }.contact-identity strong, .contact-identity span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.contact-identity strong { font-size: 14px; }.contact-identity span { color: var(--secondary-text-color); font-size: 12px; }.history-button { width: 32px; height: 32px; }.contact-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 14px 0 0 48px; color: var(--regular-text-color); font-size: 12px; }.contact-meta div { display: flex; gap: 5px; }.contact-meta dt { color: var(--secondary-text-color); }.contact-meta dd { margin: 0; color: var(--el-text-color-primary); }
.contacts-empty { min-height: 260px; height: 100%; display: grid; place-content: center; justify-items: center; gap: 12px; color: var(--secondary-text-color); border: 1px dashed color-mix(in srgb, var(--el-border-color) 85%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--el-fill-color-light) 78%, transparent); }.contacts-empty p { margin: 0; font-size: 14px; }
.contact-form { display: grid; gap: 16px; }.contact-form :deep(.el-date-editor), .contact-form :deep(.el-input) { width: 100%; }
.history-list { min-height: 100%; padding: 4px 0; }.history-empty { min-height: 220px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--secondary-text-color); font-size: 13px; }.history-message { width: 100%; min-height: 58px; display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 4px; color: inherit; text-align: left; border-bottom: 1px solid var(--el-border-color-lighter); cursor: pointer; }.history-message:hover { background: color-mix(in srgb, var(--el-color-primary) 7%, transparent); }.history-direction { width: 28px; height: 28px; display: grid; place-items: center; color: var(--el-color-success); background: var(--el-color-success-light-9); border-radius: 50%; }.history-direction.sent { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }.history-copy { min-width: 0; display: grid; gap: 2px; }.history-copy strong, .history-copy span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }.history-copy strong { font-size: 13px; }.history-copy span, .history-message time { color: var(--secondary-text-color); font-size: 11px; }.history-message time { white-space: nowrap; }
@media (max-width: 767px) { .contacts-toolbar { grid-template-columns: 1fr; gap: 10px; padding: 8px 12px; }.contact-tools { order: 2; }.contact-search { order: 1; }.tool-button { width: 44px; height: 44px; }.contact-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 10px 12px; }.contacts-content { padding: 12px; }.contact-grid { grid-template-columns: 1fr; }.contact-card { padding: 12px; }.contact-meta { margin-left: 0; }.history-message time { display: none; } }
@media (prefers-reduced-motion: reduce) { .tool-button, .history-button, .contact-card { transition: none; } }
</style>
