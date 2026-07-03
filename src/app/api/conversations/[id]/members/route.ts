import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { member_ids } = await req.json();
  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 });
  }

  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("is_group")
    .eq("id", params.id)
    .single();

  if (!conv?.is_group) {
    return NextResponse.json({ error: "Not a group conversation" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", params.id);

  const existingIds = new Set((existing || []).map((m) => m.user_id));
  const newIds = member_ids.filter((id: string) => !existingIds.has(id));

  if (newIds.length === 0) return NextResponse.json({ success: true });

  const rows = newIds.map((id: string) => ({
    conversation_id: params.id,
    user_id: id,
    role: "member",
  }));

  await supabaseAdmin.from("conversation_members").insert(rows);
  return NextResponse.json({ success: true });
}