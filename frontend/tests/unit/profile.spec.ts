import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/composables/useAuth'
import { useProfile } from '@/features/workspace/composables/useProfile'
import { getMyProfile, updateMyName } from '@/services/UserService'

vi.mock('@/features/auth/composables/useAuth', async () => {
  const { ref } = await import('vue')
  const user = ref({ id: 'profile-test', username: 'Auth name' })
  const isGuest = ref(false)
  return {
    useAuth: () => ({ user, isGuest }),
    restoreSession: async () => undefined,
  }
})

vi.mock('@/services/UserService', () => ({
  getMyProfile: vi.fn(),
  updateMyName: vi.fn(),
}))

let sequence = 0
let userId: string
const draft = { displayName: ' New name ', jobTitle: 'Developer', timezone: 'Asia/Ho_Chi_Minh' }

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  userId = `profile-test-${++sequence}`
  useAuth().user.value!.id = userId
})

describe('Supabase profile state', () => {
  it('refresh shares the database name with every profile consumer', async () => {
    const first = useProfile()
    const second = useProfile()
    first.update({ displayName: 'Cached name' })
    vi.mocked(getMyProfile).mockResolvedValue({ UserId: userId, Username: 'Database name', AvataPath: null })

    await first.refresh()

    expect(first.profile.value.displayName).toBe('Database name')
    expect(second.profile.value.displayName).toBe('Database name')
    expect(JSON.parse(localStorage.getItem('taskflow:profiles')!)[userId].displayName).toBe('Database name')
  })

  it('saves the name confirmed by the service, trimming the submitted name', async () => {
    const profile = useProfile()
    vi.mocked(updateMyName).mockResolvedValue({ UserId: userId, Username: 'Confirmed name' })

    await profile.save(draft)

    expect(updateMyName).toHaveBeenCalledWith('New name')
    expect(profile.profile.value.displayName).toBe('Confirmed name')
    expect(profile.profile.value.jobTitle).toBe('Developer')
    expect(JSON.parse(localStorage.getItem('taskflow:profiles')!)[userId].displayName).toBe('Confirmed name')
  })

  it('keeps the previous name and cache when the database rejects the save', async () => {
    const profile = useProfile()
    profile.update({ displayName: 'Previous name' })
    const cached = localStorage.getItem('taskflow:profiles')
    vi.mocked(updateMyName).mockRejectedValue(new Error('Permission denied'))

    await expect(profile.save(draft)).rejects.toThrow('Permission denied')

    expect(profile.profile.value.displayName).toBe('Previous name')
    expect(localStorage.getItem('taskflow:profiles')).toBe(cached)
  })

  it('does not let an old pending read overwrite a newly saved name', async () => {
    let resolveRead!: (value: { UserId: string; Username: string; AvataPath: null }) => void
    vi.mocked(getMyProfile).mockReturnValue(new Promise((resolve) => { resolveRead = resolve }))
    vi.mocked(updateMyName).mockResolvedValue({ UserId: userId, Username: 'New name' })
    const profile = useProfile()

    const pendingRefresh = profile.refresh()
    await profile.save(draft)
    resolveRead({ UserId: userId, Username: 'Old database name', AvataPath: null })
    await pendingRefresh

    expect(profile.profile.value.displayName).toBe('New name')
    expect(JSON.parse(localStorage.getItem('taskflow:profiles')!)[userId].displayName).toBe('New name')
  })
})
