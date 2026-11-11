<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/shared/components/AppIcon.vue'
import BaseButton from '@/shared/components/BaseButton.vue'
import { useCalendar } from '../calendar/useCalendar'
import CreateTaskModal from '../components/CreateTaskModal.vue'
import GroupProgress from '../components/GroupProgress.vue'
import PanelCard from '../components/PanelCard.vue'
import StatCard from '../components/StatCard.vue'
import StatusDonut from '../components/StatusDonut.vue'
import {
  awaitsMyReview,
  completedBetween,
  countByStatus,
  groupProgress,
  isDueWithin,
  isOpen,
  isOverdue,
  myPriorities,
  needsMe,
} from '../composables/useInsights'
import { useProfile } from '../composables/useProfile'
import { useWorkspace } from '../composables/useWorkspace'
import { STATUS_LABELS } from '../data/constants'
import DueChip from '../tasks/components/DueChip.vue'
import PriorityBadge from '../tasks/components/PriorityBadge.vue'
import StatusPill from '../tasks/components/StatusPill.vue'
import { dayFromToday } from '../tasks/taskFormat'
import { useTasks } from '../tasks/taskStore'
import { useTaskActions } from '../tasks/useTaskActions'
import type { Task, TaskStatus } from '../types'
import { formatToday, greeting } from '../utils/format'
import '../tasks/tasks.css'

const { firstName } = useProfile()
const { unreadCount } = useWorkspace()
const { tasks, projects, meId, projectOf, taskCode, approveTask } = useTasks()
const { eventsOn } = useCalendar()
const actions = useTaskActions()

const creating = ref(false)
const pad2 = (n: number) => String(n).padStart(2, '0')
const taskLink = (t: Task) => ({ name: 'tasks', query: { task: taskCode(t) } })

/* ---------------- Chỉ số ---------------- */

const mine = computed(() => tasks.value.filter((t) => t.assigneeId === meId.value))
const myOpen = computed(() => mine.value.filter(isOpen))
const myOverdue = computed(() => myOpen.value.filter(isOverdue).length)
const myDueSoon = computed(() => myOpen.value.filter((t) => isDueWithin(t, 2)).length)
const myDueToday = computed(() => myOpen.value.filter((t) => isDueWithin(t, 0)).length)
// Việc gấp nhất (hạn sớm nhất) lên đầu để thẻ chỉ số dẫn đúng việc cần duyệt trước
const reviews = computed(() => tasks.value.filter((t) => awaitsMyReview(t, meId.value)).sort((a, b) => a.due.localeCompare(b.due)))

const doneWeek = computed(() => completedBetween(mine.value, -6, 0))
const doneDelta = computed(() => doneWeek.value - completedBetween(mine.value, -13, -7))

const openHint = computed(() => {
  if (myOverdue.value) return { text: `${myOverdue.value} việc đã quá hạn`, tone: 'danger' as const, icon: 'alert' as const }
  if (myDueSoon.value) return { text: `${myDueSoon.value} việc đến hạn trong 2 ngày tới`, tone: 'warning' as const, icon: 'clock' as const }
  return { text: 'Không có việc nào sắp đến hạn', tone: 'muted' as const, icon: 'circle-check' as const }
})

const deltaHint = computed(() => {
  const d = doneDelta.value
  if (d > 0) return { text: `+${d} so với 7 ngày trước`, tone: 'success' as const, icon: 'arrow-up' as const }
  if (d < 0) return { text: `${d} so với 7 ngày trước`, tone: 'warning' as const, icon: 'arrow-down' as const }
  return { text: 'Bằng 7 ngày trước', tone: 'muted' as const, icon: 'circle-check' as const }
})

const subtitle = computed(() => {
  const parts: string[] = []
  if (reviews.value.length) parts.push(`${reviews.value.length} việc cần duyệt`)
  if (myOverdue.value) parts.push(`${myOverdue.value} việc quá hạn`)
  if (myDueToday.value) parts.push(`${myDueToday.value} việc đến hạn`)
  if (!parts.length) return 'Hôm nay không có việc gấp. Xem trước hạn chót trong tuần để chủ động hơn.'
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} và ${parts[parts.length - 1]}` : parts[0]
  return `Hôm nay bạn có ${list}. Bắt đầu từ danh sách ưu tiên bên dưới nhé.`
})

/* ---------------- Hạn chót 7 ngày tới ---------------- */

const MAX_PER_DAY = 2

const week = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const date = dayFromToday(i)
    const [, m, d] = date.split('-').map(Number)
    const dow = new Date(Number(date.slice(0, 4)), m - 1, d).getDay()
    // Việc quá hạn dồn vào cột hôm nay để không bị bỏ sót
    const due = tasks.value
      .filter((t) => needsMe(t, meId.value) && (t.due === date || (i === 0 && isOverdue(t))))
      .sort((a, b) => a.due.localeCompare(b.due))
    const events = eventsOn(date)
    const shownTasks = due.slice(0, MAX_PER_DAY)
    const shownEvents = events.slice(0, MAX_PER_DAY - shownTasks.length)
    return {
      date,
      today: i === 0,
      weekday: dow === 0 ? 'CN' : `T${dow + 1}`,
      // Sang tháng mới thì ghi rõ tháng để khỏi nhầm
      label: i > 0 && d <= i ? `${pad2(d)}/${pad2(m)}` : pad2(d),
      tasks: shownTasks,
      events: shownEvents,
      more: due.length + events.length - shownTasks.length - shownEvents.length,
      total: due.length + events.length,
    }
  }),
)

const splitTitle = (t: Task) => (awaitsMyReview(t, meId.value) ? `Duyệt: ${t.title}` : t.title)

/* ---------------- Việc của tôi theo trạng thái ---------------- */

const myCounts = computed(() => countByStatus(mine.value))
const myStatusLink = (status: TaskStatus) => ({ name: 'tasks', query: { status, mine: '1' } })

/* ---------------- Ưu tiên hôm nay ---------------- */

const MAX_PRIORITIES = 5
const allPriorities = computed(() => myPriorities(tasks.value, meId.value))
const priorities = computed(() => allPriorities.value.slice(0, MAX_PRIORITIES))

function approve(task: Task): void {
  actions.undoable(`Đã duyệt ${taskCode(task)} và chuyển sang ${STATUS_LABELS.done}.`, () => approveTask(task.id).ok)
}

/* ---------------- Tiến độ theo nhóm ---------------- */

const progressRows = computed(() => groupProgress(tasks.value, projects))
const groupLink = (projectId: string) => ({ name: 'tasks', query: { scope: projectId } })
</script>

<template>
  <div class="ws-page overview">
    <header class="ws-page-header">
      <div>
        <p class="ws-eyebrow">{{ formatToday() }} · Không gian làm việc</p>
        <h1 class="ws-title">{{ greeting() }}, {{ firstName }}</h1>
        <p class="ws-subtitle">{{ subtitle }}</p>
      </div>
      <BaseButton class="ws-btn-auto overview__create" @click="creating = true">
        <AppIcon name="plus" :size="18" :stroke-width="2.5" />
        Tạo công việc
      </BaseButton>
    </header>

    <section class="overview__stats" aria-label="Chỉ số chính">
      <StatCard
        label="Việc của tôi"
        :value="pad2(myOpen.length)"
        unit="đang mở"
        :hint="openHint.text"
        :hint-icon="openHint.icon"
        :tone="openHint.tone"
        icon="check-square"
        :to="{ name: 'tasks', query: { mine: '1' } }"
      />
      <StatCard
        label="Hoàn tất 7 ngày qua"
        :value="pad2(doneWeek)"
        unit="việc"
        :hint="deltaHint.text"
        :hint-icon="deltaHint.icon"
        :tone="deltaHint.tone"
        icon="circle-check"
        icon-tone="success"
        :to="myStatusLink('done')"
      />
      <StatCard
        label="Chờ bạn duyệt"
        :value="pad2(reviews.length)"
        unit="việc"
        :hint="reviews[0]?.title ?? 'Không có việc nào chờ duyệt'"
        :hint-icon="reviews.length ? 'chevron-right' : 'circle-check'"
        :tone="reviews.length ? 'accent' : 'muted'"
        icon="shield"
        icon-tone="info"
        :to="reviews[0] ? taskLink(reviews[0]) : { name: 'tasks', query: { status: 'review' } }"
      />
      <StatCard
        label="Nhóm của tôi"
        :value="pad2(projects.length)"
        unit="nhóm"
        :hint="unreadCount ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'"
        hint-icon="message"
        :tone="unreadCount ? 'accent' : 'muted'"
        icon="users"
        :to="{ name: 'team' }"
      />
    </section>

    <div class="overview__row">
      <PanelCard title="Hạn chót 7 ngày tới" subtitle="Việc của bạn và lịch họp, xếp theo ngày">
        <template #actions>
          <RouterLink :to="{ name: 'calendar' }" class="overview__more">Mở Lịch <AppIcon name="chevron-right" :size="16" /></RouterLink>
        </template>

        <ol class="week ws-scroll">
          <li v-for="day in week" :key="day.date" class="day" :class="{ 'is-today': day.today }">
            <RouterLink
              :to="{ name: 'calendar', query: { date: day.date } }"
              class="day__head"
              :aria-label="`${day.weekday} ${day.label}${day.today ? ', hôm nay' : ''}: ${day.total} mục. Mở trong Lịch`"
            >
              <span class="day__dow">{{ day.weekday }}</span>
              <span v-if="day.today" class="day__tag">Hôm nay</span>
              <strong class="day__num">{{ day.label }}</strong>
            </RouterLink>

            <p v-if="!day.total" class="day__empty">Trống</p>

            <RouterLink
              v-for="t in day.tasks"
              :key="t.id"
              :to="taskLink(t)"
              class="entry"
              :style="{ '--c': projectOf(t.projectId)?.color }"
              :title="`${taskCode(t)} · ${t.title} · ${projectOf(t.projectId)?.name ?? ''}`"
            >
              <span class="entry__title">{{ splitTitle(t) }}</span>
              <span v-if="isOverdue(t)" class="entry__meta entry__meta--late"><AppIcon name="alert" :size="12" :stroke-width="2.4" />Quá hạn</span>
              <span v-else class="entry__meta"><i class="tk-dot" :class="`tk-dot--${t.status}`" />{{ STATUS_LABELS[t.status] }}</span>
            </RouterLink>

            <RouterLink
              v-for="ev in day.events"
              :key="ev.id"
              :to="{ name: 'calendar', query: { date: day.date } }"
              class="entry entry--event"
              :title="`${ev.title} · ${ev.start}–${ev.end}`"
            >
              <span class="entry__title">{{ ev.title }}</span>
              <span class="entry__meta"><AppIcon name="calendar" :size="12" />{{ ev.start }}–{{ ev.end }}</span>
            </RouterLink>

            <RouterLink v-if="day.more > 0" :to="{ name: 'calendar', query: { date: day.date } }" class="day__more">+{{ day.more }} mục nữa</RouterLink>
          </li>
        </ol>
      </PanelCard>

      <PanelCard title="Việc của tôi" :subtitle="`${mine.length} việc được giao cho bạn, theo trạng thái`">
        <StatusDonut :counts="myCounts" :to="myStatusLink" hint="Bấm vào một dòng để mở danh sách đã lọc." />
      </PanelCard>
    </div>

    <div class="overview__row">
      <PanelCard title="Ưu tiên hôm nay" subtitle="Việc cần bạn xử lý, xếp theo mức gấp và hạn chót">
        <template #actions>
          <RouterLink :to="{ name: 'tasks', query: { mine: '1' } }" class="overview__more">
            Xem tất cả việc<template v-if="allPriorities.length > priorities.length"> ({{ allPriorities.length }})</template>
            <AppIcon name="chevron-right" :size="16" />
          </RouterLink>
        </template>

        <div v-if="!priorities.length" class="overview__empty">
          <AppIcon name="circle-check" :size="28" />
          <p>Bạn đã xử lý hết việc được giao. Tạo công việc mới để bắt đầu.</p>
        </div>
        <ul v-else class="todo">
          <li v-for="task in priorities" :key="task.id" class="todo__row" :data-test="`priority-${task.key}`">
            <span v-if="awaitsMyReview(task, meId)" class="todo__mark todo__mark--review" aria-hidden="true">
              <AppIcon name="shield" :size="14" />
            </span>
            <button
              v-else
              type="button"
              class="todo__mark"
              :aria-label="`Đánh dấu hoàn tất: ${task.title}`"
              title="Đánh dấu hoàn tất"
              @click="actions.changeStatus(task, 'done')"
            >
              <AppIcon name="check" :size="14" :stroke-width="3" />
            </button>

            <div class="todo__text">
              <RouterLink :to="taskLink(task)" class="todo__title">{{ splitTitle(task) }}</RouterLink>
              <span class="todo__meta">
                <i class="ws-dot" :style="{ color: projectOf(task.projectId)?.color }" />
                {{ projectOf(task.projectId)?.name }}
                <b>{{ taskCode(task) }}</b>
              </span>
            </div>

            <PriorityBadge :priority="task.priority" class="todo__prio" />

            <span v-if="awaitsMyReview(task, meId) && !isOverdue(task)" class="todo__due todo__due--review">
              <AppIcon name="user" :size="14" /> Chờ bạn duyệt
            </span>
            <DueChip v-else :task="task" class="todo__due" />

            <button v-if="awaitsMyReview(task, meId)" type="button" class="todo__approve" @click="approve(task)">
              <AppIcon name="check" :size="15" :stroke-width="2.6" /> Duyệt ngay
            </button>
            <StatusPill v-else :status="task.status" size="sm" class="todo__status" />
          </li>
        </ul>
      </PanelCard>

      <PanelCard title="Tiến độ theo nhóm">
        <GroupProgress :rows="progressRows" :to="groupLink" />
      </PanelCard>
    </div>

    <CreateTaskModal v-model:open="creating" />
  </div>
</template>

<style scoped>
.overview__create :deep(.btn__label) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.overview__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--ws-gap);
}

.overview__row {
  display: grid;
  grid-template-columns: minmax(0, 1.85fr) minmax(0, 1fr);
  gap: var(--ws-gap);
}

.overview__more {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.25rem;
  color: var(--ws-accent-text);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.overview__more:hover {
  text-decoration: underline;
}

.overview__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 0;
  color: var(--ws-text-2);
  font-size: 0.9375rem;
  text-align: center;
}

.overview__empty svg {
  color: var(--ws-success);
}

.overview__empty p {
  margin: 0;
}

/* ----- Dải 7 ngày ----- */
.week {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.day {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
  min-height: 11.5rem;
  padding: 0.5rem;
  border: 1px solid transparent;
  border-radius: 0.875rem;
  background: var(--tk-cell);
}

.day.is-today {
  border-color: var(--ws-accent);
  background: var(--ws-accent-soft);
}

.day__head {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0 0.25rem;
  padding: 0.25rem 0.375rem 0.375rem;
  border-radius: 0.5rem;
  color: var(--ws-text);
  text-decoration: none;
}

.day__head:hover .day__num {
  color: var(--ws-accent-text);
}

.day__dow {
  color: var(--ws-text-3);
  font-size: 0.8125rem;
  font-weight: 700;
}

.day__tag {
  color: var(--ws-accent-text);
  font-size: 0.71875rem;
  font-weight: 700;
  white-space: nowrap;
}

.is-today .day__dow {
  color: var(--ws-accent-text);
}

.day__num {
  grid-column: 1 / -1;
  font-size: 1.375rem;
  line-height: 1.25;
  font-variant-numeric: tabular-nums;
}

.day__empty {
  display: grid;
  flex: 1;
  place-items: center;
  margin: 0;
  color: var(--ws-text-3);
  font-size: 0.8125rem;
}

.entry {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.5rem 0.5rem 0.75rem;
  border-radius: 0.625rem;
  background: var(--ws-surface-2);
  color: var(--ws-text);
  text-decoration: none;
  transition: background-color 0.15s ease;
}

.entry::before {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--c, var(--ws-accent));
  content: '';
}

.entry:hover {
  background: var(--ws-surface-3);
}

.entry--event {
  border: 1px dashed var(--ws-border-strong);
  background: transparent;
}

.entry--event::before {
  display: none;
}

.entry--event:hover {
  background: var(--ws-surface-2);
}

.entry__title {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.78125rem;
  font-weight: 600;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.entry__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  color: var(--ws-text-2);
  font-size: 0.71875rem;
  font-weight: 500;
  white-space: nowrap;
}

.entry__meta .tk-dot {
  width: 0.5rem;
  height: 0.5rem;
}

.entry__meta--late {
  color: var(--ws-danger);
  font-weight: 700;
}

.day__more {
  padding: 0 0.375rem;
  color: var(--ws-accent-text);
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
}

.day__more:hover {
  text-decoration: underline;
}

/* ----- Danh sách ưu tiên ----- */
.todo {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 6.5rem 8.5rem 8.25rem;
  align-items: center;
  gap: 0.875rem;
  min-height: 3.25rem;
  padding: 0.375rem 0.875rem;
  border-radius: 0.75rem;
  background: var(--tk-cell);
}

.todo__mark {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 1.6px solid var(--ws-text-3);
  border-radius: 50%;
  background: transparent;
  color: transparent;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
}

button.todo__mark:hover {
  border-color: var(--st-done);
  background: color-mix(in srgb, var(--st-done) 18%, transparent);
  color: var(--st-done-text);
}

.todo__mark--review {
  border-color: var(--st-review);
  background: color-mix(in srgb, var(--st-review) 16%, transparent);
  color: var(--st-review-text);
  cursor: default;
}

.todo__text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.todo__title {
  overflow: hidden;
  color: var(--ws-text);
  font-size: 0.9375rem;
  font-weight: 600;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo__title:hover {
  color: var(--ws-accent-text);
}

.todo__meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  overflow: hidden;
  color: var(--ws-text-2);
  font-size: 0.78125rem;
  white-space: nowrap;
}

.todo__meta .ws-dot {
  width: 0.5rem;
  height: 0.5rem;
}

.todo__meta b {
  margin-left: 0.25rem;
  color: var(--ws-text-3);
  font-weight: 600;
}

.todo__prio,
.todo__status {
  justify-self: start;
}

.todo__due--review {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  color: var(--st-review-text);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.todo__approve {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: 0.5625rem;
  background: var(--ws-accent-grad);
  color: var(--ws-on-accent);
  font-size: 0.84375rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.todo__approve:hover {
  filter: brightness(1.08);
}

@media (max-width: 90rem) {
  .todo__row {
    grid-template-columns: auto minmax(0, 1fr) 8.5rem 8.25rem;
  }

  .todo__prio {
    display: none;
  }
}

@media (max-width: 80rem) {
  .overview__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .overview__row {
    grid-template-columns: minmax(0, 1fr);
  }

  .todo__row {
    grid-template-columns: auto minmax(0, 1fr) 6.5rem 8.5rem 8.25rem;
  }

  .todo__prio {
    display: inline-flex;
  }
}

@media (max-width: 56rem) {
  /* Dải ngày cuộn ngang thay vì bóp cột */
  .week {
    grid-template-columns: repeat(7, minmax(8.5rem, 1fr));
    padding-bottom: 0.375rem;
    overflow-x: auto;
  }

  .todo__row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .todo__prio,
  .todo__due {
    display: none;
  }
}

@media (max-width: 26rem) {
  .overview__stats {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
