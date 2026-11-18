<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import BaseButton from '@/shared/components/BaseButton.vue'
import { useProfile } from '../composables/useProfile'
import BaseModal from './BaseModal.vue'

const open = defineModel<boolean>('open', { required: true })

const { profile, save } = useProfile()
const form = reactive({ displayName: '', jobTitle: '', timezone: '' })
const error = ref('')
const saving = ref(false)

const timezones = (() => {
  try {
    // Intl.supportedValuesOf (ES2022) chưa có trong lib của tsconfig
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }
    const zones = intl.supportedValuesOf?.('timeZone') ?? []
    return zones.includes(profile.value.timezone) ? zones : [profile.value.timezone, ...zones]
  } catch {
    return [profile.value.timezone]
  }
})()

watch(open, (isOpen) => {
  if (!isOpen) return
  form.displayName = profile.value.displayName
  form.jobTitle = profile.value.jobTitle
  form.timezone = profile.value.timezone
  error.value = ''
})

async function submit() {
  if (saving.value) return
  const displayName = form.displayName.trim()

  if (!displayName) {
    error.value = 'Nhập họ và tên.'
    return
  }

  error.value = ''
  saving.value = true

  try {
    await save({
      displayName,
      jobTitle: form.jobTitle.trim(),
      timezone: form.timezone,
    })

    open.value = false
  } catch (err) {
    console.error('Lỗi lưu hồ sơ:', err)
    const detail = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Hãy thử lại.'
    error.value = `Không lưu được hồ sơ: ${detail}`
  } finally {
    saving.value = false
  }
}
  

</script>

<template>
  <BaseModal v-model:open="open" title="Chỉnh sửa hồ sơ" description="Thông tin này hiển thị với các thành viên trong không gian làm việc.">
    <form id="edit-profile" class="form" novalidate @submit.prevent="submit">
      <div>
        <label class="ws-label" for="pf-name">Họ và tên</label>
        <input
          id="pf-name"
          v-model="form.displayName"
          class="ws-input"
          autocomplete="name"
          autofocus
          :aria-invalid="error ? 'true' : undefined"
          aria-describedby="pf-name-error"
        />
        <p v-if="error" id="pf-name-error" class="form__error">{{ error }}</p>
      </div>
      <div>
        <label class="ws-label" for="pf-title">Chức danh</label>
        <input id="pf-title" v-model="form.jobTitle" class="ws-input" placeholder="Ví dụ: Thiết kế và phát triển phần mềm" />
      </div>
      <div>
        <label class="ws-label" for="pf-tz">Múi giờ</label>
        <select id="pf-tz" v-model="form.timezone" class="ws-input">
          <option v-for="tz in timezones" :key="tz" :value="tz">{{ tz }}</option>
        </select>
      </div>
    </form>
    <template #footer>
      <BaseButton variant="secondary" class="ws-btn-auto" :disabled="saving" @click="open = false">Huỷ</BaseButton>
      <BaseButton type="submit" form="edit-profile" class="ws-btn-auto" :loading="saving">Lưu thay đổi</BaseButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form__error {
  margin: 0.375rem 0 0;
  color: var(--ws-danger);
  font-size: 0.8125rem;
}
</style>
