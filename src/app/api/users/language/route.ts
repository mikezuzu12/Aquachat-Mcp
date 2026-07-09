import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const ALLOWED_LANGUAGES = ["en", "af", "zu", "xh", "nr", "ss", "nso", "st", "tn", "ts", "ve"];

export async function PATCH(req: NextRequest) {
  console.log("🔵 Language API called");
  
  const session = await getServerSession(authOptions);
  if (!session) {
    console.log("🔴 No session found");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const { language } = await req.json();
  
  console.log(`🟡 Updating language for user ${user.id} to: ${language}`);

  if (!ALLOWED_LANGUAGES.includes(language)) {
    console.log(`🔴 Unsupported language: ${language}`);
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update({ language })
    .eq("id", user.id);

  if (error) {
    console.error("🔴 Language update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log("🟢 Language updated successfully!");
  return NextResponse.json({ success: true, language });
}