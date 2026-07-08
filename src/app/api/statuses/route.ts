import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const user = session.user as any;
    console.log("👤 User ID:", user?.id);

    // Get my statuses
    const { data: myStatuses, error: myError } = await supabaseAdmin
      .from("statuses")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: true });

    if (myError) {
      console.error("❌ Error fetching my statuses:", myError);
    }
    console.log(`✅ Found ${myStatuses?.length || 0} my statuses`);

    // Get all conversations the user is a member of
    const { data: memberships } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    const conversationIds = memberships?.map(m => m.conversation_id) || [];
    console.log(`📨 Found ${conversationIds.length} conversations`);

    // Get all members of those conversations (excluding the current user)
    let contactIds: string[] = [];
    if (conversationIds.length > 0) {
      const { data: allMembers } = await supabaseAdmin
        .from("conversation_members")
        .select("user_id")
        .in("conversation_id", conversationIds)
        .neq("user_id", user.id);

      if (allMembers) {
        contactIds = [...new Set(allMembers.map(m => m.user_id))];
        console.log(`👥 Found ${contactIds.length} unique contacts`);
      }
    }

    // Get statuses from contacts
    let otherStatuses: any[] = [];
    if (contactIds.length > 0) {
      const { data: statuses } = await supabaseAdmin
        .from("statuses")
        .select("*")
        .in("user_id", contactIds)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true });

      otherStatuses = statuses || [];
      console.log(`✅ Found ${otherStatuses.length} statuses from contacts`);

      // Get user details for these statuses
      if (otherStatuses.length > 0) {
        const userIds = [...new Set(otherStatuses.map(s => s.user_id))];
        const { data: users } = await supabaseAdmin
          .from("users")
          .select("id, full_name, avatar_url, avatar_emoji, is_online")
          .in("id", userIds);

        if (users) {
          const userMap = new Map(users.map(u => [u.id, u]));
          otherStatuses = otherStatuses.map(s => ({
            ...s,
            user: userMap.get(s.user_id) || null
          }));
        }
      }
    }

    // Get views
    const allStatusIds = [...(myStatuses || []), ...otherStatuses].map(s => s.id);
    let viewsMap: Record<string, boolean> = {};
    
    if (allStatusIds.length > 0) {
      const { data: views } = await supabaseAdmin
        .from("status_views")
        .select("status_id")
        .eq("viewer_id", user.id)
        .in("status_id", allStatusIds);
      
      if (views) {
        viewsMap = views.reduce((acc, v) => ({ ...acc, [v.status_id]: true }), {});
      }
    }

    // Group by user
    const userMap = new Map();
    otherStatuses.forEach((status) => {
      if (!status.user) return;
      
      const userId = status.user.id;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user: status.user,
          statuses: [],
          allViewed: true,
        });
      }
      const group = userMap.get(userId);
      group.statuses.push({
        ...status,
        viewed: !!viewsMap[status.id],
      });
      if (!viewsMap[status.id]) {
        group.allViewed = false;
      }
    });

    const myFormatted = (myStatuses || []).map(s => ({
      ...s,
      viewed: true,
    }));

    const others = Array.from(userMap.values());

    console.log(`📊 Final: ${myFormatted.length} my statuses, ${others.length} contacts with statuses`);
    
    return NextResponse.json({
      myStatuses: myFormatted,
      others: others,
    });
  } catch (error) {
    console.error("❌ Statuses GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const user = session.user as any;
    const { content, media_url, media_type, bg_color } = await req.json();

    if (!content && !media_url) {
      return NextResponse.json(
        { error: "Content or media is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("statuses")
      .insert({
        user_id: user.id,
        content: content || null,
        media_url: media_url || null,
        media_type: media_type || null,
        bg_color: bg_color || null,
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Status creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ Status created:", data.id);
    return NextResponse.json({ status: data });
  } catch (error) {
    console.error("❌ Status POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}