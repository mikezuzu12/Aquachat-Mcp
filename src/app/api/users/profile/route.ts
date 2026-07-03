import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, full_name, email, phone, avatar_url, avatar_emoji, about, bg_color")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  const { full_name, email, phone, avatar_url } = await req.json();

  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  // Check email uniqueness (excluding self)
  if (email) {
    const { data: existingEmail } = await supabaseAdmin
      .from("users").select("id").eq("email", email).neq("id", user.id).maybeSingle();
    if (existingEmail) return NextResponse.json({ error: "Email already in use." }, { status: 400 });
  }

  // Check phone uniqueness (excluding self)
  if (phone) {
    const { data: existingPhone } = await supabaseAdmin
      .from("users").select("id").eq("phone", phone).neq("id", user.id).maybeSingle();
    if (existingPhone) return NextResponse.json({ error: "Phone number already in use." }, { status: 400 });
  }

  const updateData: any = { full_name: full_name.trim() };
  if (email) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone || null;
  if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

  const { error } = await supabaseAdmin.from("users").update(updateData).eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}