import { computed, ref } from 'vue'
import { useAuth } from '@/features/auth/composables/useAuth'
import type { ProfileData } from '../types'
import { loadJSON, saveJSON } from './storage'
import { getMyProfile, updateMyName } from '@/services/UserService'

const PROFILES_KEY = 'taskflow:profiles'

/** Thông tin hồ sơ bổ sung (tên hiển thị, chức danh, ảnh…) lưu theo id người dùng. */
const profiles = ref<Record<string, Partial<ProfileData>>>(loadJSON(PROFILES_KEY, {}))
// Không để một lần đọc cũ ghi đè tên vừa được lưu.
const revisions: Record<string, number> = {}

const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export function useProfile() {
  const { user, isGuest } = useAuth()

  const profile = computed<ProfileData>(() => ({
    displayName: user.value?.username ?? '',
    jobTitle: '',
    timezone: localTimezone,
    avatar: null,
    ...(user.value ? profiles.value[user.value.id] : {}),
  }))

  const initials = computed(() => {
    const words = profile.value.displayName.trim().split(/\s+/).filter(Boolean)
    if (!words.length) return '?'
    const first = words[0][0]
    const last = words.length > 1 ? words[words.length - 1][0] : ''
    return (first + last).toUpperCase()
  })

  /** Tên ngắn để chào (từ cuối của họ tên tiếng Việt). */
  const firstName = computed(() => profile.value.displayName.trim().split(/\s+/).pop() ?? '')

  function update(patch: Partial<ProfileData>): void {
    const id = user.value?.id
    if (!id) return
    revisions[id] = (revisions[id] ?? 0) + 1
    profiles.value = { ...profiles.value, [id]: { ...profiles.value[id], ...patch } }
    saveJSON(PROFILES_KEY, profiles.value)
  }

  async function refresh(): Promise<void> {
    const id = user.value?.id
    if (!id || isGuest.value) return
    const revision = (revisions[id] ?? 0) + 1
    revisions[id] = revision
    const saved = await getMyProfile()
    if (user.value?.id !== id || revisions[id] !== revision) return
    if (saved.UserId !== id) throw new Error('Hồ sơ không khớp tài khoản đang đăng nhập.')
    update({ displayName: saved.Username })
  }

  async function save(patch: Pick<ProfileData, 'displayName' | 'jobTitle' | 'timezone'>): Promise<void> {
    const id = user.value?.id
    if (!id || isGuest.value) throw new Error('Bạn cần đăng nhập để lưu hồ sơ.')
    revisions[id] = (revisions[id] ?? 0) + 1
    const saved = await updateMyName(patch.displayName.trim())
    if (user.value?.id !== id || saved.UserId !== id) {
      throw new Error('Tài khoản đã thay đổi. Hãy mở lại hồ sơ.')
    }
    // Chỉ ghi tên đã được Supabase xác nhận; các trường còn lại vẫn lưu cục bộ.
    update({ ...patch, displayName: saved.Username })
  }

  return { user, isGuest, profile, initials, firstName, update, refresh, save }
}
