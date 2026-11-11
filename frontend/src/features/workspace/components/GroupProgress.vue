<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import AppIcon from '@/shared/components/AppIcon.vue'
import type { GroupProgressRow } from '../composables/useInsights'
import { STATUS_COLORS, STATUS_LABELS } from '../data/constants'
import type { TaskStatus } from '../types'
import { formatPercent } from '../utils/format'

defineProps<{
  rows: GroupProgressRow[]
  /** Có thì tên nhóm là liên kết tới bảng công việc của nhóm */
  to?: (projectId: string) => RouteLocationRaw
}>()

/** Thứ tự trên thanh: phần đã xong bên trái, phần chưa bắt đầu bên phải. */
const BAR_ORDER: TaskStatus[] = ['done', 'review', 'doing', 'todo']

const describe = (row: GroupProgressRow) =>
  `${row.project.name}: ` + BAR_ORDER.map((s) => `${STATUS_LABELS[s]} ${row.counts[s]}`).join(', ')
</script>

<template>
  <div class="gp">
    <ul class="gp__legend" aria-hidden="true">
      <li v-for="s in BAR_ORDER" :key="s"><i :style="{ background: STATUS_COLORS[s] }" />{{ STATUS_LABELS[s] }}</li>
    </ul>

    <p v-if="!rows.length" class="gp__empty">Chưa có nhóm nào.</p>
    <ul v-else class="gp__list">
      <li v-for="row in rows" :key="row.project.id" class="gp__item">
        <div class="gp__head">
          <span class="gp__code" :style="{ background: row.project.color }">{{ row.project.code }}</span>
          <component :is="to ? 'RouterLink' : 'span'" :to="to?.(row.project.id)" class="gp__name">{{ row.project.name }}</component>
          <span class="gp__total">{{ row.total }} việc</span>
          <span v-if="row.overdue" class="gp__overdue"><AppIcon name="alert" :size="13" :stroke-width="2.2" />{{ row.overdue }} quá hạn</span>
          <strong class="gp__pct">{{ formatPercent(row.progress) }}</strong>
        </div>
        <div class="gp__bar" role="img" :aria-label="describe(row)">
          <template v-for="s in BAR_ORDER" :key="s">
            <span
              v-if="row.counts[s]"
              class="gp__seg"
              :style="{ flexGrow: row.counts[s], background: STATUS_COLORS[s] }"
              :title="`${STATUS_LABELS[s]}: ${row.counts[s]} việc`"
            />
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.gp {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1rem;
}

.gp__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: -0.5rem 0 0;
  padding: 0;
  color: var(--ws-text-2);
  font-size: 0.8125rem;
  list-style: none;
}

.gp__legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.gp__legend i {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}

.gp__list {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.875rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gp__head {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  margin-bottom: 0.5rem;
}

.gp__code {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 0.5625rem;
  color: #0e1728;
  font-size: 0.75rem;
  font-weight: 700;
}

.gp__name {
  overflow: hidden;
  color: var(--ws-text);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

a.gp__name:hover {
  color: var(--ws-accent-text);
}

.gp__total {
  flex: none;
  color: var(--ws-text-3);
  font-size: 0.8125rem;
}

.gp__overdue {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
  height: 1.375rem;
  margin-left: auto;
  padding: 0 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ws-danger) 16%, transparent);
  color: var(--ws-danger);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.gp__pct {
  flex: none;
  min-width: 2.75rem;
  margin-left: auto;
  font-size: 1.0625rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.gp__overdue + .gp__pct {
  margin-left: 0;
}

.gp__bar {
  display: flex;
  gap: 2px;
  height: 0.625rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ws-surface-2);
}

.gp__seg {
  flex-basis: 0;
  min-width: 0.375rem;
  border-radius: 3px;
}

.gp__empty {
  margin: 0;
  color: var(--ws-text-2);
  font-size: 0.9375rem;
}
</style>
