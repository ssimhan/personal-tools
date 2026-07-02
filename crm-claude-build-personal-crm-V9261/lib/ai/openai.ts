import OpenAI from "openai";
import { config, requireApiKeys } from "@/lib/config";

let _client: OpenAI | null = null;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: requireApiKeys().openai });
  return _client;
}

// 1536-dim vector. The pgvector column is created at 1536 dimensions — see migrations.
// Changing the model requires re-embedding every person and a column migration.
export async function embed(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Cannot embed empty text");
  const resp = await client().embeddings.create({
    model: config.embeddingModel,
    input: trimmed,
  });
  return resp.data[0].embedding;
}

// Build the canonical "embedding input": summary + permanent notes.
// Per PRD §Embeddings — permanent notes carry strategic relevance and must be retrievable.
export function buildEmbeddingInput(
  summary: string | null | undefined,
  permanentNotes: string | null | undefined,
): string | null {
  const parts: string[] = [];
  if (summary && summary.trim()) parts.push(summary.trim());
  if (permanentNotes && permanentNotes.trim()) parts.push(`Permanent notes: ${permanentNotes.trim()}`);
  if (!parts.length) return null;
  return parts.join("\n\n");
}
