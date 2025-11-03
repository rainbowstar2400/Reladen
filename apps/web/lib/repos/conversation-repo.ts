"use client";
import { supabase } from "../supabase/client";
import { Conversation, Message, Notification, type TConversation, type TMessage, type TNotification } from "../schemas/conversation";
import { upsertConversations, upsertMessages, upsertNotifications } from "../idb/conversation-store";

export async function createConversation(input: { topic?: string | null; created_by: string; firstMessage?: { sender_type: TMessage["sender_type"]; sender_id?: string | null; content: string } }) {
  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ topic: input.topic ?? null, created_by: input.created_by, state: "open" })
    .select("*")
    .single();

  if (error) throw error;

  // 通知
  const { data: notif, error: nerr } = await supabase
    .from("notifications")
    .insert({
      kind: "conversation_created",
      ref_id: conv.id,
      title: input.topic ?? "新しい会話が始まりました",
      body: "お知らせをクリックして会話を開く",
    })
    .select("*")
    .single();

  if (nerr) throw nerr;

  await upsertConversations([conv]);
  await upsertNotifications([notif]);

  if (input.firstMessage) {
    await appendMessage({
      conversation_id: conv.id,
      sender_type: input.firstMessage.sender_type,
      sender_id: input.firstMessage.sender_id ?? null,
      content: input.firstMessage.content,
    });
  }
  return conv as TConversation;
}

export async function appendMessage(input: { conversation_id: string; sender_type: TMessage["sender_type"]; sender_id?: string | null; content: string }) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversation_id,
      sender_type: input.sender_type,
      sender_id: input.sender_id ?? null,
      content: input.content,
    })
    .select("*")
    .single();

  if (error) throw error;
  // 成功後にIDBへ
  await upsertMessages([data as TMessage]);
  return data as TMessage;
}

export function subscribeRealtime(onMessage: (m: TMessage) => void, onConversation?: (c: TConversation) => void, onNotification?: (n: TNotification) => void) {
  const ch = supabase
    .channel("conv_realtime")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
      const parsed = Message.safeParse(payload.new);
      if (parsed.success) {
        upsertMessages([parsed.data]);
        onMessage(parsed.data);
      }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, (payload) => {
      const parsed = Conversation.safeParse(payload.new);
      if (parsed.success) {
        upsertConversations([parsed.data]);
        onConversation?.(parsed.data);
      }
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
      const parsed = Notification.safeParse(payload.new);
      if (parsed.success) {
        upsertNotifications([parsed.data]);
        onNotification?.(parsed.data);
      }
    })
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}
