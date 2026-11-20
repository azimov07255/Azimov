// Azimov reminders -> Web Push, run by pg_cron every 10 minutes.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (+ SUPABASE_* provided by the platform).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { computeReminders, shouldDeliver, notifyPrefs } from './core.js';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const MAX_INDIVIDUAL = 3;

function localNow(tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const safeTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
};

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));

  // Test hook: compute what WOULD be sent for an inline snapshot (no database, no push).
  if (body.snapshot) {
    const now = body.now ?? localNow(safeTz(body.tz ?? 'UTC'));
    const P = notifyPrefs(body.snapshot);
    const reminders = computeReminders(body.snapshot, now).filter((r: any) => shouldDeliver(r, now, P) && !body.snapshot.dismissed?.[r.id]);
    return Response.json({ now, reminders });
  }

  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const stats = { users: 0, sent: 0, failed: 0, removed: 0, skipped: 0 };

  const { data: subs, error } = await sb.from('azimov_push_subs').select('endpoint,user_id,p256dh,auth,tz');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const byUser = new Map<string, any[]>();
  for (const s of subs ?? []) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  for (const [uid, list] of byUser) {
    stats.users++;
    const { data: row } = await sb.from('azimov_user_data').select('data').eq('user_id', uid).maybeSingle();
    if (!row?.data) continue;
    const snap = row.data;
    const now = localNow(safeTz(list[0].tz));
    const P = notifyPrefs(snap);
    const due = computeReminders(snap, now).filter((r: any) => shouldDeliver(r, now, P) && !snap.dismissed?.[r.id]);
    if (!due.length) continue;
    const { data: done } = await sb.from('azimov_push_log').select('rid').eq('user_id', uid).in('rid', due.map((r: any) => r.id));
    const doneSet = new Set((done ?? []).map((d: any) => d.rid));
    const fresh = due.filter((r: any) => !doneSet.has(r.id));
    if (!fresh.length) {
      stats.skipped++;
      continue;
    }
    // a few individual pushes, the rest folded into one summary so we never spam
    const msgs = fresh.slice(0, MAX_INDIVIDUAL).map((r: any) => ({ title: `${r.icon} ${r.title}`, body: r.body, tag: r.id, href: r.href }));
    if (fresh.length > MAX_INDIVIDUAL) msgs.push({ title: `Yana ${fresh.length - MAX_INDIVIDUAL} ta eslatma bor`, body: 'Ilovani ochib ko\'ring', tag: `more:${now.date}:${now.hour}`, href: '#/reminders' });

    let delivered = false;
    for (const s of list) {
      for (const m of msgs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(m), { TTL: 6 * 3600, urgency: 'normal' });
          stats.sent++;
          delivered = true;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from('azimov_push_subs').delete().eq('endpoint', s.endpoint);
            stats.removed++;
            break;
          }
          stats.failed++;
          console.error('push failed', e?.statusCode, e?.body ?? e?.message);
        }
      }
    }
    if (delivered) await sb.from('azimov_push_log').upsert(fresh.map((r: any) => ({ user_id: uid, rid: r.id })), { ignoreDuplicates: true });
  }
  await sb.from('azimov_push_log').delete().lt('sent_at', new Date(Date.now() - 90 * 864e5).toISOString());
  return Response.json(stats);
});
