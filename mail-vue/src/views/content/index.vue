<template>
  <div ref="contentRoot" class="box">
    <div class="header-actions">
      <Icon class="icon" icon="material-symbols-light:arrow-back-ios-new" width="20" height="20" @click="handleBack"/>
      <Icon v-if="email" v-perm="'email:delete'" class="icon" icon="uiw:delete" width="16" height="16" @click="handleDelete"/>
      <span class="star" v-if="email && emailStore.contentData.showStar">
        <Icon class="icon" @click="changeStar" v-if="email.isStar" icon="fluent-color:star-16" width="20" height="20"/>
        <Icon class="icon" @click="changeStar" v-else icon="solar:star-line-duotone" width="18" height="18"/>
      </span>
      <Icon class="icon" v-if="email && emailStore.contentData.showReply" v-perm="'email:send'"  @click="openReply" icon="la:reply" width="21" height="21" />
      <Icon class="icon" v-if="email && emailStore.contentData.showReply" v-perm="'email:send'"  @click="openForward" icon="iconoir:arrow-up-right" width="20" height="20" />
      <el-tooltip v-if="email && emailStore.contentData.showTranslation" :content="t('translateEmail')">
        <Icon class="icon" @click="openTranslation" icon="material-symbols:translate-rounded" width="20" height="20" />
      </el-tooltip>
    </div>
    <div></div>
    <el-scrollbar class="scrollbar">
      <div class="container">
        <template v-if="email">
        <div class="email-title">
          <span class="motion-title">{{ email.subject }}</span>
        </div>
        <div class="content">
          <div class="email-info motion-sender">
            <div>
              <div class="send"><span class="send-source">{{$t('from')}}</span>
                <div class="send-name">
                  <span class="send-name-title">{{ email.name }}</span>
                  <span><{{ email.sendEmail }}></span>
                </div>
              </div>
              <div class="receive"><span class="source">{{$t('recipient')}}</span><span class="receive-email">{{  formateReceive(email.recipient) }}</span></div>
              <div class="date">
                <div>{{ formatDetailDate(email.createTime) }}</div>
              </div>
            </div>
            <el-alert v-if="email.status === 3" :closable="false" :title="toMessage(email.message)" class="email-msg" type="error" show-icon />
            <el-alert v-if="email.status === 4" :closable="false" :title="$t('complained')" class="email-msg" type="warning" show-icon />
            <el-alert v-if="email.status === 5" :closable="false" :title="$t('delayed')" class="email-msg" type="warning" show-icon />
          </div>
          <el-scrollbar class="htm-scrollbar motion-body" :class="attachments.length === 0 ? 'bottom-distance' : ''">
            <ShadowHtml class="shadow-html" :html="formatImage(email.content)" v-if="email.content" />
            <pre v-else class="email-text" >{{email.text}}</pre>
          </el-scrollbar>
          <div class="att motion-attachments" v-if="attachments.length > 0">
            <div class="att-title">
              <span>{{$t('attachments')}}</span>
              <span>{{$t('attCount',{total: attachments.length})}}</span>
            </div>
            <div class="att-box">

              <div class="att-item" v-for="att in attachments" :key="att.attId">
                <div class="att-icon" @click="showImage(att.key)">
                  <Icon v-bind="getIconByName(att.filename)" />
                </div>
                <div class="att-name" @click="showImage(att.key)">
                  {{ att.filename }}
                </div>
                <div class="att-size">{{ formatBytes(att.size) }}</div>
                <div class="opt-icon att-icon">
                  <Icon v-if="isImage(att.filename)" icon="hugeicons:view" width="22" height="22" @click="showImage(att.key)"/>
                  <a :href="cvtR2Url(att.key)" download>
                    <Icon icon="system-uicons:push-down" width="22" height="22"/>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        </template>
        <el-empty v-else :description="$t('noMessagesFound')" />
      </div>
    </el-scrollbar>
    <TranslationDialog ref="translationDialogRef" />
    <el-image-viewer
        v-if="showPreview"
        :url-list="srcList"
        show-progress
        @close="showPreview = false"
    />
  </div>
</template>
<script setup>
import ShadowHtml from '@/components/shadow-html/index.vue'
import {computed, nextTick, reactive, ref, watch, onMounted, onUnmounted} from "vue";
import {useRouter} from 'vue-router'
import {ElMessage, ElMessageBox} from 'element-plus'
import {emailDelete, emailPermanentDelete, emailRead} from "@/request/email.js";
import {Icon} from "@iconify/vue";
import {useEmailStore} from "@/store/email.js";
import {useAccountStore} from "@/store/account.js";
import {formatDetailDate} from "@/utils/day.js";
import {starAdd, starCancel} from "@/request/star.js";
import {getExtName, formatBytes} from "@/utils/file-utils.js";
import {cvtR2Url,toOssDomain} from "@/utils/convert.js";
import {getIconByName} from "@/utils/icon-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {allEmailDelete} from "@/request/all-email.js";
import {useUiStore} from "@/store/ui.js";
import {useI18n} from "vue-i18n";
import {EmailUnreadEnum} from "@/enums/email-enum.js";
import { gsap, reduceMotion } from '@/utils/motion.js'
import TranslationDialog from '@/components/translation-dialog/index.vue'

const uiStore = useUiStore();
const settingStore = useSettingStore();
const accountStore = useAccountStore();
const emailStore = useEmailStore();
const router = useRouter()
const email = computed(() => emailStore.contentData.email)
const isRecycle = computed(() => emailStore.contentData.delType === 'recycle')
const attachments = computed(() => email.value?.attList || [])
const showPreview = ref(false)
const srcList = reactive([])
const contentRoot = ref(null)
const translationDialogRef = ref(null)
let contentTimeline

const { t } = useI18n()
watch(() => accountStore.currentAccountId, () => {
  handleBack()
})

onMounted(() => {
  initializeEmail(email.value)
})

watch(email, (currentEmail) => {
  initializeEmail(currentEmail)
}, { flush: 'post' })

onUnmounted(() => {
  emailStore.contentData.showUnread = false;
  contentTimeline?.kill()
})

function openReply() {
  if (email.value) uiStore.writerRef.openReply(email.value)
}

function openForward() {
  if (email.value) uiStore.writerRef.openForward(email.value)
}

function openTranslation() {
  if (email.value) translationDialogRef.value?.openEmail(email.value)
}

function initializeEmail(currentEmail) {
  if (!currentEmail) return

  if (emailStore.contentData.showUnread && currentEmail.unread === EmailUnreadEnum.UNREAD) {
    currentEmail.unread = EmailUnreadEnum.READ
    emailRead([currentEmail.emailId])
  }

  if (reduceMotion()) return

  nextTick(() => {
    const root = contentRoot.value
    const title = root?.querySelector('.motion-title')
    const sender = root?.querySelector('.motion-sender')
    const body = root?.querySelector('.motion-body')
    if (!title || !sender || !body) return

    contentTimeline?.kill()
    contentTimeline = gsap.timeline({ defaults: { ease: 'power2.out' } })
      .from(title, { autoAlpha: 0, y: 14, duration: 0.34 })
      .from(sender, { autoAlpha: 0, y: 10, duration: 0.28 }, '-=0.12')
      .from(body, { autoAlpha: 0, y: 8, duration: 0.34 }, '-=0.1')
    const attachments = root.querySelector('.motion-attachments')
    if (attachments) contentTimeline.from(attachments, { autoAlpha: 0, y: 8, duration: 0.26 }, '-=0.12')
  })
}

function toMessage(message) {
  if (!message) return ''
  try {
    return JSON.parse(message).message || message
  } catch {
    return message
  }
}

function formatImage(content) {
  content = content || '';
  const domain = settingStore.settings.r2Domain;
  return  content.replace(/{{domain}}/g, toOssDomain(domain) + '/');
}

function showImage(key) {
  if (!isImage(key)) return;
  const url = cvtR2Url(key)
  srcList.length = 0
  srcList.push(url)
  showPreview.value = true
}

function isImage(filename) {
  return ['png', 'jpg', 'jpeg', 'bmp', 'gif','jfif'].includes(getExtName(filename))
}

function formateReceive(recipient) {
  try {
    return JSON.parse(recipient || '[]').map(item => item.address).filter(Boolean).join(', ')
  } catch {
    return ''
  }
}

function changeStar() {
  const currentEmail = email.value
  if (!currentEmail) return

  if (currentEmail.isStar) {
    currentEmail.isStar = 0;
    starCancel(currentEmail.emailId).then(() => {
      currentEmail.isStar = 0;
      emailStore.cancelStarEmailId = currentEmail.emailId
      setTimeout(() => emailStore.cancelStarEmailId = 0)
      emailStore.starScroll?.deleteEmail([currentEmail.emailId])
    }).catch((e) => {
      console.error(e)
      currentEmail.isStar = 1;
    })
  } else {
    currentEmail.isStar = 1;
    starAdd(currentEmail.emailId).then(() => {
      currentEmail.isStar = 1;
      emailStore.addStarEmailId = currentEmail.emailId
      setTimeout(() => emailStore.addStarEmailId = 0)
      emailStore.starScroll?.addItem(currentEmail)
    }).catch((e) => {
      console.error(e)
      currentEmail.isStar = 0;
    })
  }
}

const handleBack = () => {
  router.back()
}

const handleDelete = () => {
  const currentEmail = email.value
  if (!currentEmail) return

  ElMessageBox.confirm(isRecycle.value ? t('permanentDeleteOneConfirm') : t('moveToRecycleConfirm'), {
    confirmButtonText: isRecycle.value ? t('permanentDelete') : t('confirm'),
    cancelButtonText: t('cancel'),
    type: isRecycle.value ? 'error' : 'warning'
  }).then(() => {
    if (emailStore.contentData.delType === 'logic') {
      emailDelete(currentEmail.emailId).then(() => {
        ElMessage({
          message: t('movedToRecycle'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [currentEmail.emailId]
      })
    } else if (isRecycle.value) {
      emailPermanentDelete([currentEmail.emailId]).then(() => {
        ElMessage({ message: t('permanentDeleteSuccess'), type: 'success', plain: true })
        emailStore.deleteIds = [currentEmail.emailId]
      })
    } else  {

      allEmailDelete(currentEmail.emailId).then(() => {
        ElMessage({
          message: t('delSuccessMsg'),
          type: 'success',
          plain: true,
        })
        emailStore.deleteIds = [currentEmail.emailId]
      })
    }

    router.back()
  })
}
</script>
<style scoped lang="scss">
.box {
  height: 100%;
  overflow: hidden;
}

.header-actions {
  padding: 9px 15px 8px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--header-actions-border);
  font-size: 18px;
  .star {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
  }
  .icon {
    cursor: pointer;
  }
}


.scrollbar {
  height: calc(100% - 38px);
  width: 100%;
}

.container {
  font-size: 14px;
  padding-left: 20px;
  padding-right: 20px;
  padding-top: 10px;
  @media (max-width: 1023px) {
    padding-left: 15px;
    padding-right: 15px;
  }

  .email-title {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 10px;
  }

  .htm-scrollbar {
  }

  .content {
    display: flex;
    flex-direction: column;

    .att {
      margin-top: 30px;
      margin-bottom: 30px;
      border: 1px solid var(--light-border-color);
      padding: 14px;
      border-radius: 6px;
      width: fit-content;
      .att-box {
        min-width: min(410px,calc(100vw - 60px));
        max-width: 600px;
        display: grid;
        gap: 12px;
        grid-template-rows: 1fr;
      }

      .att-title {
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        span:first-child {
          font-weight: bold;
        }
      }

      .att-item {
        cursor: pointer;
        div {
          align-self: center;
        }
        background: var(--light-ill);
        padding: 5px 7px;
        border-radius: 4px;
        align-self: start;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        .att-icon {
          display: grid;
        }

        .att-size {
          color: var(--secondary-text-color);
        }

        .att-name {
          margin-left: 8px;
          margin-right: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          word-break: break-all;
        }

        .att-image {
          width: 60px;
          height: 60px;
          object-fit: contain;
        }

        .opt-icon {
          padding-left: 10px;
          color: var(--secondary-text-color);
          align-items: center;
          display: flex;
          gap: 8px;
          cursor: pointer;
          a {
            color: var(--secondary-text-color);
            align-items: center;
            display: flex;
          }
        }
      }
    }

    .email-info {

      border-bottom: 1px solid var(--light-border-color);
      margin-bottom: 20px;
      padding-bottom: 8px;
      @media (max-width: 1024px) {
        margin-bottom: 15px;
      }
      .date {
        color: var(--regular-text-color);
        margin-bottom: 6px;
      }

      .email-msg {
        max-width: 400px;
        width: fit-content;
        margin-bottom: 15px;
      }

      .send {
        display: flex;
        margin-bottom: 6px;

        .send-name {
          color: var(--regular-text-color);
          display: flex;
          flex-wrap: wrap;
        }

        .send-name-title {
          padding-right: 5px;
        }
      }

      .receive {
        margin-bottom: 6px;
        display: flex;
        .receive-email {
          max-width: 700px;
          word-break: break-word;
        }
        span:nth-child(2) {
          color: var(--regular-text-color);
        }
      }

      .send-source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }

      .source {
        white-space: nowrap;
        font-weight: bold;
        padding-right: 10px;
      }
    }
  }
}

.shadow-html::after  {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--message-block-color); /* 半透明黑色蒙层 */
  pointer-events: none; /* 不影响点击 */
}

.email-text {
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.bottom-distance {
  margin-bottom: 30px;
}


</style>
