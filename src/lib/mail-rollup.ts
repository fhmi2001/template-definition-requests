/*
 * Mail roll-up core (pure: no server-only, no db, no path aliases — so node:test can load it).
 *
 * Why (Kairo t7fv7wm9, 2026-11-18): all our apps share ONE Resend account and its daily quota.
 * On 2026-11-15 one requester submitted ~320 requests and the portal sent one receipt per request;
 * the quota ran out at ~10:19 UTC and every sign-in code after that failed (portal sign-in outage).
 *
 * Rules:
 *  - Request notifications are queued (request_status_changes.email_status IS NULL = pending) and go
 *    out per recipient + kind (received / status) + locale as ONE email once the oldest pending item
 *    is older than the kind's window. A group of one keeps today's single-request email.
 *  - A send refused with 429 daily_quota_exceeded parks ALL notification sends until the next UTC
 *    midnight. Rows stay pending and fold into the next roll-up — logged once, never retried that day.
 *  - Other failures get a bounded retry (maxAttempts, linear backoff), then the rows become FAILED.
 *  - Sign-in codes never pass through here (they call sendEmail directly) and are never delayed.
 */

export type MailKind = "received" | "status";

export type PendingMail = {
  id: string;
  /** resolved recipient; null = the client has no usable email */
  to: string | null;
  kind: MailKind;
  locale: string;
  createdAt: Date;
};

export type MailGroup = { key: string; to: string; kind: MailKind; locale: string; ids: string[] };

export type SendOutcome = { status: "SENT" | "FAILED" | "SKIPPED"; error?: string };

export type RollupConfig = {
  receivedWindowMs: number;
  statusWindowMs: number;
  /** split a very large group so one email stays readable */
  maxPerEmail: number;
  /** attempts per group for non-quota failures before the rows are marked FAILED */
  maxAttempts: number;
  retryBackoffMs: number;
  /** pause between two sends (Resend rate limit) */
  gapMs: number;
};

export const DEFAULT_ROLLUP: RollupConfig = {
  receivedWindowMs: 15 * 60_000,
  statusWindowMs: 60 * 60_000,
  maxPerEmail: 50,
  maxAttempts: 3,
  retryBackoffMs: 5 * 60_000,
  gapMs: 600,
};

/** Reads the window knobs from env (minutes); bad or missing values fall back to the defaults. */
export function rollupConfigFromEnv(e: Record<string, string | undefined>): RollupConfig {
  const minutes = (v: string | undefined, d: number) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 && n <= 24 * 60 ? n * 60_000 : d;
  };
  return {
    ...DEFAULT_ROLLUP,
    receivedWindowMs: minutes(e.EMAIL_ROLLUP_RECEIVED_MIN, DEFAULT_ROLLUP.receivedWindowMs),
    statusWindowMs: minutes(e.EMAIL_ROLLUP_STATUS_MIN, DEFAULT_ROLLUP.statusWindowMs),
  };
}

/** Resend's account-wide daily quota refusal (distinct from its per-second rate-limit 429). */
export function isDailyQuotaError(error: string | null | undefined): boolean {
  return !!error && /daily_quota_exceeded|daily email sending quota/i.test(error);
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Process-wide outbox state (kept on globalThis so every Next bundle shares it). */
export type OutboxState = {
  parkedUntil: Date | null;
  retries: Map<string, { attempts: number; nextAt: number }>;
};

export function outboxState(): OutboxState {
  const g = globalThis as unknown as { __tmOutboxState?: OutboxState };
  g.__tmOutboxState ??= { parkedUntil: null, retries: new Map() };
  return g.__tmOutboxState;
}

/**
 * Called with the outcome of EVERY send (sign-in codes included): a quota refusal parks the
 * notification outbox; any successful send proves the quota is back and lifts the park.
 * Returns true when this call newly parked the outbox (so the caller logs it once).
 */
export function noteSendOutcome(state: OutboxState, outcome: SendOutcome, now: Date): boolean {
  if (outcome.status === "SENT") {
    state.parkedUntil = null;
    return false;
  }
  if (outcome.status === "FAILED" && isDailyQuotaError(outcome.error)) {
    const already = state.parkedUntil !== null && now < state.parkedUntil;
    state.parkedUntil = nextUtcMidnight(now);
    return !already;
  }
  return false;
}

export function isParked(state: OutboxState, now: Date): boolean {
  if (state.parkedUntil && now >= state.parkedUntil) state.parkedUntil = null;
  return state.parkedUntil !== null;
}

/** Groups pending mail by recipient + kind + locale and returns the groups that are due now. */
export function planGroups(
  items: PendingMail[],
  now: Date,
  cfg: RollupConfig,
  force: ReadonlySet<string> = new Set(),
): { due: MailGroup[]; noRecipient: string[] } {
  const noRecipient: string[] = [];
  const byKey = new Map<string, PendingMail[]>();
  for (const it of items) {
    if (!it.to) {
      noRecipient.push(it.id);
      continue;
    }
    const key = `${it.to.toLowerCase()}|${it.kind}|${it.locale}`;
    const list = byKey.get(key);
    if (list) list.push(it);
    else byKey.set(key, [it]);
  }
  const due: MailGroup[] = [];
  for (const [key, list] of byKey) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
    const window = list[0].kind === "received" ? cfg.receivedWindowMs : cfg.statusWindowMs;
    const oldest = list[0].createdAt.getTime();
    if (now.getTime() - oldest < window && !list.some((x) => force.has(x.id))) continue;
    for (let i = 0; i < list.length; i += cfg.maxPerEmail) {
      const chunk = list.slice(i, i + cfg.maxPerEmail);
      due.push({ key, to: list[0].to!, kind: list[0].kind, locale: list[0].locale, ids: chunk.map((x) => x.id) });
    }
  }
  return { due, noRecipient };
}

export type FlushDeps = {
  loadPending(): Promise<PendingMail[]>;
  send(group: MailGroup): Promise<SendOutcome>;
  mark(ids: string[], to: string | null, outcome: SendOutcome): Promise<void>;
  log(message: string): void;
  sleep?(ms: number): Promise<void>;
};

export type FlushResult = { emails: number; items: number; parked: boolean; failed: number; skipped: number };

/** One outbox pass. Never throws for a send failure; DB errors propagate to the caller. */
export async function runFlush(
  deps: FlushDeps,
  state: OutboxState,
  cfg: RollupConfig,
  now: Date,
  force: ReadonlySet<string> = new Set(),
): Promise<FlushResult> {
  const res: FlushResult = { emails: 0, items: 0, parked: false, failed: 0, skipped: 0 };
  if (isParked(state, now)) return { ...res, parked: true };

  const { due, noRecipient } = planGroups(await deps.loadPending(), now, cfg, force);
  if (noRecipient.length) {
    await deps.mark(noRecipient, null, { status: "SKIPPED", error: "no client email" });
    res.skipped += noRecipient.length;
  }

  let first = true;
  for (const group of due) {
    const r = state.retries.get(group.key);
    if (r && r.nextAt > now.getTime() && !group.ids.some((id) => force.has(id))) continue;
    if (!first && deps.sleep) await deps.sleep(cfg.gapMs);
    first = false;

    const outcome = await deps.send(group);
    if (outcome.status === "FAILED" && isDailyQuotaError(outcome.error)) {
      if (noteSendOutcome(state, outcome, now)) {
        deps.log(
          `[mail-outbox] Resend daily quota exhausted — notifications parked until ${state.parkedUntil!.toISOString()}; pending rows fold into the next roll-up`,
        );
      }
      return { ...res, parked: true };
    }
    if (outcome.status === "FAILED") {
      const attempts = (r?.attempts ?? 0) + 1;
      if (attempts >= cfg.maxAttempts) {
        state.retries.delete(group.key);
        await deps.mark(group.ids, group.to, outcome);
        res.failed += group.ids.length;
        deps.log(`[mail-outbox] gave up after ${attempts} attempts (${group.ids.length} items): ${outcome.error ?? ""}`);
      } else {
        state.retries.set(group.key, { attempts, nextAt: now.getTime() + cfg.retryBackoffMs * attempts });
      }
      continue;
    }
    noteSendOutcome(state, outcome, now);
    state.retries.delete(group.key);
    await deps.mark(group.ids, group.to, outcome);
    res.emails += 1;
    res.items += group.ids.length;
  }
  return res;
}
