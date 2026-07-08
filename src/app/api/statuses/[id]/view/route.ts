import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const user = session.user as any;
    const { id } = await params; // ✅ Await the params Promise

    console.log("📝 Marking status as viewed:", id, "by user:", user.id);

    // Check if the status exists
    const { data: status, error: statusError } = await supabaseAdmin
      .from("statuses")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (statusError) {
      console.error("❌ Status not found:", statusError);
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    // Don't mark your own status as viewed
    if (status.user_id === user.id) {
      console.log("ℹ️ Cannot view your own status");
      return NextResponse.json({ success: true, message: "Your own status" });
    }

    // Insert or update the view
    const { error: upsertError } = await supabaseAdmin
      .from("status_views")
      .upsert({
        status_id: id,
        viewer_id: user.id,
        viewed_at: new Date().toISOString(),
      }, {
        onConflict: "status_id,viewer_id"
      });

    if (upsertError) {
      console.error("❌ Error upserting view:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    console.log("✅ Status marked as viewed:", id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Status view error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}