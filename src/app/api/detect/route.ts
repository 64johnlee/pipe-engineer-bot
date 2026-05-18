import { NextResponse } from "next/server";
import { detectActiveIssue, generateComment, type CommentDraft } from "@/lib/bot";

export async function POST(request: Request) {
  try {
    const { commentType = "update" } = await request.json() as {
      commentType?: CommentDraft["commentType"];
    };

    const issue = await detectActiveIssue();
    if (!issue) {
      return NextResponse.json({ detected: false });
    }

    const draft = await generateComment(issue, commentType);
    return NextResponse.json({ detected: true, issue, draft });
  } catch (error) {
    console.error("[engineer-bot] detect error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
