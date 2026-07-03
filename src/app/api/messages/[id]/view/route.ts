import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  const { id } = await params;

  const { data: message } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, is_view_once, viewed_at")
    .eq("id", id)
    .single();

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.sender_id === user.id) {
    return NextResponse.json({ error: "Cannot view your own view-once message" }, { status: 403 });
  }
  if (message.viewed_at) {
    return NextResponse.json({ error: "Already viewed" }, { status: 410 });
  }

  const { error } = await supabaseAdmin
    .from("messages")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, viewed_at: new Date().toISOString() });
}