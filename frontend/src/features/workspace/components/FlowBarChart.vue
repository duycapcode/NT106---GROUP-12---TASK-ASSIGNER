<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DayFlow } from '../composables/useInsights'
import { todayISO } from '../utils/format'

/** Cột ghép: việc tạo mới (xám) và hoàn tất (màu nhấn) mỗi ngày. */
const props = defineProps<{ days: DayFlow[] }>()

const active = ref<number | null>(null)
const today = todayISO()
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Đỉnh trục: số chẵn, chia được 4 vạch nguyên, tối thiểu 4. */
const max = computed(() => {
  const peak = Math.max(0, ...props.days.flatMap((d) => [d.created, d.completed]))
  return Math.max(4, Math.ceil(peak / 4) * 4)
})
const ticks = computed(() => [4, 3, 2, 1, 0].map((i) => (max.value / 4) * i))

const cols = computed(() => {
  const n = props.days.length
  const every = n <= 7 ? 1 : n <= 14 ? 2 : 5
  return props.days.map((d, i) => {
    const date = new Date(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)) - 1, Number(d.date.slice(8, 10)))
    const dow = date.getDay()
    const short = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`
    const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date)
    return {
      ...d,
      isToday: d.date === today,
      // Đếm lùi từ hôm nay để nhãn cuối luôn hiện
      showLabel: (n - 1 - i) % every === 0,
      weekday: dow === 0 ? 'CN' : `T${dow + 1}`,
      short,
      long: `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${short}`,
      // Tooltip lật sang trái ở nửa phải để không tràn khung
      flip: i > n / 2,
    }
  })
})

const pct = (v: number) => `${(v / max.value) * 100}%`
</script>

<template>
  <div class="flow" :class="{ 'flow--dense': days.length > 14 }">
    <span class="flow__unit" aria-hidden="true">việc</span>
    <div class="flow__plot">
      <div class="flow__grid" aria-hidden="true">
        <div v-for="t in ticks" :key="t" class="flow__line"><span>{{ t }}</span></div>
      </div>

      <ol class="flow__cols" @pointerleave="active = null">
        <li
          v-for="(d, i) in cols"
          :key="d.date"
          class="col"
          :class="{ 'is-active': active === i, 'is-today': d.isToday }"
          tabindex="0"
          :aria-label="`${d.long}: tạo mới ${d.created} việc, hoàn tất ${d.completed} việc`"
          @pointerenter="active = i"
          @focus="active = i"
          @blur="active = null"
        >
          <div class="col__bars" aria-hidden="true">
            <span class="bar bar--created" :class="{ 'is-zero': !d.created }" :style="{ height: pct(d.created) }" />
            <span class="bar bar--done" :class="{ 'is-zero': !d.completed }" :style="{ height: pct(d.completed) }" />
          </div>
          <div class="col__label" aria-hidden="true">
            <template v-if="d.showLabel">
              <strong>{{ d.weekday }}</strong>
              <span>{{ d.isToday ? 'Hôm nay' : d.short }}</span>
            </template>
          </div>

          <div v-if="active === i" class="tip" :class="{ 'tip--left': d.flip }" role="status">
            <strong>{{ d.long }}</strong>
            <span><i class="sw sw--done" />Hoàn tất<b>{{ d.completed }} việc</b></span>
            <span><i class="sw sw--created" />Tạo mới<b>{{ d.created }} việc</b></span>
          </div>
        </li>
      </ol>
    </div>

    <div class="visually-hidden">
    <table>
      <caption>Việc tạo mới và hoàn tất mỗi ngày</caption>
      <thead><tr><th>Ngày</th><th>Tạo mới</th><th>Hoàn tất</th></tr></thead>
      <tbody>
        <tr v-for="d in cols" :key="d.date"><td>{{ d.long }}</td><td>{{ d.created }}</td><td>{{ d.completed }}</td></tr>
      </tbody>
    </table>
    </div>
  </div>
</template>

<style scoped>
.flow {
  --label-h: 2.5rem;
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 12rem;
  padding: 1.25rem 0 0 2rem;
}

.flow__unit {
  position: absolute;
  top: 0;
  left: 0;
  color: var(--ws-text-3);
  font-size: 0.75rem;
  font-weight: 500;
}

.flow__plot {
  position: relative;
  flex: 1;
  min-height: 0;
}

.flow__grid {
  position: absolute;
  inset: 0 0 var(--label-h) 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.flow__line {
  position: relative;
  height: 1px;
  background: var(--ws-border);
}

.flow__line span {
  position: absolute;
  top: 50%;
  right: calc(100% + 0.5rem);
  transform: translateY(-50%);
  color: var(--ws-text-3);
  font-size: 0.78125rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.flow__cols {
  position: absolute;
  inset: 0;
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

.col {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  border-radius: 0.625rem;
  outline-offset: -2px;
}

.col__bars {
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  min-height: 0;
  padding: 0 12%;
  border-radius: 0.625rem 0.625rem 0 0;
  transition: background-color 0.12s ease;
}

.col.is-active .col__bars {
  background: color-mix(in srgb, var(--ws-surface-2) 70%, transparent);
}

.bar {
  flex: 1;
  max-width: 1.375rem;
  min-height: 0;
  border-radius: 4px 4px 0 0;
}

.bar--created {
  background: color-mix(in srgb, var(--ws-text-3) 60%, var(--ws-surface));
}

.bar--done {
  background: var(--ws-accent);
}

/* Ngày bằng 0 vẫn để một vạch mảnh để thấy chuỗi dữ liệu còn đó */
.bar.is-zero {
  height: 2px !important;
  border-radius: 1px;
  opacity: 0.55;
}

.col__label {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: var(--label-h);
  line-height: 1.3;
  white-space: nowrap;
}

.col__label strong {
  color: var(--ws-text-2);
  font-size: 0.8125rem;
  font-weight: 600;
}

.col__label span {
  color: var(--ws-text-3);
  font-size: 0.75rem;
}

.col.is-today .col__label strong {
  color: var(--ws-text);
  font-weight: 700;
}

.col.is-today .col__label span {
  color: var(--ws-accent-text);
  font-weight: 600;
}

.flow--dense .col__bars {
  gap: 1px;
  padding: 0 8%;
}

.flow--dense .bar {
  border-radius: 2px 2px 0 0;
}

.tip {
  position: absolute;
  top: 0.25rem;
  left: calc(100% + 0.25rem);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: max-content;
  min-width: 11.5rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--ws-border-strong);
  border-radius: 0.75rem;
  background: var(--ws-surface);
  box-shadow: var(--ws-shadow);
  font-size: 0.84375rem;
  pointer-events: none;
}

.tip--left {
  right: calc(100% + 0.25rem);
  left: auto;
}

.tip strong {
  margin-bottom: 0.125rem;
  font-size: 0.875rem;
}

.tip span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ws-text-2);
}

.tip b {
  margin-left: auto;
  padding-left: 1rem;
  color: var(--ws-text);
  font-variant-numeric: tabular-nums;
}

.sw {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 3px;
}

.sw--done {
  background: var(--ws-accent);
}

.sw--created {
  background: color-mix(in srgb, var(--ws-text-3) 60%, var(--ws-surface));
}
</style>
