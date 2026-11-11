<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/shared/components/AppIcon.vue'
import FlowBarChart from '../components/FlowBarChart.vue'
import GroupProgress from '../components/GroupProgress.vue'
import PanelCard from '../components/PanelCard.vue'
import StatCard from '../components/StatCard.vue'
import StatusDonut from '../components/StatusDonut.vue'
import {
  attention,
  awaitsMyReview,
  completedBetween,
  countByStatus,
  dailyFlow,
  groupProgress,
  isDueWithin,
  isOverdue,
  LOAD_CAPACITY,
  LOAD_LABELS,
  recentActivity,
  workload,
  type AttentionKind,
} from '../composables/useInsights'
import { useToast } from '../composables/useToast'
import { PRIORITY_SHORT, STATUS_LABELS } from '../data/constants'
import { useGroups } from '../groups/useGroups'
import TaskAvatar from '../tasks/components/TaskAvatar.vue'
import TaskMenu from '../tasks/components/TaskMenu.vue'
import { activityText, daysUntil, formatStamp, fullDate } from '../tasks/taskFormat'
import { useTasks } from '../tasks/taskStore'
import { useTaskActions } from '../tasks/useTaskActions'
import type { Task, TaskStatus } from '../types'
import '../tasks/tasks.css'

const { tasks, projects, meId, projectOf, taskCode, approveTask } = useTasks()
const groups = useGroups()
const actions = useTaskActions()
const toast = useToast()

const pad2 = (n: number) => String(n).padStart(2, '0')
const nameOf = (id: string | null) => (id ? groups.person(id).name : 'Chưa giao')
const projectName = (id: string) => projectOf(id)?.name ?? ''
const taskLink = (t: Task) => ({ name: 'tasks', query: { task: taskCode(t) } })

/* ---------------- Bộ lọc của trang ---------------- */

const RANGES = [7, 14, 30] as const
const range = ref<(typeof RANGES)[number]>(7)
const scope = ref<string | null>(null)

const scopeName = computed(() => projects.find((p) => p.id === scope.value)?.name ?? 'Tất cả nhóm')
const scoped = computed(() => (scope.value ? tasks.value.filter((t) => t.projectId === scope.value) : tasks.value))

/** Liên kết sang Công việc, giữ nguyên phạm vi nhóm đang chọn. */
const tasksLink = (query: Record<string, string>) => ({ name: 'tasks', query: { ...query, ...(scope.value ? { scope: scope.value } : {}) } })
const statusLink = (status: TaskStatus) => tasksLink({ status })

/* Dữ liệu tính trực tiếp từ kho công việc — ghi lại lúc thay đổi gần nhất */
const updatedAt = ref(new Date())
watch(tasks, () => (updatedAt.value = new Date()), { deep: true })
const updatedLabel = computed(() => `${pad2(updatedAt.value.getHours())}:${pad2(updatedAt.value.getMinutes())}`)

/* ---------------- Chỉ số ---------------- */

const counts = computed(() => countByStatus(scoped.value))
const done = computed(() => completedBetween(scoped.value, -(range.value - 1), 0))
const doneDelta = computed(() => done.value - completedBetween(scoped.value, -(2 * range.value - 1), -range.value))
const doingSoon = computed(() => scoped.value.filter((t) => t.status === 'doing' && isDueWithin(t, 2)).length)
const myReviews = computed(() => scoped.value.filter((t) => awaitsMyReview(t, meId.value)).length)
const overdue = computed(() => scoped.value.filter(isOverdue).sort((a, b) => a.due.localeCompare(b.due)))

const deltaHint = computed(() => {
  const d = doneDelta.value
  if (d > 0) return { text: `+${d} so với ${range.value} ngày trước`, tone: 'success' as const, icon: 'arrow-up' as const }
  if (d < 0) return { text: `${d} so với ${range.value} ngày trước`, tone: 'warning' as const, icon: 'arrow-down' as const }
  return { text: `Bằng ${range.value} ngày trước`, tone: 'muted' as const, icon: 'circle-check' as const }
})

/* ---------------- Biểu đồ ---------------- */

const flow = computed(() => dailyFlow(scoped.value, range.value))
const created = computed(() => flow.value.reduce((s, d) => s + d.created, 0))
const completed = computed(() => flow.value.reduce((s, d) => s + d.completed, 0))

const insight = computed(() => {
  if (!created.value && !completed.value) return null
  if (created.value > completed.value)
    return {
      tone: 'warn',
      icon: 'alert' as const,
      title: 'Việc đang dồn lại',
      text: `Tạo mới ${created.value} việc nhưng mới hoàn tất ${completed.value}.`,
    }
  return {
    tone: 'good',
    icon: 'circle-check' as const,
    title: 'Đang theo kịp',
    text: `Hoàn tất ${completed.value} việc, tạo mới ${created.value}.`,
  }
})

/* ---------------- Nhóm · Thành viên ---------------- */

// Luôn hiện đủ các nhóm để so sánh; nhóm ngoài phạm vi vẫn tính trên toàn bộ việc
const progressRows = computed(() => groupProgress(tasks.value, scope.value ? projects.filter((p) => p.id === scope.value) : projects))
const groupLink = (projectId: string) => ({ name: 'tasks', query: { scope: projectId } })

const loads = computed(() => workload(scoped.value).slice(0, 5))
const loadTotal = computed(() => workload(scoped.value).length)

/* ---------------- Cần chú ý · Hoạt động ---------------- */

const tab = ref<'attention' | 'activity'>('attention')
const MAX_ITEMS = 4
const allAttention = computed(() => attention(scoped.value, meId.value))
const attentionItems = computed(() => allAttention.value.slice(0, MAX_ITEMS))
const activityItems = computed(() => recentActivity(scoped.value, 6))

const KIND_ICON: Record<AttentionKind, 'alert' | 'clock' | 'shield'> = { overdue: 'alert', today: 'clock', review: 'shield' }

function kindLabel(kind: AttentionKind, task: Task): string {
  if (kind === 'overdue') return `Quá hạn ${-daysUntil(task.due)} ngày`
  if (kind === 'today') return task.time ? `Đến hạn hôm nay, ${task.time}` : 'Đến hạn hôm nay'
  return 'Chờ bạn duyệt'
}

function approve(task: Task): void {
  actions.undoable(`Đã duyệt ${taskCode(task)} và chuyển sang ${STATUS_LABELS.done}.`, () => approveTask(task.id).ok)
}

/* ---------------- Xuất báo cáo (CSV mở được bằng Excel) ---------------- */

function exportCsv(): void {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const head = ['Mã', 'Tên công việc', 'Nhóm', 'Trạng thái', 'Ưu tiên', 'Người phụ trách', 'Hạn chót', 'Hoàn tất lúc']
  const rows = scoped.value.map((t) => [
    taskCode(t),
    t.title,
    projectName(t.projectId),
    STATUS_LABELS[t.status],
    PRIORITY_SHORT[t.priority],
    nameOf(t.assigneeId),
    fullDate(t.due),
    t.completedAt ? fullDate(t.completedAt.slice(0, 10)) : '',
  ])
  // BOM để Excel nhận đúng tiếng Việt
  const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `taskflow-thong-ke-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.show(`Đã xuất ${rows.length} công việc (${scopeName.value}).`)
}
</script>

<template>
  <div class="ws-page reports">
    <header class="ws-page-header">
      <div>
        <p class="ws-eyebrow reports__live"><i aria-hidden="true" />Cập nhật trực tiếp · lần cuối lúc {{ updatedLabel }}</p>
        <h1 class="ws-title">Thống kê</h1>
        <p class="ws-subtitle">Nhìn nhanh tiến độ của cả đội và biết ngay việc nào cần chú ý.</p>
      </div>

      <div class="reports__controls">
        <TaskMenu>
          <template #trigger="{ toggle, open }">
            <button type="button" class="ctl" :class="{ 'is-set': scope }" :aria-expanded="open" data-test="report-scope" @click="toggle">
              <AppIcon name="users" :size="18" />
              <span>Phạm vi:</span>
              <strong>{{ scopeName }}</strong>
              <AppIcon name="chevron-down" :size="16" />
            </button>
          </template>
          <template #default="{ close }">
            <button type="button" class="tk-menu__item" role="menuitemradio" :aria-checked="!scope" @click="scope = null; close()">
              Tất cả nhóm
              <AppIcon v-if="!scope" name="check" :size="16" class="tk-menu__check" />
            </button>
            <button
              v-for="p in projects"
              :key="p.id"
              type="button"
              class="tk-menu__item"
              role="menuitemradio"
              :aria-checked="scope === p.id"
              @click="scope = p.id; close()"
            >
              <i class="ws-dot" :style="{ color: p.color }" />
              {{ p.name }}
              <AppIcon v-if="scope === p.id" name="check" :size="16" class="tk-menu__check" />
            </button>
          </template>
        </TaskMenu>

        <div class="range" role="group" aria-label="Khoảng thời gian">
          <button
            v-for="r in RANGES"
            :key="r"
            type="button"
            class="range__btn"
            :class="{ 'is-on': range === r }"
            :aria-pressed="range === r"
            :data-test="`report-range-${r}`"
            @click="range = r"
          >
            {{ r }} ngày
          </button>
        </div>

        <button type="button" class="ctl ctl--action" :disabled="!scoped.length" @click="exportCsv">
          <AppIcon name="download" :size="18" />
          <strong>Xuất báo cáo</strong>
        </button>
      </div>
    </header>

    <section class="reports__stats" aria-label="Chỉ số chính">
      <StatCard
        :label="`Hoàn tất trong ${range} ngày`"
        :value="pad2(done)"
        :unit="`trên ${scoped.length} việc`"
        :hint="deltaHint.text"
        :hint-icon="deltaHint.icon"
        :tone="deltaHint.tone"
        icon="circle-check"
        icon-tone="success"
        :to="statusLink('done')"
      />
      <StatCard
        label="Đang làm"
        :value="pad2(counts.doing)"
        unit="việc"
        :hint="doingSoon ? `${doingSoon} việc đến hạn trong 2 ngày tới` : 'Chưa có việc nào sát hạn'"
        :hint-icon="doingSoon ? 'clock' : 'circle-check'"
        :tone="doingSoon ? 'warning' : 'muted'"
        icon="activity"
        :to="statusLink('doing')"
      />
      <StatCard
        label="Chờ duyệt"
        :value="pad2(counts.review)"
        unit="việc"
        :hint="myReviews ? `${myReviews} việc đang chờ bạn duyệt` : 'Không có việc nào chờ bạn'"
        hint-icon="user"
        :tone="myReviews ? 'accent' : 'muted'"
        icon="shield"
        icon-tone="info"
        :to="statusLink('review')"
      />
      <StatCard
        label="Quá hạn"
        :value="pad2(overdue.length)"
        unit="việc"
        :hint="overdue[0]?.title ?? 'Mọi việc đều đúng hạn'"
        :hint-icon="overdue.length ? 'chevron-right' : 'circle-check'"
        :tone="overdue.length ? 'danger' : 'success'"
        icon="alert"
        :icon-tone="overdue.length ? 'danger' : 'muted'"
        :to="overdue[0] ? taskLink(overdue[0]) : undefined"
      />
    </section>

    <div class="reports__row reports__row--main">
      <PanelCard title="Việc hoàn tất mỗi ngày" :subtitle="`${range} ngày gần nhất · ${scopeName.toLowerCase()}`">
        <template #actions>
          <div v-if="insight" class="insight" :class="`insight--${insight.tone}`">
            <AppIcon :name="insight.icon" :size="20" />
            <p><strong>{{ insight.title }}</strong>{{ insight.text }}</p>
          </div>
        </template>
        <ul class="reports__legend" aria-hidden="true">
          <li><i class="sw sw--done" />Hoàn tất</li>
          <li><i class="sw sw--created" />Tạo mới</li>
        </ul>
        <FlowBarChart :days="flow" />
      </PanelCard>

      <PanelCard title="Tình trạng công việc" :subtitle="`${scoped.length} việc đang theo dõi`">
        <StatusDonut :counts="counts" center="total" percent :to="statusLink" hint="Bấm vào một dòng để mở danh sách đã lọc." />
      </PanelCard>
    </div>

    <div class="reports__row reports__row--three">
      <PanelCard title="Tiến độ theo nhóm">
        <GroupProgress :rows="progressRows" :to="groupLink" />
      </PanelCard>

      <PanelCard title="Khối lượng thành viên" :subtitle="`Số việc chưa hoàn tất của mỗi người · ${LOAD_CAPACITY} việc là đầy`">
        <p v-if="!loads.length" class="reports__empty">Không ai còn việc đang mở trong phạm vi này.</p>
        <ul v-else class="load">
          <li v-for="row in loads" :key="row.personId" class="load__row" :class="`load--${row.level}`">
            <TaskAvatar :id="row.personId" :size="32" />
            <div class="load__who">
              <strong>{{ nameOf(row.personId) }}<template v-if="row.personId === meId"> (bạn)</template></strong>
              <span>{{ row.open }} việc đang mở<template v-if="row.overdue"> · {{ row.overdue }} quá hạn</template></span>
            </div>
            <div class="load__cells" role="img" :aria-label="`${row.open} trên ${LOAD_CAPACITY} việc`">
              <i v-for="n in LOAD_CAPACITY" :key="n" :class="{ 'is-on': n <= row.open }" />
              <b v-if="row.open > LOAD_CAPACITY">+{{ row.open - LOAD_CAPACITY }}</b>
            </div>
            <span class="load__tag">{{ LOAD_LABELS[row.level] }}</span>
          </li>
        </ul>
        <p v-if="loadTotal > loads.length" class="reports__foot">và {{ loadTotal - loads.length }} thành viên khác ít việc hơn</p>
      </PanelCard>

      <section class="panel-tabs">
        <div class="tabs" role="tablist" aria-label="Theo dõi">
          <button id="tab-attention" type="button" role="tab" class="tabs__btn" :class="{ 'is-on': tab === 'attention' }" :aria-selected="tab === 'attention'" aria-controls="pane-attention" @click="tab = 'attention'">
            Cần chú ý
            <span v-if="allAttention.length" class="tabs__count">{{ allAttention.length }}</span>
          </button>
          <button id="tab-activity" type="button" role="tab" class="tabs__btn" :class="{ 'is-on': tab === 'activity' }" :aria-selected="tab === 'activity'" aria-controls="pane-activity" @click="tab = 'activity'">
            Hoạt động gần đây
          </button>
        </div>

        <div v-if="tab === 'attention'" id="pane-attention" role="tabpanel" aria-labelledby="tab-attention" class="pane">
          <div v-if="!attentionItems.length" class="reports__empty reports__empty--good">
            <AppIcon name="circle-check" :size="28" />
            <p>Không có việc nào quá hạn, sát hạn hay chờ bạn duyệt.</p>
          </div>
          <ul v-else class="att">
            <li v-for="item in attentionItems" :key="item.task.id" class="att__row" :class="`att--${item.kind}`">
              <span class="att__icon"><AppIcon :name="KIND_ICON[item.kind]" :size="20" /></span>
              <div class="att__text">
                <span class="att__kind">{{ kindLabel(item.kind, item.task) }}</span>
                <RouterLink :to="taskLink(item.task)" class="att__title"><b>{{ taskCode(item.task) }}</b>{{ item.task.title }}</RouterLink>
                <span class="att__meta"><TaskAvatar :id="item.task.assigneeId" :size="16" />{{ nameOf(item.task.assigneeId) }} · {{ projectName(item.task.projectId) }}</span>
              </div>
              <button v-if="awaitsMyReview(item.task, meId)" type="button" class="att__btn att__btn--primary" @click="approve(item.task)">Duyệt</button>
              <RouterLink v-else :to="taskLink(item.task)" class="att__btn" :aria-label="`Mở ${taskCode(item.task)}`">Mở</RouterLink>
            </li>
          </ul>
          <RouterLink v-if="allAttention.length > attentionItems.length" :to="tasksLink({})" class="reports__foot reports__foot--link">
            Xem thêm {{ allAttention.length - attentionItems.length }} việc trong Công việc
          </RouterLink>
        </div>

        <div v-else id="pane-activity" role="tabpanel" aria-labelledby="tab-activity" class="pane">
          <p v-if="!activityItems.length" class="reports__empty">Chưa có hoạt động nào.</p>
          <ul v-else class="feed">
            <li v-for="a in activityItems" :key="`${a.task.id}-${a.id}`" class="feed__row">
              <TaskAvatar :id="a.actorId" :size="28" />
              <p>
                <strong>{{ nameOf(a.actorId) }}</strong> {{ activityText(a, nameOf, projectName) }}
                <RouterLink :to="taskLink(a.task)">{{ taskCode(a.task) }} · {{ a.task.title }}</RouterLink>
              </p>
              <time :datetime="a.at">{{ formatStamp(a.at) }}</time>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* ----- Đầu trang ----- */
.reports__live {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reports__live i {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: var(--ws-online);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ws-online) 25%, transparent);
}

.reports__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
}

.ctl {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.875rem;
  padding: 0 0.875rem;
  border: 1px solid var(--ws-border-strong);
  border-radius: 0.75rem;
  background: var(--ws-surface-2);
  color: var(--ws-text-2);
  font: inherit;
  font-size: 0.875rem;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ctl strong {
  color: var(--ws-text);
  font-weight: 600;
}

.ctl:hover:not(:disabled) {
  background: var(--ws-surface-3);
}

.ctl:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ctl.is-set {
  border-color: var(--ws-accent);
}

.ctl--action {
  color: var(--ws-text);
}

.range {
  display: inline-flex;
  height: 2.875rem;
  padding: 0.25rem;
  border: 1px solid var(--ws-border-strong);
  border-radius: 0.75rem;
  background: var(--ws-surface-2);
}

.range__btn {
  padding: 0 0.875rem;
  border: 1px solid transparent;
  border-radius: 0.5625rem;
  background: none;
  color: var(--ws-text-2);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.range__btn:hover {
  color: var(--ws-text);
}

.range__btn.is-on {
  border-color: var(--ws-accent);
  background: var(--ws-accent-soft);
  color: var(--ws-text);
  font-weight: 600;
}

/* ----- Bố cục ----- */
.reports__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ws-gap);
}

.reports__row {
  display: grid;
  gap: var(--ws-gap);
}

.reports__row--main {
  grid-template-columns: minmax(0, 1.85fr) minmax(0, 1fr);
}

.reports__row--main > :first-child {
  min-height: clamp(18rem, 32vh, 22rem);
}

.reports__row--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.reports__legend {
  display: flex;
  gap: 1.25rem;
  margin: -0.5rem 0 0.5rem;
  padding: 0;
  color: var(--ws-text-2);
  font-size: 0.875rem;
  font-weight: 500;
  list-style: none;
}

.reports__legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.sw {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 3px;
}

.sw--done {
  background: var(--ws-accent);
}

.sw--created {
  background: color-mix(in srgb, var(--ws-text-3) 60%, var(--ws-surface));
}

.insight {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 24rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--tone) 14%, transparent);
}

.insight--warn {
  --tone: var(--ws-warning);
}

.insight--good {
  --tone: var(--ws-success);
}

.insight svg {
  flex: none;
  color: var(--tone);
}

.insight p {
  margin: 0;
  font-size: 0.84375rem;
  line-height: 1.4;
}

.insight strong {
  display: block;
  color: var(--tone);
  font-size: 0.90625rem;
}

.reports__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin: 0;
  padding: 1.5rem 0;
  color: var(--ws-text-2);
  font-size: 0.9375rem;
  text-align: center;
}

.reports__empty p {
  margin: 0;
}

.reports__empty--good svg {
  color: var(--ws-success);
}

.reports__foot {
  margin: 0.75rem 0 0;
  color: var(--ws-text-3);
  font-size: 0.8125rem;
}

.reports__foot--link {
  color: var(--ws-accent-text);
  font-weight: 600;
  text-decoration: none;
}

.reports__foot--link:hover {
  text-decoration: underline;
}

/* ----- Khối lượng thành viên ----- */
.load {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.load__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 4.75rem;
  align-items: center;
  gap: 0.75rem;
}

.load--over {
  --tone: var(--ws-danger);
}

.load--near {
  --tone: var(--ws-warning);
}

.load--ok,
.load--free {
  --tone: var(--ws-success);
}

.load__who {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  min-width: 0;
}

.load__who strong {
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.load__who span {
  overflow: hidden;
  color: var(--ws-text-3);
  font-size: 0.78125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.load__cells {
  display: flex;
  align-items: center;
  gap: 3px;
}

.load__cells i {
  width: 1.125rem;
  height: 0.875rem;
  border-radius: 4px;
  background: var(--ws-surface-3);
}

.load__cells i.is-on {
  background: var(--tone);
}

.load__cells b {
  margin-left: 0.125rem;
  color: var(--tone);
  font-size: 0.75rem;
}

.load__tag {
  justify-self: end;
  padding: 0.1875rem 0.5625rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  color: var(--tone);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ----- Cần chú ý / Hoạt động ----- */
.panel-tabs {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--ws-border);
  border-radius: var(--ws-radius);
  background: var(--ws-surface);
}

.tabs {
  display: flex;
  gap: 1.5rem;
  padding: 0 clamp(1.125rem, 1.4vw, 1.5rem);
  border-bottom: 1px solid var(--ws-border);
}

.tabs__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 3.5rem;
  margin-bottom: -1px;
  padding: 0;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: var(--ws-text-2);
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
}

.tabs__btn:hover {
  color: var(--ws-text);
}

.tabs__btn.is-on {
  border-bottom-color: var(--ws-accent);
  color: var(--ws-text);
  font-size: 1.0625rem;
  font-weight: 700;
}

.tabs__count {
  display: grid;
  place-items: center;
  min-width: 1.5rem;
  height: 1.375rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ws-danger) 16%, transparent);
  color: var(--ws-danger);
  font-size: 0.78125rem;
  font-weight: 700;
}

.pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0.75rem;
}

.att {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.att__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.875rem;
  background: var(--tk-cell);
}

.att--overdue {
  --tone: var(--ws-danger);
}

.att--today {
  --tone: var(--ws-warning);
}

.att--review {
  --tone: var(--ws-info);
}

.att__icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--tone) 16%, transparent);
  color: var(--tone);
}

.att__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.att__kind {
  color: var(--tone);
  font-size: 0.78125rem;
  font-weight: 700;
}

.att__title {
  overflow: hidden;
  color: var(--ws-text);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att__title b {
  margin-right: 0.5rem;
  color: var(--ws-text-3);
  font-size: 0.8125rem;
  font-weight: 600;
}

.att__title:hover {
  color: var(--ws-accent-text);
}

.att__meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  overflow: hidden;
  color: var(--ws-text-2);
  font-size: 0.78125rem;
  white-space: nowrap;
}

.att__btn {
  display: inline-grid;
  place-items: center;
  height: 2rem;
  padding: 0 0.875rem;
  border: 1px solid var(--ws-border-strong);
  border-radius: 0.5625rem;
  background: var(--ws-surface-2);
  color: var(--ws-text);
  font: inherit;
  font-size: 0.84375rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.att__btn:hover {
  background: var(--ws-surface-3);
}

.att__btn--primary {
  border-color: transparent;
  background: var(--ws-accent-grad);
  color: var(--ws-on-accent);
}

.att__btn--primary:hover {
  background: var(--ws-accent-grad);
  filter: brightness(1.08);
}

.feed {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0 0.375rem;
  list-style: none;
}

.feed__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  padding: 0.5625rem 0;
}

.feed__row + .feed__row {
  border-top: 1px solid var(--ws-border);
}

.feed__row p {
  margin: 0;
  color: var(--ws-text-2);
  font-size: 0.84375rem;
  line-height: 1.45;
}

.feed__row strong {
  color: var(--ws-text);
}

.feed__row a {
  display: block;
  overflow: hidden;
  color: var(--ws-accent-text);
  font-weight: 500;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed__row a:hover {
  text-decoration: underline;
}

.feed__row time {
  color: var(--ws-text-3);
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 90rem) {
  .reports__row--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reports__row--three > :last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 80rem) {
  .reports__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reports__row--main {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 56rem) {
  .reports__row--three {
    grid-template-columns: minmax(0, 1fr);
  }

  .insight {
    display: none;
  }
}

@media (max-width: 30rem) {
  .reports__stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .load__row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .load__cells {
    display: none;
  }
}
</style>
