<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import AppIcon from '@/shared/components/AppIcon.vue'
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '../data/constants'
import type { TaskStatus } from '../types'
import { formatPercent } from '../utils/format'

const props = withDefaults(
  defineProps<{
    counts: Record<TaskStatus, number>
    /** Số ở giữa vòng: tỷ lệ hoàn tất hoặc tổng số việc */
    center?: 'done' | 'total'
    /** Hiện thêm tỷ lệ % ở mỗi dòng chú giải */
    percent?: boolean
    /** Có thì mỗi dòng chú giải là liên kết (mở danh sách đã lọc) */
    to?: (status: TaskStatus) => RouteLocationRaw
    hint?: string
  }>(),
  { center: 'done', percent: false },
)

const R = 40
const CIRC = 2 * Math.PI * R
/** Khe hở giữa các cung (đơn vị viewBox) */
const GAP = 1.8

const hover = ref<TaskStatus | null>(null)

const total = computed(() => STATUS_ORDER.reduce((sum, key) => sum + props.counts[key], 0))
const share = (key: TaskStatus) => (total.value ? props.counts[key] / total.value : 0)

const segments = computed(() => {
  let offset = 0
  const active = STATUS_ORDER.filter((key) => props.counts[key] > 0)
  return STATUS_ORDER.map((key) => {
    const length = share(key) * CIRC
    const visible = Math.max(0, length - (active.length > 1 ? GAP : 0))
    const seg = { key, on: length > 0, dash: `${visible} ${CIRC - visible}`, offset: -offset }
    offset += length
    return seg
  })
})

const centerText = computed(() => {
  if (hover.value) return { value: String(props.counts[hover.value]), label: STATUS_LABELS[hover.value].toLowerCase() }
  return props.center === 'total'
    ? { value: String(total.value), label: 'việc' }
    : { value: formatPercent(share('done')), label: 'hoàn tất' }
})

const summary = computed(
  () => `${total.value} công việc: ` + STATUS_ORDER.map((k) => `${STATUS_LABELS[k]} ${props.counts[k]}`).join(', '),
)
</script>

<template>
  <div class="donut">
    <div class="donut__chart">
      <svg viewBox="0 0 100 100" role="img" :aria-label="summary">
        <circle cx="50" cy="50" :r="R" class="donut__track" />
        <circle
          v-for="seg in segments"
          v-show="seg.on"
          :key="seg.key"
          cx="50"
          cy="50"
          :r="R"
          class="donut__seg"
          :class="{ 'is-dim': hover && hover !== seg.key }"
          :stroke="STATUS_COLORS[seg.key]"
          :stroke-dasharray="seg.dash"
          :stroke-dashoffset="seg.offset"
          @pointerenter="hover = seg.key"
          @pointerleave="hover = null"
        />
      </svg>
      <div class="donut__center" aria-hidden="true">
        <strong>{{ centerText.value }}</strong>
        <span>{{ centerText.label }}</span>
      </div>
    </div>

    <div class="donut__side">
      <ul class="donut__legend">
        <li v-for="key in STATUS_ORDER" :key="key">
          <component
            :is="to ? 'RouterLink' : 'div'"
            :to="to?.(key)"
            class="row"
            :class="{ 'is-dim': hover && hover !== key, 'is-zero': !counts[key], 'row--link': to }"
            :data-test="`donut-${key}`"
            @pointerenter="hover = key"
            @pointerleave="hover = null"
            @focus="hover = key"
            @blur="hover = null"
          >
            <span class="row__swatch" :style="{ background: STATUS_COLORS[key] }" />
            <span class="row__label">{{ STATUS_LABELS[key] }}</span>
            <span class="row__count">{{ counts[key] }} việc</span>
            <span v-if="percent" class="row__pct">{{ formatPercent(share(key)) }}</span>
            <AppIcon v-if="to" name="chevron-right" :size="16" class="row__chev" />
          </component>
        </li>
      </ul>
      <p v-if="hint" class="donut__hint">{{ hint }}</p>
    </div>
  </div>
</template>

<style scoped>
.donut {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1.25rem 1.75rem;
}

.donut__chart {
  position: relative;
  flex: none;
  width: clamp(8.5rem, min(11vw, 20vh), 11.5rem);
  aspect-ratio: 1;
}

.donut__chart svg {
  display: block;
  width: 100%;
  transform: rotate(-90deg);
}

.donut__track {
  fill: none;
  stroke: var(--ws-surface-2);
  stroke-width: 13;
}

.donut__seg {
  fill: none;
  stroke-width: 13;
  transition: opacity 0.15s ease;
}

.is-dim {
  opacity: 0.4;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
}

.donut__center strong {
  font-size: clamp(1.5rem, 1rem + 1vw, 2.125rem);
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.donut__center span {
  color: var(--ws-text-2);
  font-size: 0.8125rem;
}

.donut__side {
  flex: 1 1 13rem;
  min-width: 0;
  max-width: 20rem;
}

.donut__legend {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
  padding: 0 0.625rem 0 0.875rem;
  border-radius: 0.75rem;
  background: var(--tk-cell, var(--ws-surface-2));
  color: var(--ws-text);
  font-size: 0.875rem;
  text-decoration: none;
  transition:
    opacity 0.15s ease,
    background-color 0.15s ease;
}

.row--link:hover {
  background: var(--ws-surface-2);
}

.row__swatch {
  flex: none;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}

.row__label {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
}

.row__count {
  color: var(--ws-text-2);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.row__pct {
  min-width: 2.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.row__chev {
  flex: none;
  color: var(--ws-text-3);
}

.row.is-zero .row__label,
.row.is-zero .row__count,
.row.is-zero .row__pct {
  color: var(--ws-text-3);
}

.row.is-zero .row__swatch {
  background: var(--ws-surface-3) !important;
}

.donut__hint {
  margin: 0.625rem 0 0;
  color: var(--ws-text-3);
  font-size: 0.8125rem;
}
</style>
