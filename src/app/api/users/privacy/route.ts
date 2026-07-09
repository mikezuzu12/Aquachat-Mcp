import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// GET - Fetch user's privacy settings
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("last_seen_privacy, online_status_privacy, read_receipts")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching privacy settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || {});
}

// POST - Update user's privacy settings
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const { last_seen_privacy, online_status_privacy, read_receipts } = await req.json();

  const { error } = await supabaseAdmin
    .from("users")
    .update({
      last_seen_privacy,
      online_status_privacy,
      read_receipts,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating privacy settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}