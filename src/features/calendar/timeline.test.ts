import type { BillWithStatus } from '@/features/bills/api';
import type { CalendarEvent, Task } from '@/lib/database.types';

import { buildTimeline, dayIndicators, groupTimelineByDate, type TimelineInputs } from './timeline';

function bill(patch: Partial<BillWithStatus> = {}): BillWithStatus {
  return {
    id: 'b1',
    user_id: 'u1',
    name: 'Internet',
    amount_minor: 169_900,
    currency: 'PHP',
    recurrence: 'monthly',
    interval_months: 1,
    anchor_month: null,
    due_day: 15,
    category_id: null,
    account_id: null,
    archived_at: null,
    created_at: '',
    updated_at: '',
    dueDate: '2026-08-15',
    status: 'upcoming',
    payment: null,
    ...patch,
  };
}

function task(patch: Partial<Task> = {}): Task {
  return {
    id: 't1',
    user_id: 'u1',
    title: 'Submit report',
    description: null,
    due_date: '2026-08-15',
    priority: 'medium',
    status: 'todo',
    completed_at: null,
    created_at: '',
    updated_at: '',
    ...patch,
  };
}

function event(patch: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    user_id: 'u1',
    title: 'Standup',
    notes: null,
    kind: 'work',
    event_date: '2026-08-15',
    start_time: '09:00:00',
    end_time: '09:30:00',
    all_day: false,
    created_at: '',
    updated_at: '',
    ...patch,
  };
}

function inputs(patch: Partial<TimelineInputs> = {}): TimelineInputs {
  return {
    bills: [],
    events: [],
    tasks: [],
    recurringIncome: [],
    rangeStart: '2026-08-01',
    rangeEnd: '2026-08-31',
    ...patch,
  };
}

describe('money entries are derived, not stored', () => {
  it('projects a monthly bill onto its due date', () => {
    const t = buildTimeline(inputs({ bills: [bill()] }));
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ date: '2026-08-15', kind: 'bill', amountMinor: 169_900 });
  });

  it('projects a bill onto EVERY month the range spans', () => {
    const t = buildTimeline(
      inputs({ bills: [bill()], rangeStart: '2026-08-01', rangeEnd: '2026-10-31' })
    );
    expect(t.map((e) => e.date)).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
  });

  it('clamps to short months, matching the bills list exactly', () => {
    // Same rule as M4's dueDateInMonth — one implementation, not two.
    const t = buildTimeline(
      inputs({
        bills: [bill({ due_day: 31 })],
        rangeStart: '2026-02-01',
        rangeEnd: '2026-02-28',
      })
    );
    expect(t[0].date).toBe('2026-02-28');
  });

  it('spans a month boundary without skipping February', () => {
    // Iterating by +30 days would jump Jan 28 → Feb 27 → Mar 29 and lose a month.
    const t = buildTimeline(
      inputs({ bills: [bill({ due_day: 1 })], rangeStart: '2026-01-28', rangeEnd: '2026-03-03' })
    );
    expect(t.map((e) => e.date)).toEqual(['2026-02-01', '2026-03-01']);
  });

  it('projects paydays from recurring income', () => {
    const t = buildTimeline(
      inputs({
        recurringIncome: [{ id: 'r1', amountMinor: 3_000_000, dayOfMonth: 15, label: 'Salary' }],
      })
    );
    expect(t[0]).toMatchObject({ kind: 'income', date: '2026-08-15', amountMinor: 3_000_000 });
    expect(t[0].tone).toBe('income');
  });

  it('marks an overdue bill with the danger tone', () => {
    const t = buildTimeline(inputs({ bills: [bill({ status: 'overdue' })] }));
    expect(t[0].tone).toBe('danger');
    expect(t[0].meta).toBe('Overdue');
  });

  it('shows a paid bill as settled for that period only', () => {
    const t = buildTimeline(
      inputs({
        bills: [bill({ status: 'paid', dueDate: '2026-08-15' })],
        rangeStart: '2026-08-01',
        rangeEnd: '2026-09-30',
      })
    );
    // August is paid; September's projection is not.
    expect(t[0]).toMatchObject({ date: '2026-08-15', meta: 'Paid', tone: 'income' });
    expect(t[1]).toMatchObject({ date: '2026-09-15', meta: 'Due' });
  });

  it('ignores non-recurring bills', () => {
    expect(buildTimeline(inputs({ bills: [bill({ recurrence: 'none' })] }))).toHaveLength(0);
  });
});

describe('events and tasks', () => {
  it('includes timed and all-day events', () => {
    const t = buildTimeline(
      inputs({ events: [event(), event({ id: 'e2', title: 'Holiday', all_day: true, start_time: null })] })
    );
    expect(t).toHaveLength(2);
    expect(t.find((e) => e.title === 'Standup')?.meta).toBe('09:00');
    expect(t.find((e) => e.title === 'Holiday')?.meta).toBe('All day');
  });

  it('only puts tasks with a due date on the calendar', () => {
    const t = buildTimeline(inputs({ tasks: [task(), task({ id: 't2', due_date: null })] }));
    expect(t).toHaveLength(1);
  });

  it('quiets a completed task instead of hiding it', () => {
    const t = buildTimeline(
      inputs({ tasks: [task({ status: 'done', completed_at: '2026-08-15T00:00:00Z' })] })
    );
    expect(t[0].tone).toBe('secondary');
    expect(t[0].done).toBe(true);
  });

  it('flags urgent tasks', () => {
    const t = buildTimeline(inputs({ tasks: [task({ priority: 'urgent' })] }));
    expect(t[0].tone).toBe('danger');
    expect(t[0].meta).toBe('Urgent priority');
  });

  it('excludes anything outside the range', () => {
    const t = buildTimeline(
      inputs({ events: [event({ event_date: '2026-09-05' })], tasks: [task({ due_date: '2026-07-01' })] })
    );
    expect(t).toHaveLength(0);
  });
});

describe('ordering within a day', () => {
  it('puts money first, then timed events, then tasks', () => {
    const t = buildTimeline(
      inputs({
        bills: [bill()],
        tasks: [task()],
        events: [event()],
        recurringIncome: [{ id: 'r1', amountMinor: 3_000_000, dayOfMonth: 15, label: 'Salary' }],
      })
    );
    expect(t.map((e) => e.kind)).toEqual(['income', 'bill', 'event', 'task']);
  });

  it('orders timed events by clock time', () => {
    const t = buildTimeline(
      inputs({
        events: [
          event({ id: 'a', title: 'Late', start_time: '16:00:00' }),
          event({ id: 'b', title: 'Early', start_time: '08:00:00' }),
        ],
      })
    );
    expect(t.map((e) => e.title)).toEqual(['Early', 'Late']);
  });

  it('sorts across days chronologically', () => {
    const t = buildTimeline(
      inputs({
        events: [
          event({ id: 'a', event_date: '2026-08-20' }),
          event({ id: 'b', event_date: '2026-08-05' }),
        ],
      })
    );
    expect(t.map((e) => e.date)).toEqual(['2026-08-05', '2026-08-20']);
  });
});

describe('grouping and indicators', () => {
  it('groups by date', () => {
    const t = buildTimeline(inputs({ bills: [bill()], tasks: [task()] }));
    const g = groupTimelineByDate(t);
    expect(g.get('2026-08-15')).toHaveLength(2);
  });

  it('caps indicators and de-duplicates tones (D§35)', () => {
    const t = buildTimeline(
      inputs({
        bills: [bill(), bill({ id: 'b2', name: 'Rent' })],
        tasks: [task()],
        events: [event()],
        recurringIncome: [{ id: 'r1', amountMinor: 100, dayOfMonth: 15, label: 'Salary' }],
      })
    );
    const dots = dayIndicators(groupTimelineByDate(t).get('2026-08-15')!);
    expect(dots.length).toBeLessThanOrEqual(3);
    expect(new Set(dots).size).toBe(dots.length);
  });
});
