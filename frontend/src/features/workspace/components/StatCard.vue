<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AppIcon, { type IconName } from '@/shared/components/AppIcon.vue'

export type StatTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

withDefaults(
  defineProps<{
    label: string
    value: string
    /** Đơn vị nhỏ cạnh con số, vd. "việc" */
    unit?: string
    hint: string
    icon: IconName
    /** Biểu tượng nhỏ trước dòng gợi ý */
    hintIcon?: IconName
    /** Màu dòng gợi ý (trạng thái của chỉ số) */
    tone?: StatTone
    /** Màu ô biểu tượng; mặc định theo màu nhấn */
    iconTone?: StatTone
    /** Có thì cả thẻ là một liên kết */
    to?: RouteLocationRaw
  }>(),
  { tone: 'accent', iconTone: 'accent' },
)
</script>

<template>
  <component :is="to ? 'RouterLink' : 'article'" :to="to" class="stat" :class="{ 'stat--link': to }">
    <div class="stat__top">
      <p class="stat__label">{{ label }}</p>
      <span class="stat__icon" :class="`tone-${iconTone}`"><AppIcon :name="icon" :size="20" /></span>
    </div>
    <p class="stat__value">
      {{ value }}<span v-if="unit" class="stat__unit">{{ unit }}</span>
    </p>
    <p class="stat__hint" :class="`tone-${tone}`">
      <AppIcon v-if="hintIcon" :name="hintIcon" :size="15" :stroke-width="2.2" />
      <span>{{ hint }}</span>
    </p>
  </component>
</template>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 1rem 1.25rem;
  border: 1px solid var(--ws-border);
  border-radius: var(--ws-radius);
  background: var(--ws-surface);
  color: inherit;
  text-decoration: none;
}

.stat--link {
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.stat--link:hover {
  border-color: var(--ws-border-strong);
  background: color-mix(in srgb, var(--ws-surface-2) 45%, var(--ws-surface));
}

.stat__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.stat__label {
  margin: 0;
  color: var(--ws-text-2);
  font-size: 0.9375rem;
}

.tone-accent {
  --tone: var(--ws-accent-text);
}
.tone-success {
  --tone: var(--ws-success);
}
.tone-warning {
  --tone: var(--ws-warning);
}
.tone-danger {
  --tone: var(--ws-danger);
}
.tone-info {
  --tone: var(--ws-info);
}
.tone-muted {
  --tone: var(--ws-text-3);
}

.stat__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  color: var(--tone);
}

.stat__value {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0.125rem 0 0.375rem;
  font-size: clamp(1.75rem, 1.2rem + 1vw, 2.25rem);
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat__unit {
  color: var(--ws-text-2);
  font-size: 0.9375rem;
  font-weight: 400;
}

.stat__hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  margin: 0;
  color: var(--tone);
  font-size: 0.875rem;
  font-weight: 500;
}

.stat__hint svg {
  flex: none;
}

.stat__hint span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
