import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Get a free API key at https://developers.giphy.com/ and add it to your env as GIPHY_API_KEY
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GIPHY_API_KEY not configured" }, { status: 500 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  const limit = req.nextUrl.searchParams.get("limit") || "24";

  try {
    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
          query
        )}&limit=${limit}&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&rating=pg-13`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return NextResponse.json({ error: "Giphy request failed" }, { status: 502 });
    }

    const data = await res.json();
    const gifs = (data.data || []).map((g: any) => ({
      id: g.id,
      preview: g.images.fixed_width_small?.url || g.images.fixed_width?.url,
      full: g.images.original?.url,
      title: g.title,
    }));

    return NextResponse.json({ gifs });
  } catch (error) {
    console.error("Giphy search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}