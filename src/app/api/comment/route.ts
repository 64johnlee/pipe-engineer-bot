import { NextResponse } from "next/server";
import { postGitHubComment, postLinearComment, type CommentDraft } from "@/lib/bot";
import { pipe } from "@screenpipe/js";

type BotSettings = {
  githubToken?: string;
  linearApiKey?: string;
};

function getBotSettings(settings: unknown): BotSettings {
  if (!settings || typeof settings !== "object") return {};
  const s = settings as Record<string, unknown>;
  const custom = s.customSettings;
  if (!custom || typeof custom !== "object") return {};
  const bot = (custom as Record<string, unknown>).engineerBot;
  if (!bot || typeof bot !== "object") return {};
  const b = bot as Record<string, unknown>;
  return {
    githubToken: typeof b.githubToken === "string" ? b.githubToken : undefined,
    linearApiKey: typeof b.linearApiKey === "string" ? b.linearApiKey : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const { draft } = await request.json() as { draft: CommentDraft };

    const settings = await pipe.settings.getAll();
    const botSettings = getBotSettings(settings);

    const githubToken = botSettings.githubToken ?? process.env.GITHUB_TOKEN;
    const linearApiKey = botSettings.linearApiKey ?? process.env.LINEAR_API_KEY;

    if (draft.issueContext.platform === "github") {
      if (!githubToken) {
        return NextResponse.json(
          { error: "GitHub token not configured. Add it in screenpipe settings under customSettings.engineerBot.githubToken." },
          { status: 400 }
        );
      }
      await postGitHubComment(draft, githubToken);
    } else if (draft.issueContext.platform === "linear") {
      if (!linearApiKey) {
        return NextResponse.json(
          { error: "Linear API key not configured. Add it in screenpipe settings under customSettings.engineerBot.linearApiKey." },
          { status: 400 }
        );
      }
      await postLinearComment(draft, linearApiKey);
    } else {
      return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, postedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[engineer-bot] comment post error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
