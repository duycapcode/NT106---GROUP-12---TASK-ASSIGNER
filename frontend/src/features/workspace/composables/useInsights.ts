import { STATUS_ORDER } from '../data/constants'
import { daysUntil, dayFromToday } from '../tasks/taskFormat'
import type { Project, Task, TaskStatus } from '../types'
import { todayISO } from '../utils/format'

/* =============================================================
 * Số liệu cho Tổng quan và Thống kê. Toàn hàm thuần (nhận danh sách việc,
 * trả số liệu) để dễ kiểm thử và thay bằng API tổng hợp khi có backend.
 * ============================================================= */

export type StatusCounts = Record<TaskStatus, number>

export const emptyCounts = (): StatusCounts => ({ todo: 0, doing: 0, review: 0, done: 0 })

export function countByStatus(list: Task[]): StatusCounts {
  const counts = emptyCounts()
  for (const t of list) counts[t.status]++
  return counts
}

export const isOpen = (t: Task) => t.status !== 'done'
export const isOverdue = (t: Task) => isOpen(t) && daysUntil(t.due) < 0
/** Còn mở và đến hạn trong `days` ngày tới (tính cả hôm nay). */
export const isDueWithin = (t: Task, days: number) => {
  const d = daysUntil(t.due)
  return isOpen(t) && d >= 0 && d <= days
}

/** Việc cần mình ra tay: được giao mà chưa xong, hoặc đang chờ mình duyệt. */
export const needsMe = (t: Task, me: string) =>
  (t.assigneeId === me && isOpen(t)) || (t.reviewerId === me && t.status === 'review')

export const awaitsMyReview = (t: Task, me: string) => t.reviewerId === me && t.status === 'review'

const localDay = (iso: string | null) => (iso ? todayISO(new Date(iso)) : null)

/** Số việc hoàn tất trong khoảng [from, to] ngày tính từ hôm nay (vd. -6..0 = 7 ngày gần nhất). */
export function completedBetween(list: Task[], from: number, to: number): number {
  const a = dayFromToday(from)
  const b = dayFromToday(to)
  return list.filter((t) => {
    const day = t.status === 'done' ? localDay(t.completedAt) : null
    return !!day && day >= a && day <= b
  }).length
}

export interface DayFlow {
  /** YYYY-MM-DD */
  date: string
  created: number
  completed: number
}

/** Việc tạo mới và hoàn tất mỗi ngày trong `days` ngày gần nhất (phần tử cuối là hôm nay). */
export function dailyFlow(list: Task[], days: number): DayFlow[] {
  const flow: DayFlow[] = Array.from({ length: days }, (_, i) => ({ date: dayFromToday(i - days + 1), created: 0, completed: 0 }))
  const index = new Map(flow.map((d) => [d.date, d]))
  for (const t of list) {
    const created = index.get(localDay(t.createdAt) ?? '')
    if (created) created.created++
    const done = t.status === 'done' ? index.get(localDay(t.completedAt) ?? '') : undefined
    if (done) done.completed++
  }
  return flow
}

export interface GroupProgressRow {
  project: Project
  total: number
  counts: StatusCounts
  overdue: number
  /** Tỷ lệ hoàn tất 0..1 */
  progress: number
}

export function groupProgress(list: Task[], projects: Project[]): GroupProgressRow[] {
  return projects.map((project) => {
    const own = list.filter((t) => t.projectId === project.id)
    const counts = countByStatus(own)
    return { project, total: own.length, counts, overdue: own.filter(isOverdue).length, progress: own.length ? counts.done / own.length : 0 }
  })
}

export type LoadLevel = 'free' | 'ok' | 'near' | 'over'

/** Số việc đang mở một người gánh được trước khi coi là quá tải. */
export const LOAD_CAPACITY = 5

export const LOAD_LABELS: Record<LoadLevel, string> = { free: 'Còn trống', ok: 'Vừa sức', near: 'Gần đầy', over: 'Quá tải' }

export function loadLevel(open: number): LoadLevel {
  if (open >= LOAD_CAPACITY) return 'over'
  if (open === LOAD_CAPACITY - 1) return 'near'
  return open === 0 ? 'free' : 'ok'
}

export interface WorkloadRow {
  personId: string
  open: number
  overdue: number
  level: LoadLevel
}

/** Số việc chưa hoàn tất của từng người (nhiều việc nhất lên trước). */
export function workload(list: Task[]): WorkloadRow[] {
  const rows = new Map<string, WorkloadRow>()
  for (const t of list) {
    if (!t.assigneeId || !isOpen(t)) continue
    const row = rows.get(t.assigneeId) ?? { personId: t.assigneeId, open: 0, overdue: 0, level: 'ok' as LoadLevel }
    row.open++
    if (isOverdue(t)) row.overdue++
    rows.set(t.assigneeId, row)
  }
  return [...rows.values()].map((r) => ({ ...r, level: loadLevel(r.open) })).sort((a, b) => b.open - a.open || b.overdue - a.overdue)
}

export type AttentionKind = 'overdue' | 'today' | 'review'

export interface AttentionItem {
  kind: AttentionKind
  task: Task
}

const ATTENTION_RANK: Record<AttentionKind, number> = { overdue: 0, today: 1, review: 2 }

/** Việc cần để mắt: quá hạn → đến hạn hôm nay → đang chờ mình duyệt. Mỗi việc chỉ xuất hiện một lần. */
export function attention(list: Task[], me: string): AttentionItem[] {
  const items: AttentionItem[] = []
  for (const task of list) {
    if (!isOpen(task)) continue
    const days = daysUntil(task.due)
    if (days < 0) items.push({ kind: 'overdue', task })
    else if (days === 0) items.push({ kind: 'today', task })
    else if (awaitsMyReview(task, me)) items.push({ kind: 'review', task })
  }
  return items.sort((a, b) => ATTENTION_RANK[a.kind] - ATTENTION_RANK[b.kind] || a.task.due.localeCompare(b.task.due))
}

export interface ActivityEntry {
  task: Task
  actorId: string
  at: string
  kind: Task['activity'][number]['kind']
  value?: string | null
  id: string
}

/** Các thay đổi mới nhất trên mọi công việc. */
export function recentActivity(list: Task[], limit = 6): ActivityEntry[] {
  return list
    .flatMap((task) => task.activity.map((a) => ({ ...a, task })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}

/** Việc cần mình xử lý, xếp: chờ mình duyệt & quá hạn trước, rồi theo hạn chót, rồi ưu tiên. */
export function myPriorities(list: Task[], me: string): Task[] {
  const prio = { high: 0, medium: 1, low: 2 } as const
  const urgent = (t: Task) => (isOverdue(t) ? 0 : awaitsMyReview(t, me) ? 1 : 2)
  return list
    .filter((t) => needsMe(t, me))
    .sort((a, b) => urgent(a) - urgent(b) || a.due.localeCompare(b.due) || prio[a.priority] - prio[b.priority])
}

export { STATUS_ORDER }
