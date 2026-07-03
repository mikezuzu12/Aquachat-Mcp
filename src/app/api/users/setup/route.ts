import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, about, avatar_url, avatar_emoji, bg_color } = await req.json();
  const user = session.user as any;

  const { error } = await supabaseAdmin.from("users").update({
    full_name: username,
    about,
    avatar_url,
    avatar_emoji,
    bg_color,
    is_setup: true,
  }).eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}