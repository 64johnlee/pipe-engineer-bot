import { pipe } from "@screenpipe/js";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

export const IssueContextSchema = z.object({
  platform: z.enum(["github", "linear"]),
  issueId: z.string(),
  issueUrl: z.string(),
  issueTitle: z.string(),
  repoOrTeam: z.string(),
  detectedAt: z.string(),
});

export type IssueContext = z.infer<typeof IssueContextSchema>;

export const CommentDraftSchema = z.object({
  issueContext: IssueContextSchema,
  commentBody: z.string(),
  commentType: z.enum(["progress", "blocker", "question", "update", "done"]),
  generatedAt: z.string(),
  posted: z.boolean(),
  postedAt: z.string().optional(),
});

export type CommentDraft = z.infer<typeof CommentDraftSchema>;

// Detect GitHub/Linear issue URLs from recent screen activity
export async function detectActiveIssue(): Promise<IssueContext | null> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const screenData = await pipe.queryScreenpipe({
    startTime: twoMinutesAgo,
    endTime: new Date().toISOString(),
    limit: 50,
    contentType: "ocr",
  });

  if (!screenData?.data?.length) return null;

  for (const item of screenData.data) {
    if (item.type !== "OCR") continue;

    const text = item.content.text ?? "";
    const windowName = item.content.windowName ?? "";

    // Detect GitHub issues
    const githubMatch =
      text.match(/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)/i) ||
      windowName.match(/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)/i);

    if (githubMatch) {
      const repoOrTeam = githubMatch[1];
      const issueId = githubMatch[2];
      const issueUrl = `https://github.com/${repoOrTeam}/issues/${issueId}`;
      const titleMatch = text.match(/·\s*Issue\s*#\d+\s*·\s*(.+?)(?:\n|$)/i);
      const issueTitle = titleMatch?.[1]?.trim() ?? `Issue #${issueId}`;

      return {
        platform: "github",
        issueId,
        issueUrl,
        issueTitle,
        repoOrTeam,
        detectedAt: item.content.timestamp,
      };
    }

    // Detect Linear issues (format: TEAM-123)
    const linearMatch =
      text.match(/linear\.app\/([^/\s]+)\/issue\/([A-Z]+-\d+)/i) ||
      windowName.match(/linear\.app\/([^/\s]+)\/issue\/([A-Z]+-\d+)/i);

    if (linearMatch) {
      const team = linearMatch[1];
      const issueId = linearMatch[2];
      const issueUrl = `https://linear.app/${team}/issue/${issueId}`;

      // Escape issueId for regex (e.g. ENG-123 has a dash — safe but good practice)
      const escapedId = issueId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const titleMatch = text.match(new RegExp(`${escapedId}\\s*[·\\-]\\s*(.+?)(?:\\n|$)`, "i"));
      const issueTitle = titleMatch?.[1]?.trim() ?? issueId;

      return {
        platform: "linear",
        issueId,
        issueUrl,
        issueTitle,
        repoOrTeam: team,
        detectedAt: item.content.timestamp,
      };
    }
  }

  return null;
}

// Generate an intelligent comment based on recent screen + audio context
export async function generateComment(
  issue: IssueContext,
  commentType: CommentDraft["commentType"] = "update"
): Promise<CommentDraft> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const [screenData, audioData] = await Promise.all([
    pipe.queryScreenpipe({
      startTime: fifteenMinutesAgo,
      endTime: now,
      limit: 100,
      contentType: "ocr",
    }),
    pipe.queryScreenpipe({
      startTime: fifteenMinutesAgo,
      endTime: now,
      limit: 50,
      contentType: "audio",
    }),
  ]);

  const screenContext = (screenData?.data ?? [])
    .filter((item): item is typeof item & { type: "OCR" } => item.type === "OCR")
    .map((item) => `[${item.content.appName}] ${item.content.text?.slice(0, 200)}`)
    .join("\n")
    .slice(0, 6000);

  const audioContext = (audioData?.data ?? [])
    .filter((item): item is typeof item & { type: "Audio" } => item.type === "Audio")
    .map((item) => item.content.transcription?.slice(0, 200))
    .filter((t): t is string => !!t)
    .join("\n")
    .slice(0, 2000);

  const settings = await pipe.settings.getAll();
  const aiModel = settings?.aiModel ?? "gpt-4o-mini";
  const openaiKey = settings?.openaiApiKey ?? process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error("No OpenAI API key. Please add it in screenpipe settings.");
  }

  const openai = createOpenAI({ apiKey: openaiKey });

  const commentTypeInstructions: Record<CommentDraft["commentType"], string> = {
    progress: "Write a progress update — what has been accomplished so far.",
    blocker: "Write a blocker comment — what is blocking progress and what help is needed.",
    question: "Write a question comment — ask for clarification or guidance based on what you see.",
    update: "Write a general update comment — summarize current status and next steps.",
    done: "Write a done/completion comment — summarize what was completed and any follow-ups.",
  };

  const { text } = await generateText({
    model: openai(aiModel),
    prompt: `You are an engineer writing a ${commentType} comment on a ${issue.platform} issue.

Issue: ${issue.issueTitle}
URL: ${issue.issueUrl}
Platform: ${issue.platform}
Comment type: ${commentTypeInstructions[commentType]}

Recent screen activity (last 15 min):
${screenContext}

Recent audio/conversation:
${audioContext}

Write a concise, professional comment in first person. Be specific about what you're working on based on the screen context. Keep it under 150 words. Do not include the issue URL or title in the comment. Just write the comment body.`,
  });

  return {
    issueContext: issue,
    commentBody: text.trim(),
    commentType,
    generatedAt: new Date().toISOString(),
    posted: false,
  };
}

// Post the comment to GitHub via REST API
export async function postGitHubComment(
  draft: CommentDraft,
  githubToken: string
): Promise<void> {
  const { repoOrTeam, issueId } = draft.issueContext;

  const response = await fetch(
    `https://api.github.com/repos/${repoOrTeam}/issues/${issueId}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({ body: draft.commentBody }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GitHub API error: ${response.status} — ${err}`);
  }
}

// Post the comment to Linear via GraphQL API
export async function postLinearComment(
  draft: CommentDraft,
  linearApiKey: string
): Promise<void> {
  const { issueId } = draft.issueContext;

  // Step 1: Search for the issue UUID by its human-readable identifier (e.g. ENG-123)
  // Linear's GraphQL `issue` query accepts the identifier directly
  const searchRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: linearApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query GetIssue($identifier: String!) {
          issueSearch(term: $identifier, first: 1) {
            nodes { id identifier }
          }
        }
      `,
      variables: { identifier: issueId },
    }),
  });

  if (!searchRes.ok) {
    throw new Error(`Linear search API error: ${searchRes.status}`);
  }

  type LinearSearchResult = {
    data?: { issueSearch?: { nodes?: Array<{ id: string; identifier: string }> } };
  };

  const searchData = await searchRes.json() as LinearSearchResult;
  const issueUuid = searchData?.data?.issueSearch?.nodes?.[0]?.id;

  if (!issueUuid) {
    throw new Error(`Could not find Linear issue UUID for identifier ${issueId}`);
  }

  // Step 2: Create the comment using variables (safe for special chars + newlines)
  const commentRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: linearApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        mutation CreateComment($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
            comment { id }
          }
        }
      `,
      variables: { issueId: issueUuid, body: draft.commentBody },
    }),
  });

  if (!commentRes.ok) {
    throw new Error(`Linear comment API error: ${commentRes.status}`);
  }

  type LinearCommentResult = {
    data?: { commentCreate?: { success: boolean } };
    errors?: Array<{ message: string }>;
  };

  const commentData = await commentRes.json() as LinearCommentResult;
  if (!commentData?.data?.commentCreate?.success) {
    const errMsg = commentData?.errors?.[0]?.message ?? "Unknown error";
    throw new Error(`Linear comment failed: ${errMsg}`);
  }
}
