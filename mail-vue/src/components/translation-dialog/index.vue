<template>
  <el-dialog v-model="visible" :title="t('translateEmail')" width="min(720px, calc(100% - 32px))" @close="reset">
    <div class="translation-controls">
      <el-select v-model="targetLanguage" filterable allow-create default-first-option :placeholder="t('targetLanguage')">
        <el-option v-for="language in languages" :key="language" :label="language" :value="language"/>
      </el-select>
      <el-button type="primary" :loading="loading" @click="translate">
        <Icon icon="material-symbols:translate-rounded" width="17" height="17"/>
        <span>{{ t('translate') }}</span>
      </el-button>
    </div>
    <div v-if="result" class="translation-result">
      <div class="translation-label">{{ t('translatedSubject') }}</div>
      <div class="translation-subject">{{ result.subject || '-' }}</div>
      <div class="translation-label">{{ t('translatedContent') }}</div>
      <div v-if="result.html" class="translation-html" v-html="translationPreviewHtml"></div>
      <pre v-else>{{ result.text }}</pre>
    </div>
    <el-empty v-else-if="!loading" :description="t('translationNoResult')" :image-size="96"/>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { translationConfig, translationTranslate } from '@/request/translation.js';
import { ElMessage } from 'element-plus';
import { sanitizeEmailHtml } from '@/utils/sanitize-html.js';

defineExpose({ openEmail });

const { t } = useI18n();
const visible = ref(false);
const loading = ref(false);
const emailId = ref(null);
const targetLanguage = ref('Chinese');
const result = ref(null);
const languages = ['Chinese', 'English', 'Japanese', 'Korean', 'Spanish', 'French', 'German'];
const translationPreviewHtml = computed(() => sanitizeEmailHtml(result.value?.html || ''));
let sessionId = 0;

async function openEmail(email) {
  const currentSessionId = ++sessionId;
  emailId.value = email?.emailId;
  result.value = null;
  loading.value = false;
  visible.value = true;
  try {
    const config = await translationConfig();
    if (currentSessionId !== sessionId) return;
    targetLanguage.value = config.defaultTargetLanguage || 'Chinese';
  } catch (error) {
    if (currentSessionId !== sessionId) return;
    ElMessage({ message: error?.message || t('translationNotConfigured'), type: 'error', plain: true });
    return;
  }
  translate();
}

async function translate() {
  if (!emailId.value || loading.value) return;
  const currentSessionId = sessionId;
  const requestEmailId = emailId.value;
  const requestTargetLanguage = targetLanguage.value;
  loading.value = true;
  try {
    const translation = await translationTranslate({ emailId: requestEmailId, targetLanguage: requestTargetLanguage });
    if (currentSessionId !== sessionId) return;
    result.value = translation;
  } catch (error) {
    if (currentSessionId !== sessionId) return;
    ElMessage({ message: error?.message || t('translationFailed'), type: 'error', plain: true });
  } finally {
    if (currentSessionId === sessionId) loading.value = false;
  }
}

function reset() {
  sessionId += 1;
  loading.value = false;
  result.value = null;
  emailId.value = null;
}
</script>

<style scoped lang="scss">
.translation-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;

  .el-select {
    flex: 1;
    min-width: 0;
  }

  .el-button {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }
}

.translation-result {
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  border-radius: 6px;
  padding: 14px;
}

.translation-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 5px;
}

.translation-subject {
  font-weight: 600;
  margin-bottom: 16px;
  overflow-wrap: anywhere;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: inherit;
  line-height: 1.65;
}

.translation-html {
  max-height: min(420px, 55vh);
  overflow: auto;
  color: #303133;
  background: #fff;
  line-height: normal;
}

.translation-html :deep(img) {
  max-width: 100%;
  height: auto;
}

.translation-html :deep(table) {
  max-width: 100%;
}

@media (max-width: 480px) {
  .translation-controls {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
