// app/api/upload/route.ts (or wherever this file lives)
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = (formData.get("type") as string) || "messages"; // "messages" | "voice-notes"
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 50MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop();
    const folder = type === "voice-notes" ? "voice-notes" : "messages";
    const path = `${folder}/${user.id}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabaseAdmin.storage
      .from("chat-media")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: publicUrl } = supabaseAdmin.storage
      .from("chat-media").getPublicUrl(path);

    return NextResponse.json({ url: publicUrl.publicUrl });
  } catch (err: any) {
    console.error("❌ Upload route crash:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Upload failed" }, { status: 500 });
  }
}