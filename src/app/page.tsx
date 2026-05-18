"use client";

import { useState } from "react";
import {
  Bot, Loader2, RefreshCw, Send, Github, Zap,
  CheckCircle, AlertCircle, MessageSquare, Eye
} from "lucide-react";
import type { IssueContext, CommentDraft } from "@/lib/bot";

const COMMENT_TYPES: { value: CommentDraft["commentType"]; label: string; desc: string }[] = [
  { value: "update", label: "📋 Update", desc: "General status update" },
  { value: "progress", label: "🚀 Progress", desc: "What's been done" },
  { value: "blocker", label: "🚧 Blocker", desc: "Something is blocking" },
  { value: "question", label: "❓ Question", desc: "Need clarification" },
  { value: "done", label: "✅ Done", desc: "Work completed" },
];

export default function Home() {
  const [detecting, setDetecting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [commentType, setCommentType] = useState<CommentDraft["commentType"]>("update");
  const [result, setResult] = useState<{
    detected: boolean;
    issue?: IssueContext;
    draft?: CommentDraft;
  } | null>(null);
  const [editedComment, setEditedComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);

  async function detect() {
    setDetecting(true);
    setError(null);
    setPostSuccess(false);
    setResult(null);
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentType }),
      });
      const data = await res.json() as typeof result & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Detection failed");
      setResult(data);
      setEditedComment(data.draft?.commentBody ?? "");
    } catch (e) {
      setError(String(e));
    } finally {
      setDetecting(false);
    }
  }

  async function postComment() {
    if (!result?.draft) return;
    setPosting(true);
    setError(null);
    try {
      const draft: CommentDraft = { ...result.draft, commentBody: editedComment };
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Post failed");
      setPostSuccess(true);
      setResult(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setPosting(false);
    }
  }

  const platformIcon = result?.issue?.platform === "github"
    ? <Github className="w-4 h-4" />
    : <Zap className="w-4 h-4 text-purple-400" />;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Engineer Bot</h1>
            <p className="text-gray-400 text-sm">Auto-comment on GitHub & Linear issues from your screen</p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-1">
          <p className="text-gray-300 font-medium mb-2 flex items-center gap-2"><Eye className="w-4 h-4" /> How it works</p>
          <p>1. Open a GitHub or Linear issue in your browser</p>
          <p>2. Work on it for a few minutes</p>
          <p>3. Click <strong className="text-white">Detect & Generate</strong> — the bot reads your screen context</p>
          <p>4. Review the AI-generated comment, edit if needed, then post</p>
          <p className="text-indigo-400 mt-2">⚡ Auto-mode: runs every 5 min and sends drafts to your inbox</p>
        </div>

        {/* Comment type selector */}
        <div>
          <p className="text-sm text-gray-400 mb-2 font-medium">Comment type</p>
          <div className="grid grid-cols-5 gap-2">
            {COMMENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setCommentType(t.value)}
                className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                  commentType === t.value
                    ? "border-indigo-500 bg-indigo-950 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div>{t.label}</div>
                <div className="text-gray-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detect button */}
        <button
          onClick={detect}
          disabled={detecting}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-colors"
        >
          {detecting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning screen & generating comment…</>
            : <><RefreshCw className="w-4 h-4" /> Detect Issue & Generate Comment</>
          }
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex gap-3 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Success */}
        {postSuccess && (
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 flex gap-3 text-sm text-green-300">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            Comment posted successfully!
          </div>
        )}

        {/* No issue detected */}
        {result?.detected === false && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-400 text-sm">
            <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            No GitHub or Linear issue detected on screen.<br />
            Open an issue in your browser and try again.
          </div>
        )}

        {/* Result */}
        {result?.detected && result.issue && result.draft && (
          <div className="space-y-4">
            {/* Issue info */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                {platformIcon}
                <span className="text-xs text-gray-400 uppercase font-medium">{result.issue.platform}</span>
                <span className="text-xs text-gray-500">#{result.issue.issueId}</span>
              </div>
              <p className="text-white font-medium text-sm">{result.issue.issueTitle}</p>
              <a
                href={result.issue.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline mt-1 block"
              >
                {result.issue.issueUrl}
              </a>
            </div>

            {/* Comment editor */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  Generated comment — review & edit
                </p>
                <span className="text-xs text-gray-500">{editedComment.length} chars</span>
              </div>
              <textarea
                value={editedComment}
                onChange={(e) => setEditedComment(e.target.value)}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 resize-none focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Post button */}
            <button
              onClick={postComment}
              disabled={posting || !editedComment.trim()}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-medium transition-colors"
            >
              {posting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Posting…</>
                : <><Send className="w-4 h-4" /> Post to {result.issue.platform === "github" ? "GitHub" : "Linear"}</>
              }
            </button>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          Auto-detects every 5 min · Requires GitHub token or Linear API key in screenpipe settings
        </p>
      </div>
    </main>
  );
}
