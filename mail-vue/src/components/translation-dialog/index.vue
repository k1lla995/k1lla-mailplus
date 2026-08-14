<template>
  <el-dialog v-model="visible" :title="t('translateEmail')" width="min(720px, calc(100% - 32px))" @closed="reset">
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
      <pre>{{ result.text }}</pre>
    </div>
    <el-empty v-else-if="!loading" :description="t('translationNoResult')" :image-size="96"/>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useI18n } from 'vue-i18n';
import { translationConfig, translationTranslate } from '@/request/translation.js';
import { ElMessage } from 'element-plus';

defineExpose({ openEmail });

const { t } = useI18n();
const visible = ref(false);
const loading = ref(false);
const emailId = ref(null);
const targetLanguage = ref('Chinese');
const result = ref(null);
const languages = ['Chinese', 'English', 'Japanese', 'Korean', 'Spanish', 'French', 'German'];

async function openEmail(email) {
  emailId.value = email?.emailId;
  result.value = null;
  visible.value = true;
  try {
    const config = await translationConfig();
    targetLanguage.value = config.defaultTargetLanguage || 'Chinese';
  } catch (error) {
    ElMessage({ message: error?.message || t('translationNotConfigured'), type: 'error', plain: true });
    return;
  }
  translate();
}

async function translate() {
  if (!emailId.value || loading.value) return;
  loading.value = true;
  try {
    result.value = await translationTranslate({ emailId: emailId.value, targetLanguage: targetLanguage.value });
  } catch (error) {
    ElMessage({ message: error?.message || t('translationFailed'), type: 'error', plain: true });
  } finally {
    loading.value = false;
  }
}

function reset() {
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

@media (max-width: 480px) {
  .translation-controls {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
