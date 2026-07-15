import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;  // ← now needs await
  const { member_ids } = await req.json();

  if (!Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json({ error: "No members provided" }, { status: 400 });
  }

  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("is_group")
    .eq("id", id)
    .single();

  if (!conv?.is_group) {
    return NextResponse.json({ error: "Not a group conversation" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", id);

  const existingIds = new Set((existing || []).map((m) => m.user_id));
  const newIds = member_ids.filter((memberId: string) => !existingIds.has(memberId));

  if (newIds.length === 0) {
    return NextResponse.json({ success: true, message: "All members already in group" });
  }

  const rows = newIds.map((memberId: string) => ({
    conversation_id: id,
    user_id: memberId,
    role: "member",
  }));

  const { error } = await supabaseAdmin
    .from("conversation_members")
    .insert(rows);

  if (error) {
    console.error("Error adding members:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    added: newIds.length,
    members: newIds 
  });
}