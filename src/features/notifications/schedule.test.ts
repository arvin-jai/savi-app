import type { BillWithStatus } from '@/features/bills/api';
import type { Task } from '@/lib/database.types';

import {
  planNotifications,
  reconcile,
  type NotificationPreferences,
} from './schedule';

function prefs(patch: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    enabled: true,
    bills_enabled: true,
    tasks_enabled: false,
    events_enabled: false,
    income_enabled: false,
    bill_lead_days: 1,
    remind_at: '09:00',
    ...patch,
  };
}

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
    status: 'due-soon',
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
    due_date: '2026-08-20',
    priority: 'medium',
    status: 'todo',
    completed_at: null,
    created_at: '',
    updated_at: '',
    ...patch,
  };
}

/** 2026-08-10, 08:00 local. */
const NOW = new Date(2026, 7, 10, 8, 0, 0);

describe('bills', () => {
  it('schedules one lead day ahead at the chosen time', () => {
    const [n] = planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: NOW });
    expect(n.fireAt.getFullYear()).toBe(2026);
    expect(n.fireAt.getMonth()).toBe(7);
    expect(n.fireAt.getDate()).toBe(14); // due 15th, lead 1
    expect(n.fireAt.getHours()).toBe(9);
    expect(n.body).toBe('₱1,699 is due tomorrow.');
  });

  it('respects a longer lead time and phrases it correctly', () => {
    const [n] = planNotifications({
      bills: [bill()],
      tasks: [],
      prefs: prefs({ bill_lead_days: 3 }),
      now: NOW,
    });
    expect(n.fireAt.getDate()).toBe(12);
    expect(n.body).toBe('₱1,699 is due in 3 days.');
  });

  it('says "today" with a zero lead time', () => {
    const [n] = planNotifications({
      bills: [bill()],
      tasks: [],
      prefs: prefs({ bill_lead_days: 0 }),
      now: NOW,
    });
    expect(n.body).toBe('₱1,699 is due today.');
  });

  it('never reminds about a paid bill', () => {
    // The reason status is derived from bill_payments rather than a flag: the
    // reminder set goes quiet the moment the user marks it paid.
    expect(
      planNotifications({ bills: [bill({ status: 'paid' })], tasks: [], prefs: prefs(), now: NOW })
    ).toHaveLength(0);
  });

  it('does not schedule in the past', () => {
    // An overdue bill already shows in red in the app; a notification dated
    // last week is noise about something that cannot be un-missed.
    expect(
      planNotifications({
        bills: [bill({ dueDate: '2026-08-01', status: 'overdue' })],
        tasks: [],
        prefs: prefs(),
        now: NOW,
      })
    ).toHaveLength(0);
  });

  it('treats the fire moment itself as past, not future', () => {
    // Fire time is exactly now → already gone.
    const atNine = new Date(2026, 7, 14, 9, 0, 0);
    expect(
      planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: atNine })
    ).toHaveLength(0);
  });

  it('is silent when bills are switched off', () => {
    expect(
      planNotifications({ bills: [bill()], tasks: [], prefs: prefs({ bills_enabled: false }), now: NOW })
    ).toHaveLength(0);
  });

  it('uses the calm voice — no alarm punctuation (D§63)', () => {
    const [n] = planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: NOW });
    expect(n.body).not.toMatch(/!{1,}|URGENT|WARNING/i);
    expect(n.title).toBe('Internet');
  });
});

describe('tasks', () => {
  it('is off by default — the app does not start noisy', () => {
    expect(
      planNotifications({ bills: [], tasks: [task()], prefs: prefs(), now: NOW })
    ).toHaveLength(0);
  });

  it('schedules when enabled', () => {
    const [n] = planNotifications({
      bills: [],
      tasks: [task()],
      prefs: prefs({ tasks_enabled: true }),
      now: NOW,
    });
    expect(n.category).toBe('task');
    expect(n.fireAt.getDate()).toBe(20);
  });

  it('mentions priority only when it is high or urgent', () => {
    const p = prefs({ tasks_enabled: true });
    const [normal] = planNotifications({ bills: [], tasks: [task()], prefs: p, now: NOW });
    const [urgent] = planNotifications({
      bills: [],
      tasks: [task({ priority: 'urgent' })],
      prefs: p,
      now: NOW,
    });
    expect(normal.body).not.toMatch(/priority/);
    expect(urgent.body).toMatch(/urgent priority/);
  });

  it('skips completed and undated tasks', () => {
    const p = prefs({ tasks_enabled: true });
    expect(
      planNotifications({
        bills: [],
        tasks: [task({ status: 'done', completed_at: 'x' }), task({ id: 't2', due_date: null })],
        prefs: p,
        now: NOW,
      })
    ).toHaveLength(0);
  });
});

describe('master switch and ordering', () => {
  it('cancels everything when notifications are off', () => {
    expect(
      planNotifications({
        bills: [bill()],
        tasks: [task()],
        prefs: prefs({ enabled: false, tasks_enabled: true }),
        now: NOW,
      })
    ).toHaveLength(0);
  });

  it('returns soonest first', () => {
    const out = planNotifications({
      bills: [bill({ id: 'late', dueDate: '2026-08-28' }), bill({ id: 'soon', dueDate: '2026-08-12' })],
      tasks: [],
      prefs: prefs(),
      now: NOW,
    });
    expect(out.map((n) => n.id.split(':')[1])).toEqual(['soon', 'late']);
  });

  it('ids are stable across recomputation', () => {
    const a = planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: NOW });
    const b = planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: NOW });
    expect(a[0].id).toBe(b[0].id);
  });
});

describe('reconcile', () => {
  const planned = planNotifications({ bills: [bill()], tasks: [], prefs: prefs(), now: NOW });

  it('schedules only what is new', () => {
    const r = reconcile(planned, []);
    expect(r.toSchedule).toHaveLength(1);
    expect(r.toCancel).toHaveLength(0);
  });

  it('leaves an already-scheduled reminder untouched', () => {
    // Cancel-and-recreate could re-surface a notification the user already
    // saw, so an unchanged reminder must be a no-op on both sides.
    const r = reconcile(planned, [planned[0].id]);
    expect(r.toSchedule).toHaveLength(0);
    expect(r.toCancel).toHaveLength(0);
  });

  it('cancels what is no longer planned', () => {
    const r = reconcile(planned, [planned[0].id, 'bill:old:2026-07-15']);
    expect(r.toCancel).toEqual(['bill:old:2026-07-15']);
  });

  it('cancels everything when nothing is planned', () => {
    const r = reconcile([], ['bill:a:1', 'task:b:2']);
    expect(r.toCancel).toHaveLength(2);
    expect(r.toSchedule).toHaveLength(0);
  });
});
