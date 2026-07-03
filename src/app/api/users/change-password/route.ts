import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as any;
  const { currentPassword, newPassword } = await req.json();

  const { data } = await supabaseAdmin
    .from("users").select("password_hash").eq("id", user.id).single();

  if (!data?.password_hash)
    return NextResponse.json({ error: "No password set on this account." }, { status: 400 });

  const match = await bcrypt.compare(currentPassword, data.password_hash);
  if (!match)
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });

  const password_hash = await bcrypt.hash(newPassword, 12);
  await supabaseAdmin.from("users").update({ password_hash }).eq("id", user.id);

  return NextResponse.json({ success: true });
}