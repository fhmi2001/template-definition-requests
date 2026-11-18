// node --import tsx --test src/lib/*.test.ts — Kairo t7fv7wm9 acceptance tests for the mail roll-up core.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ROLLUP,
  isDailyQuotaError,
  isParked,
  nextUtcMidnight,
  noteSendOutcome,
  rollupConfigFromEnv,
  runFlush,
  type FlushDeps,
  type MailGroup,
  type OutboxState,
  type PendingMail,
  type SendOutcome,
} from "./mail-rollup";

const QUOTA_ERROR =
  'gateway 502: {"delivered":false,"error":"Resend error (429): {\\"message\\":\\"You have reached your daily email sending quota.\\",\\"name\\":\\"daily_quota_exceeded\\",\\"statusCode\\":429}"}';
const RATE_ERROR = 'gateway 502: {"delivered":false,"error":"Resend error (429): {\\"name\\":\\"rate_limit_exceeded\\"}"}';

const T0 = new Date("2026-11-15T09:51:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const fresh = (): OutboxState => ({ parkedUntil: null, retries: new Map() });

/** In-memory outbox: rows stay pending until marked, like email_status IS NULL in the DB. */
function fakeOutbox(items: PendingMail[], sendImpl: (g: MailGroup) => SendOutcome) {
  const pending = new Map(items.map((i) => [i.id, i]));
  const marked = new Map<string, SendOutcome & { to: string | null }>();
  const sends: MailGroup[] = [];
  const logs: string[] = [];
  const deps: FlushDeps = {
    loadPending: async () => [...pending.values()],
    send: async (g) => {
      sends.push(g);
      return sendImpl(g);
    },
    mark: async (ids, to, o) => {
      for (const id of ids) {
        pending.delete(id);
        marked.set(id, { ...o, to });
      }
    },
    log: (m) => logs.push(m),
  };
  return { deps, pending, marked, sends, logs, add: (i: PendingMail) => pending.set(i.id, i) };
}

const receipt = (i: number, min: number, to = "ops@janalkhair.com", locale = "ar"): PendingMail => ({
  id: `r${String(i).padStart(3, "0")}`,
  to,
  kind: "received",
  locale,
  createdAt: at(min),
});

test("50 submissions inside the window → exactly 1 receipt email listing all 50", async () => {
  const items = Array.from({ length: 50 }, (_, i) => receipt(i, i * 0.2)); // 50 in 10 minutes
  const box = fakeOutbox(items, () => ({ status: "SENT" }));
  const st = fresh();

  // while the window is open nothing goes out
  for (const m of [1, 5, 10, 14.9]) await runFlush(box.deps, st, DEFAULT_ROLLUP, at(m));
  assert.equal(box.sends.length, 0);

  const r = await runFlush(box.deps, st, DEFAULT_ROLLUP, at(15));
  assert.equal(box.sends.length, 1);
  assert.equal(box.sends[0].ids.length, 50);
  assert.equal(box.sends[0].to, "ops@janalkhair.com");
  assert.equal(box.sends[0].kind, "received");
  assert.deepEqual(r, { emails: 1, items: 50, parked: false, failed: 0, skipped: 0 });
  assert.equal(box.pending.size, 0);
  assert.ok([...box.marked.values()].every((m) => m.status === "SENT" && m.to === "ops@janalkhair.com"));

  // later sweeps send nothing more
  await runFlush(box.deps, st, DEFAULT_ROLLUP, at(30));
  assert.equal(box.sends.length, 1);
});

test("separate recipients, kinds and locales get separate emails; status window is 60 min", async () => {
  const items: PendingMail[] = [
    receipt(1, 0),
    receipt(2, 1, "a@sparkhorizon.com"),
    receipt(3, 2, "a@sparkhorizon.com", "en"),
    { id: "s1", to: "a@sparkhorizon.com", kind: "status", locale: "ar", createdAt: at(0) },
    { id: "s2", to: "A@SparkHorizon.com", kind: "status", locale: "ar", createdAt: at(30) },
  ];
  const box = fakeOutbox(items, () => ({ status: "SENT" }));
  const st = fresh();
  await runFlush(box.deps, st, DEFAULT_ROLLUP, at(20));
  assert.equal(box.sends.length, 3); // three receipt groups, status still waiting
  assert.ok(box.sends.every((g) => g.kind === "received"));
  await runFlush(box.deps, st, DEFAULT_ROLLUP, at(60));
  assert.equal(box.sends.length, 4);
  assert.deepEqual(box.sends[3].ids, ["s1", "s2"]); // same requester (case-insensitive) → one status email
});

test("a 429 daily_quota_exceeded is logged once and parked until the next UTC day — no retries that day", async () => {
  let quota = true;
  const items = Array.from({ length: 5 }, (_, i) => receipt(i, 0));
  const box = fakeOutbox(items, () => (quota ? { status: "FAILED", error: QUOTA_ERROR } : { status: "SENT" }));
  const st = fresh();

  const first = await runFlush(box.deps, st, DEFAULT_ROLLUP, at(15));
  assert.equal(first.parked, true);
  assert.equal(box.sends.length, 1);
  assert.equal(box.logs.length, 1);
  assert.equal(st.parkedUntil?.toISOString(), "2026-11-16T00:00:00.000Z");
  assert.equal(box.pending.size, 5, "rows stay pending (not FAILED)");

  // more submissions arrive; sweep every minute for the rest of the day → zero send attempts
  for (let i = 0; i < 3; i++) box.add(receipt(100 + i, 30 + i));
  for (let m = 16; m < 14 * 60; m += 1) await runFlush(box.deps, st, DEFAULT_ROLLUP, at(m));
  assert.equal(box.sends.length, 1, "no retry loop while parked");
  assert.equal(box.logs.length, 1, "logged once");

  // next UTC day: one roll-up with everything that waited
  quota = false;
  const next = await runFlush(box.deps, st, DEFAULT_ROLLUP, new Date("2026-11-16T00:00:30Z"));
  assert.equal(next.emails, 1);
  assert.equal(box.sends[1].ids.length, 8);
  assert.equal(st.parkedUntil, null);
});

test("sign-in codes are never blocked: a park only gates the outbox, and a successful OTP send lifts it", () => {
  const st = fresh();
  assert.equal(noteSendOutcome(st, { status: "FAILED", error: QUOTA_ERROR }, at(0)), true); // OTP saw the quota
  assert.equal(noteSendOutcome(st, { status: "FAILED", error: QUOTA_ERROR }, at(5)), false); // logged once
  assert.equal(isParked(st, at(5)), true);
  noteSendOutcome(st, { status: "SENT" }, at(10)); // an OTP went through → quota is back
  assert.equal(isParked(st, at(10)), false);
  assert.equal(isParked({ parkedUntil: nextUtcMidnight(at(0)), retries: new Map() }, new Date("2026-11-16T00:00:00Z")), false);
});

test("other errors (incl. per-second rate limit) get a bounded retry, then FAILED", async () => {
  assert.equal(isDailyQuotaError(RATE_ERROR), false);
  assert.equal(isDailyQuotaError(QUOTA_ERROR), true);
  const box = fakeOutbox([receipt(1, 0)], () => ({ status: "FAILED", error: RATE_ERROR }));
  const st = fresh();
  for (let m = 15; m <= 120; m++) await runFlush(box.deps, st, DEFAULT_ROLLUP, at(m));
  assert.equal(box.sends.length, DEFAULT_ROLLUP.maxAttempts);
  assert.equal(box.marked.get("r001")?.status, "FAILED");
  assert.equal(st.parkedUntil, null);
});

test("no recipient → SKIPPED; admin resend (force) goes out before the window", async () => {
  const box = fakeOutbox(
    [{ ...receipt(1, 0), to: null }, { id: "s9", to: "x@y.sa", kind: "status", locale: "en", createdAt: at(0) }],
    () => ({ status: "SENT" }),
  );
  const st = fresh();
  await runFlush(box.deps, st, DEFAULT_ROLLUP, at(1), new Set(["s9"]));
  assert.equal(box.marked.get("r001")?.status, "SKIPPED");
  assert.deepEqual(box.sends.map((g) => g.ids), [["s9"]]);
});

test("very large groups split at maxPerEmail; env knobs parse", async () => {
  const box = fakeOutbox(Array.from({ length: 120 }, (_, i) => receipt(i, 0)), () => ({ status: "SENT" }));
  await runFlush(box.deps, fresh(), DEFAULT_ROLLUP, at(15));
  assert.deepEqual(box.sends.map((g) => g.ids.length), [50, 50, 20]);
  const c = rollupConfigFromEnv({ EMAIL_ROLLUP_RECEIVED_MIN: "30", EMAIL_ROLLUP_STATUS_MIN: "junk" });
  assert.equal(c.receivedWindowMs, 30 * 60_000);
  assert.equal(c.statusWindowMs, DEFAULT_ROLLUP.statusWindowMs);
});
