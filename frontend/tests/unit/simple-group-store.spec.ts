import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetGroups, useGroups } from '@/features/workspace/groups/useGroups'
import { createMemoryHistory, createRouter } from 'vue-router'
import { workspaceRoutes } from '@/features/workspace/routes'

vi.mock('@/features/auth/composables/useAuth', async () => {
  const { ref } = await import('vue')
  const user = ref({ id: 'u-demo', username: 'Demo' })
  return { useAuth: () => ({ user, isGuest: ref(false) }), restoreSession: async () => undefined }
})

beforeEach(() => __resetGroups())
afterEach(() => vi.useRealTimers())

describe('Simple group chat integration', () => {
  it('stores a plain text message without triggering AI, even when AI is mentioned', () => {
    vi.useFakeTimers()
    const store = useGroups()
    const before = store.messages.value.length
    const result = store.sendTextMessage('g-launch', 'c-general', '  @Trợ lý AI xin chào  ')
    expect(result.ok).toBe(true)
    vi.advanceTimersByTime(2000)
    expect(store.messages.value).toHaveLength(before + 1)
    expect(store.messages.value.at(-1)).toMatchObject({
      text: '@Trợ lý AI xin chào', authorId: 'u-demo', attachments: [], threadParentId: null,
    })
    const persisted = JSON.parse(localStorage.getItem('taskflow:groups:u-demo')!)
    expect(persisted.messages.at(-1).text).toBe('@Trợ lý AI xin chào')
  })

  it('retains membership checks and rejects empty messages', () => {
    const store = useGroups()
    const before = store.messages.value.length
    expect(store.sendTextMessage('g-launch', 'c-general', '  ').ok).toBe(false)
    const group = store.group('g-launch')!
    group.members = group.members.filter((member) => member.userId !== 'u-demo')
    expect(store.sendTextMessage('g-launch', 'c-general', 'hello')).toMatchObject({ ok: false })
    expect(store.messages.value).toHaveLength(before)
  })

  it('redirects the old settings link to the group chat', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: workspaceRoutes })
    await router.push('/team/g-launch/settings/members')
    expect(router.currentRoute.value.name).toBe('team-channel')
    expect(router.currentRoute.value.params.groupId).toBe('g-launch')
    expect(router.currentRoute.value.fullPath).toBe('/team/g-launch')
  })
})
