import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { data: statuses } = await supabaseAdmin
    .from("statuses")
    .select("*, users(id, full_name, avatar_url, avatar_emoji)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const { data: myViews } = await supabaseAdmin
    .from("status_views")
    .select("status_id")
    .eq("viewer_id", user.id);

  const viewedIds = new Set((myViews || []).map((v) => v.status_id));

  const myStatuses = (statuses || []).filter((s) => s.user_id === user.id);
  const othersRaw = (statuses || []).filter((s) => s.user_id !== user.id);

  const grouped: Record<string, any> = {};
  for (const s of othersRaw) {
    if (!grouped[s.user_id]) {
      grouped[s.user_id] = { user: s.users, statuses: [], allViewed: true };
    }
    grouped[s.user_id].statuses.push({ ...s, viewed: viewedIds.has(s.id) });
    if (!viewedIds.has(s.id)) grouped[s.user_id].allViewed = false;
  }

  return NextResponse.json({
    myStatuses: myStatuses.map((s) => ({ ...s, viewed: viewedIds.has(s.id) })),
    others: Object.values(grouped),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { content, media_url, media_type, bg_color } = await req.json();
  if (!content && !media_url) {
    return NextResponse.json({ error: "Empty status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("statuses")
    .insert({ user_id: user.id, content, media_url, media_type, bg_color })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}