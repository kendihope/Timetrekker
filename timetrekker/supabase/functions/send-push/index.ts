import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sendToUser(userId, title, body) {
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  for (const sub of subs) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify({ title, body }));
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return { sent };
}

async function runDailyDigest() {
  const { data: userIds } = await admin.from("push_subscriptions").select("user_id");
  const uniqueUserIds = [...new Set((userIds || []).map((r) => r.user_id))];

  let totalSent = 0;
  for (const userId of uniqueUserIds) {
    const [{ count: taskCount }, { count: assignmentCount }] = await Promise.all([
      admin.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("completed", false),
      admin.from("assignments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("completed", false),
    ]);
    const pending = (taskCount || 0) + (assignmentCount || 0);
    if (pending === 0) continue;
    const body = `You have ${taskCount || 0} pending task${taskCount === 1 ? "" : "s"} and ${assignmentCount || 0} open assignment${assignmentCount === 1 ? "" : "s"}.`;
    const result = await sendToUser(userId, "Timetrekker", body);
    totalSent += result.sent;
  }
  return { usersNotified: uniqueUserIds.length, totalSent };
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (CRON_SECRET && token === CRON_SECRET) {
    const result = await runDailyDigest();
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.userId && body.userId !== user.id) {
    return new Response(JSON.stringify({ error: "Can only send notifications to yourself" }), { status: 403 });
  }

  const result = await sendToUser(user.id, body.title || "Timetrekker", body.body || "Test notification");
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
