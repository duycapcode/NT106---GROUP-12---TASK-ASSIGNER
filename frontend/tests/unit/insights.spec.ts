import { beforeEach, describe, expect, it } from 'vitest'
import {
  attention,
  completedBetween,
  countByStatus,
  dailyFlow,
  groupProgress,
  loadLevel,
  myPriorities,
  workload,
} from '@/features/workspace/composables/useInsights'
import { __resetGroups } from '@/features/workspace/groups/useGroups'
import { dayFromToday } from '@/features/workspace/tasks/taskFormat'
import { __resetTasks, useTasks } from '@/features/workspace/tasks/taskStore'
import { useTaskView } from '@/features/workspace/tasks/useTaskView'

let s: ReturnType<typeof useTasks>

beforeEach(() => {
  __resetGroups({ aiDelay: 0 })
  __resetTasks()
  s = useTasks()
  useTaskView().clearFilters()
})

describe('Số liệu Tổng quan / Thống kê', () => {
  it('đếm theo trạng thái và tiến độ từng nhóm khớp dữ liệu mẫu', () => {
    expect(countByStatus(s.tasks.value)).toEqual({ todo: 8, doing: 6, review: 3, done: 7 })
    const rows = groupProgress(s.tasks.value, s.projects)
    expect(rows.map((r) => r.total).reduce((a, b) => a + b, 0)).toBe(24)
    for (const r of rows) {
      expect(r.counts.todo + r.counts.doing + r.counts.review + r.counts.done).toBe(r.total)
      expect(r.progress).toBeCloseTo(r.total ? r.counts.done / r.total : 0)
    }
    expect(rows.find((r) => r.project.id === 'design')!.overdue).toBe(1)
  })

  it('dòng chảy theo ngày: phần tử cuối là hôm nay, tổng hoàn tất khớp completedBetween', () => {
    const flow = dailyFlow(s.tasks.value, 7)
    expect(flow).toHaveLength(7)
    expect(flow[6].date).toBe(dayFromToday(0))
    expect(flow.reduce((n, d) => n + d.completed, 0)).toBe(completedBetween(s.tasks.value, -6, 0))
  })

  it('hoàn tất một việc hôm nay thì cột hôm nay tăng 1', () => {
    const before = dailyFlow(s.tasks.value, 7)[6].completed
    const open = s.tasks.value.find((t) => t.status === 'todo')!
    s.setStatus(open.id, 'done')
    expect(dailyFlow(s.tasks.value, 7)[6].completed).toBe(before + 1)
  })

  it('mức tải: 5 việc là quá tải, 4 là gần đầy', () => {
    expect([0, 1, 3, 4, 5, 8].map(loadLevel)).toEqual(['free', 'ok', 'ok', 'near', 'over', 'over'])
    const rows = workload(s.tasks.value)
    expect(rows.every((r, i) => i === 0 || rows[i - 1].open >= r.open)).toBe(true)
    expect(rows.reduce((n, r) => n + r.open, 0)).toBe(s.tasks.value.filter((t) => t.assigneeId && t.status !== 'done').length)
  })

  it('cần chú ý: quá hạn đứng trước, mỗi việc chỉ một lần; ưu tiên của tôi gồm việc chờ tôi duyệt', () => {
    const me = s.meId.value
    const items = attention(s.tasks.value, me)
    expect(items[0].kind).toBe('overdue')
    expect(new Set(items.map((i) => i.task.id)).size).toBe(items.length)
    const mine = myPriorities(s.tasks.value, me)
    expect(mine.some((t) => t.key === 128)).toBe(true)
    expect(mine.every((t) => t.status !== 'done')).toBe(true)
    // TF-145 quá hạn và chờ tôi duyệt nên đứng đầu
    expect(mine[0].key).toBe(145)
  })

  it('bộ lọc trạng thái ở Công việc', () => {
    const v = useTaskView()
    v.filters.status = 'review'
    expect(v.filtered.value).toHaveLength(3)
    expect(v.filtersActive.value).toBe(true)
    v.clearFilters()
    expect(v.filters.status).toBeNull()
    expect(v.filtered.value).toHaveLength(24)
  })
})
