<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChatPanel from '../components/ChatPanel.vue'
import CreateGroupModal from '../components/CreateGroupModal.vue'
import GroupRail from '../components/GroupRail.vue'
import { useGroups } from '../useGroups'

const route = useRoute()
const router = useRouter()
const store = useGroups()
const createOpen = ref(false)

const group = computed(() => store.group(String(route.params.groupId ?? '')) ?? store.groups.value[0])
// Mỗi nhóm chỉ mở cuộc trò chuyện chung; vẫn tôn trọng quyền xem kênh.
const channel = computed(() => {
  if (!group.value) return undefined
  const channels = store.visibleChannels(group.value.id).filter((item) => item.type === 'text')
  return channels.find((item) => item.name === 'chung' && !item.private)
    ?? channels.find((item) => !item.private)
    ?? channels[0]
})

function selectGroup(groupId: string): void {
  void router.push({ name: 'team-channel', params: { groupId } })
}

// Các liên kết cũ tới kênh vẫn mở đúng nhóm, với một khung chat duy nhất.
watch(
  () => [group.value?.id, route.params.groupId, route.params.channelId] as const,
  ([groupId, requestedId, channelId]) => {
    if (groupId && (requestedId !== groupId || channelId)) {
      void router.replace({ name: 'team-channel', params: { groupId } })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="group-chat">
    <GroupRail :active-id="group?.id ?? null" @select="selectGroup" @create="createOpen = true" />
    <main class="group-chat__main">
      <ChatPanel v-if="group && channel" :group-id="group.id" :channel="channel" />
      <div v-else class="group-chat__empty">
        <h1>{{ group ? group.name : 'Chưa có nhóm nào' }}</h1>
        <p>{{ group ? 'Nhóm này chưa có cuộc trò chuyện khả dụng.' : 'Các nhóm của bạn sẽ xuất hiện ở thanh bên trái.' }}</p>
      </div>
    </main>
    <CreateGroupModal v-model:open="createOpen" create-only @created="selectGroup($event.id)" />
  </div>
</template>

<style scoped>
.group-chat {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.group-chat__main {
  min-width: 0;
  min-height: 0;
}

.group-chat__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 1.5rem;
  text-align: center;
}

.group-chat__empty h1 {
  margin: 0;
  font-size: 1.25rem;
}

.group-chat__empty p {
  color: var(--ws-text-2);
}

@media (max-width: 36rem) {
  .group-chat {
    grid-template-columns: 3.75rem minmax(0, 1fr);
  }
}
</style>
