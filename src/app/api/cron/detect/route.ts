import { NextResponse } from "next/server";
import { detectActiveIssue, generateComment } from "@/lib/bot";
import { pipe } from "@screenpipe/js";

export async function GET() {
  try {
    const issue = await detectActiveIssue();

    if (!issue) {
      return NextResponse.json({ ok: true, detected: false });
    }

    console.log(`[engineer-bot] detected issue: ${issue.platform} ${issue.issueId}`);

    // Generate a progress update comment
    const draft = await generateComment(issue, "update");

    // Notify the user via inbox so they can review and post
    await pipe.inbox.send({
      title: `💬 Comment ready for ${issue.platform === "github" ? "🐙" : "🔷"} ${issue.issueId}`,
      body: `${issue.issueTitle}\n\n${draft.commentBody}`,
      actions: [{ label: "Open issue", action: "open", url: issue.issueUrl }],
    });

    return NextResponse.json({ ok: true, detected: true, issue, draft });
  } catch (error) {
    console.error("[engineer-bot] cron error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
