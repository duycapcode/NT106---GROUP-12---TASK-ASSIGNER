import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ChatPanel from '@/features/workspace/groups/components/ChatPanel.vue'
import GroupRail from '@/features/workspace/groups/components/GroupRail.vue'
import { useGroups } from '@/features/workspace/groups/useGroups'
import type { Channel, Group, Message } from '@/features/workspace/groups/types'

vi.mock('@/features/auth/composables/useAuth', () => ({ restoreSession: async () => undefined }))

vi.mock('@/features/workspace/groups/useGroups', async () => {
  const { ref } = await import('vue')
  const groups = ref<Group[]>([])
  const messages = ref<Message[]>([])
  const store = {
    groups,
    messages,
    meId: ref('me'),
    group: (id: string) => groups.value.find((group) => group.id === id),
    channelMessages: (id: string) => messages.value.filter((message) => message.channelId === id),
    canPost: vi.fn(),
    sendTextMessage: vi.fn(),
    markRead: vi.fn(),
    displayName: (_groupId: string, id: string) => id === 'me' ? 'Bạn' : 'An',
    person: (id: string) => ({ id, name: 'Bạn', username: 'ban', color: '#7060fa', status: 'online' }),
  }
  return { useGroups: () => store }
})

const store = useGroups()
const wrappers: VueWrapper[] = []

function channel(id: string): Channel {
  return { id, name: 'chung', type: 'text', categoryId: null, topic: '', private: false, allowedRoleIds: [], aiAccess: false }
}

function group(id: string, name: string): Group {
  return {
    id, name, color: '#7060fa', description: '', ownerId: 'me', createdAt: '2026-01-01T00:00:00Z',
    roles: [], members: [], categories: [], channels: [channel(`${id}-chat`)], invites: [], bans: [], auditLog: [],
    automod: { enabled: false, blockedWords: [], blockLinks: false, maxMentions: 5 },
  }
}

function mountChat() {
  const wrapper = mount(ChatPanel, { props: { groupId: 'g1', channel: channel('g1-chat') }, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  store.groups.value = [group('g1', 'Nhóm một'), group('g2', 'Nhóm hai')]
  store.messages.value = []
  vi.mocked(store.canPost).mockReturnValue({ ok: true, value: null })
  vi.mocked(store.sendTextMessage).mockImplementation((_groupId, channelId, text) => {
    const message: Message = {
      id: `message-${store.messages.value.length}`, channelId, authorId: 'me', at: '2026-11-19T08:00:00Z',
      text: text.trim(), reactions: [], attachments: [], pinned: false,
    }
    store.messages.value.push(message)
    return { ok: true, value: message }
  })
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('Simple group chat', () => {
  it('offers group selection and creation in the rail, without a join action', async () => {
    const wrapper = mount(GroupRail, { props: { activeId: 'g1' } })
    wrappers.push(wrapper)

    expect(wrapper.findAll('button')).toHaveLength(3)
    await wrapper.get('[data-test="rail-create"]').trigger('click')
    expect(wrapper.emitted('create')).toHaveLength(1)
    expect(wrapper.find('[data-test="rail-join"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Nhóm một"]').attributes('aria-current')).toBe('page')

    await wrapper.get('[aria-label="Nhóm hai"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['g2']])
  })

  it('has only a send action, blocks blank messages and sends through the button', async () => {
    const wrapper = mountChat()
    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    expect(wrapper.get('button').text()).toBe('Gửi')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('form').trigger('submit')
    expect(store.sendTextMessage).not.toHaveBeenCalled()

    await wrapper.get('textarea').setValue('Xin chào')
    await wrapper.get('button').trigger('click')
    expect(store.sendTextMessage).toHaveBeenCalledWith('g1', 'g1-chat', 'Xin chào')
    expect(wrapper.get('[role="log"]').text()).toContain('Xin chào')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('sends with Enter, but preserves Shift+Enter and IME composition', async () => {
    const wrapper = mountChat()
    await wrapper.get('textarea').setValue('Một dòng')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', shiftKey: true })
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(store.sendTextMessage).not.toHaveBeenCalled()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Một dòng')

    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
    expect(store.sendTextMessage).toHaveBeenCalledOnce()
  })

  it('keeps drafts separate while switching groups and sends to the current group', async () => {
    const wrapper = mountChat()
    await wrapper.get('textarea').setValue('Bản nháp nhóm một')
    await wrapper.setProps({ groupId: 'g2', channel: channel('g2-chat') })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')

    await wrapper.get('textarea').setValue('Tin nhóm hai')
    await wrapper.get('form').trigger('submit')
    expect(store.sendTextMessage).toHaveBeenCalledWith('g2', 'g2-chat', 'Tin nhóm hai')

    await wrapper.setProps({ groupId: 'g1', channel: channel('g1-chat') })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Bản nháp nhóm một')
    expect(wrapper.get('[role="log"]').text()).not.toContain('Tin nhóm hai')
  })

  it('shows send failures and preserves the draft for retrying', async () => {
    vi.mocked(store.sendTextMessage).mockReturnValue({ ok: false, error: 'Không gửi được tin.' })
    const wrapper = mountChat()
    await wrapper.get('textarea').setValue('Giữ nội dung này')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('[role="alert"]').text()).toBe('Không gửi được tin.')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Giữ nội dung này')
    expect(store.messages.value).toHaveLength(0)
  })

  it('disables sending when the user has no posting permission', async () => {
    vi.mocked(store.canPost).mockReturnValue({ ok: false, error: 'Bạn không có quyền gửi tin nhắn.' })
    const wrapper = mountChat()
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role="alert"]').text()).toContain('không có quyền')
    await wrapper.get('form').trigger('submit')
    expect(store.sendTextMessage).not.toHaveBeenCalled()
  })
})
