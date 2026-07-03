import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { name, member_ids } = await req.json();
  if (!name?.trim() || !Array.isArray(member_ids) || member_ids.length === 0) {
    return NextResponse.json({ error: "Group name and at least one member required" }, { status: 400 });
  }

  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      name: name.trim(),
      is_group: true,
      created_by: user.id,
      last_message: "Group created",
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !conversation) {
    return NextResponse.json({ error: error?.message || "Failed to create group" }, { status: 500 });
  }

  const members = [
    { conversation_id: conversation.id, user_id: user.id, role: "admin" },
    ...member_ids.map((id: string) => ({ conversation_id: conversation.id, user_id: id, role: "member" })),
  ];

  await supabaseAdmin.from("conversation_members").insert(members);

  return NextResponse.json({ conversation });
}