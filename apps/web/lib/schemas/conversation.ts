import { z } from "zod";

export const ConversationState = z.enum(["open", "closed"]);

export const Conversation = z.object({
  id: z.string().uuid(),
  started_at: z.string(),  // ISO
  topic: z.string().nullable().optional(),
  created_by: z.string(),
  state: ConversationState,
  created_at: z.string(),
});

export const Message = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_type: z.enum(["character", "narration", "system", "player"]),
  sender_id: z.string().nullable().optional(),
  content: z.string().min(1),
  created_at: z.string(),
});

export const Notification = z.object({
  id: z.string().uuid(),
  kind: z.enum(["conversation_created", "system"]),
  ref_id: z.string().uuid().nullable().optional(),
  title: z.string(),
  body: z.string().nullable().optional(),
  is_read: z.boolean(),
  created_at: z.string(),
});

export type TConversation = z.infer<typeof Conversation>;
export type TMessage = z.infer<typeof Message>;
export type TNotification = z.infer<typeof Notification>;
