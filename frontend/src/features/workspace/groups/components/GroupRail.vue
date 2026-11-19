<script setup lang="ts">
import AppIcon from '@/shared/components/AppIcon.vue'
import { useGroups } from '../useGroups'
import GroupIcon from './GroupIcon.vue'

defineProps<{ activeId: string | null }>()
const emit = defineEmits<{ select: [groupId: string]; create: [] }>()
const { groups } = useGroups()
</script>

<template>
  <nav class="rail ws-scroll" aria-label="Danh sách nhóm">
    <ul class="rail__list">
      <li v-for="group in groups" :key="group.id" class="rail__item">
        <button
          type="button"
          class="rail__button"
          :class="{ 'is-active': group.id === activeId }"
          :aria-current="group.id === activeId ? 'page' : undefined"
          :aria-label="group.name"
          :title="group.name"
          :data-test="`rail-${group.id}`"
          @click="emit('select', group.id)"
        >
          <GroupIcon :group="group" :size="40" />
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="rail__create"
      aria-label="Tạo nhóm"
      title="Tạo nhóm"
      data-test="rail-create"
      @click="emit('create')"
    >
      <AppIcon name="plus" :size="22" />
    </button>
  </nav>
</template>

<style scoped>
.rail {
  height: 100%;
  min-height: 0;
  padding: 1rem 0;
  overflow-y: auto;
  border-right: 1px solid var(--ws-border);
  background: var(--ws-sidebar);
}

.rail__list {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rail__button {
  display: block;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: transparent;
  cursor: pointer;
}

.rail__button:hover,
.rail__button.is-active {
  box-shadow: 0 0 0 3px var(--ws-accent);
}

.rail__button:focus-visible,
.rail__create:focus-visible {
  outline: 2px solid var(--ws-text);
  outline-offset: 4px;
}

.rail__create {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: 1rem auto 0;
  padding: 0;
  border: 1px dashed var(--ws-border-strong);
  border-radius: 14px;
  background: var(--ws-surface);
  color: var(--ws-accent-text);
  cursor: pointer;
}

.rail__create:hover {
  background: var(--ws-accent-soft);
  border-color: var(--ws-accent);
}
</style>
