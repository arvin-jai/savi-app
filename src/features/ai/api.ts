/**
 * Ask Savi — the client data layer (v0.4).
 *
 * I/O only. Everything decision-shaped lives in `message.ts` as pure functions,
 * the same split the rest of the codebase uses.
 *
 * The one thing worth knowing before changing anything here: this file never
 * talks to an AI provider. It talks to the `ai-assistant` Edge Function, which
 * holds the API key. A key reachable from this file would be a key shipped in
 * the Android APK — see docs/AI-BOUNDARY.md §2.1.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AiMessage, AiPreferencesRow, GrantableTool } from '@/lib/database.types';
import { todayISO } from '@/lib/dates';
import { currentUserId, requireUserId, supabase } from '@/lib/supabase';

export const qkAi = {
  prefs: ['ai-preferences'] as const,
  grants: ['ai-tool-grants'] as const,
  conversations: ['ai-conversations'] as const,
  messages: (conversationId: string | null) => ['ai-messages', conversationId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Preferences — the off switch and the disclosure
// ─────────────────────────────────────────────────────────────────────────────

export function useAiPreferences() {
  return useQuery({
    queryKey: qkAi.prefs,
    queryFn: async (): Promise<AiPreferencesRow | null> => {
      const userId = await currentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('ai_preferences')
        .select('*')
        // Primary key is user_id — this table is 1:1 with the user.
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useUpdateAiPreferences() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<AiPreferencesRow, 'enabled' | 'disclosed_at'>>) => {
      const userId = await requireUserId();

      const { error } = await supabase
        .from('ai_preferences')
        .update(patch)
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkAi.prefs }),
  });
}

/**
 * Marks the disclosure as seen (AI-BOUNDARY §3).
 *
 * Deliberately fire-and-forget: if this write fails the user simply sees the
 * disclosure again next time, which is the harmless direction to fail in.
 */
export function useAcknowledgeDisclosure() {
  const { mutate } = useUpdateAiPreferences();
  return () => mutate({ disclosed_at: new Date().toISOString() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────────────────────────────────────

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: qkAi.messages(conversationId),
    enabled: conversationId !== null,
    queryFn: async (): Promise<AiMessage[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

/** The user's threads, newest first, for the history sheet. */
export function useConversations() {
  return useQuery({
    queryKey: qkAi.conversations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Deleting a conversation removes its messages by cascade — AI-BOUNDARY §3
 * promises the user can delete their transcripts, and an orphaned message table
 * would make that promise false.
 */
export function useDeleteConversation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qkAi.conversations });
      qc.invalidateQueries({ queryKey: ['ai-messages'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Asking
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Tool grants (v0.6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What the user has allowed Savi to create.
 *
 * The rows here are storage; the ENFORCEMENT is inside the Edge Function, which
 * re-checks the grant when the action is proposed and again when it is
 * confirmed. This hook only decides what the settings screen shows — a
 * client-side check is not a permission system (P8).
 */
export function useToolGrants() {
  return useQuery({
    queryKey: qkAi.grants,
    queryFn: async (): Promise<GrantableTool[]> => {
      const { data, error } = await supabase.from('ai_tool_grants').select('tool_name');
      if (error) throw error;
      return (data ?? []).map((r) => r.tool_name);
    },
  });
}

export function useSetToolGrant() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ tool, granted }: { tool: GrantableTool; granted: boolean }) => {
      const userId = await requireUserId();

      if (granted) {
        // A plain INSERT, deliberately not an upsert.
        //
        // PostgREST compiles `.upsert()` to INSERT ... ON CONFLICT DO UPDATE,
        // which needs UPDATE privilege — and this table has none, because a
        // grant either exists or it does not and a mutable "granted = false"
        // row is a second way to say the same thing. The 403 that produced was
        // the schema being right and this call being wrong.
        //
        // Idempotency instead comes from swallowing the unique violation:
        // toggling on twice is a no-op, not an error.
        const { error } = await supabase
          .from('ai_tool_grants')
          .insert({ user_id: userId, tool_name: tool });

        if (error && error.code !== '23505') throw error;
      } else {
        // Revoking is a delete. There is no "granted = false" row.
        const { error } = await supabase
          .from('ai_tool_grants')
          .delete()
          .eq('user_id', userId)
          .eq('tool_name', tool);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkAi.grants }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Asking
// ─────────────────────────────────────────────────────────────────────────────

/** A write Savi wants to make. Nothing has happened yet — the user decides. */
export type PendingAction = {
  tool: GrantableTool;
  args: Record<string, string>;
  /** Plain-language description. This is what the user actually approves. */
  summary: string;
};

export type AskResult = {
  conversationId: string;
  reply: string;
  pendingAction?: PendingAction | null;
};

/**
 * Errors reach users, so they get plain language (D§58, D§63).
 *
 * The Edge Function already returns user-facing copy for the cases it knows
 * about; this covers the ones it never gets to answer — no network, a dead
 * function, a gateway in between.
 */
function askErrorMessage(raw: string): string {
  const m = raw.toLowerCase();

  if (m.includes('network') || m.includes('fetch') || m.includes('failed to send')) {
    return "Savi couldn't reach its assistant. Check your connection and try again.";
  }
  if (m.includes('not found') || m.includes('404')) {
    return "Savi's assistant isn't available yet.";
  }
  return raw || 'Something went wrong. Please try again.';
}

export function useAskSavi() {
  const qc = useQueryClient();

  return useMutation<AskResult, Error, { message: string; conversationId: string | null }>({
    // No retry. A retried question is a second question — it would double-write
    // the user's message into the transcript and be charged twice. The same
    // reasoning as `retry: 0` on ledger mutations in lib/queryClient.ts.
    retry: 0,
    mutationFn: async ({ message, conversationId }) => {
      const { data, error } = await supabase.functions.invoke<AskResult & { error?: string }>(
        'ai-assistant',
        {
          body: {
            message,
            conversationId,
            // The client's own date. The server's `current_date` is UTC, and an
            // evening question in Manila would otherwise be answered against
            // yesterday — the bug lib/dates.ts exists to prevent.
            today: todayISO(),
          },
        }
      );

      if (error) {
        // A non-2xx carries the function's own plain-language message in the
        // body; surface that rather than "Edge Function returned a non-2xx".
        let detail = '';
        const ctx: unknown = (error as { context?: unknown }).context;
        if (ctx instanceof Response) {
          try {
            const body = await ctx.json();
            detail = typeof body?.error === 'string' ? body.error : '';
          } catch {
            detail = '';
          }
        }
        throw new Error(askErrorMessage(detail || error.message));
      }

      if (!data || typeof data.reply !== 'string') {
        throw new Error(askErrorMessage(data?.error ?? ''));
      }

      return {
        conversationId: data.conversationId,
        reply: data.reply,
        pendingAction: data.pendingAction ?? null,
      };
    },
    onSuccess: (result) => {
      // The function persisted both turns; re-read rather than guessing at the
      // rows, so the transcript on screen is the transcript in the database.
      qc.invalidateQueries({ queryKey: qkAi.messages(result.conversationId) });
      qc.invalidateQueries({ queryKey: qkAi.conversations });
    },
  });
}

/**
 * Execute an action the user has just approved (v0.6).
 *
 * The server re-checks the grant AND re-validates the arguments — this call is
 * the client saying "they said yes", not the client saying "do this". A
 * revocation between the proposal and the tap wins.
 */
export function useConfirmAction() {
  const qc = useQueryClient();

  return useMutation<{ executed: boolean; reply: string }, Error, PendingAction>({
    retry: 0, // A retried write is a second write.
    mutationFn: async (action) => {
      const { data, error } = await supabase.functions.invoke<{
        executed: boolean;
        reply: string;
        error?: string;
      }>('ai-assistant', { body: { confirm: action, today: todayISO() } });

      if (error) {
        let detail = '';
        const ctx: unknown = (error as { context?: unknown }).context;
        if (ctx instanceof Response) {
          try {
            const parsed = await ctx.json();
            detail = typeof parsed?.error === 'string' ? parsed.error : '';
          } catch {
            detail = '';
          }
        }
        throw new Error(askErrorMessage(detail || error.message));
      }

      if (!data) throw new Error(askErrorMessage(''));
      return { executed: data.executed, reply: data.reply };
    },
    onSuccess: () => {
      // The action wrote a task or an event. Everything that displays those
      // has to re-read, or the user confirms something and sees nothing change.
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}
