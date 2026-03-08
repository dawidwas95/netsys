import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useRef, useCallback } from "react";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_order_id: string | null;
  related_comment_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef<number | null>(null);

  // Lazy-init audio
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YToFAABkAHwAkACYAJgAkAB8AGQARAAgAAAA4ADAAKAAiABwAFgAQAAoABAAAADo/9D/uP+g/4j/eP9o/1j/UP9I/0D/QP9A/0j/UP9Y/2j/eP+I/6D/uP/Q/+j/AAEYATABQAFIAUgBQAEwARgBAAHo/9D/uP+g/4j/eP9o/2D/WP9Y/1j/YP9o/3j/iP+g/7j/0P/o/wABGAEwAUABSAFIAUABMAEYAQAB6P/Q/7j/oP+I/3j/aP9g/1j/WP9Y/2D/aP94/4j/oP+4/9D/6P8=");
      audioRef.current.volume = 0.3;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Play sound when unread count increases
  useEffect(() => {
    if (prevCountRef.current !== null && unreadCount > prevCountRef.current) {
      playNotificationSound();
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount, playNotificationSound]);

  // Realtime subscription for instant updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearAll };
}

export function useUnreadOrders() {
  const { user } = useAuth();

  const { data: unreadOrderIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["unread-orders", user?.id],
    queryFn: async () => {
      // Get user's last read timestamps
      const { data: reads } = await supabase
        .from("user_order_reads")
        .select("order_id, last_read_at")
        .eq("user_id", user!.id);

      const readMap = new Map<string, string>();
      (reads ?? []).forEach((r: any) => readMap.set(r.order_id, r.last_read_at));

      // Get recent comments and check which orders have newer activity
      const { data: recentComments } = await supabase
        .from("service_order_comments")
        .select("order_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      // Get recent customer messages
      const { data: recentMessages } = await supabase
        .from("customer_messages")
        .select("service_order_id, created_at")
        .eq("sender_type", "CLIENT")
        .order("created_at", { ascending: false })
        .limit(200);

      const unread = new Set<string>();

      (recentComments ?? []).forEach((c: any) => {
        const lastRead = readMap.get(c.order_id);
        if (!lastRead || new Date(c.created_at) > new Date(lastRead)) {
          unread.add(c.order_id);
        }
      });

      (recentMessages ?? []).forEach((m: any) => {
        const lastRead = readMap.get(m.service_order_id);
        if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
          unread.add(m.service_order_id);
        }
      });

      return unread;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  return { unreadOrderIds, isLoading };
}

export function useMarkOrderAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("user_order_reads")
        .upsert(
          { user_id: user.id, order_id: orderId, last_read_at: new Date().toISOString() },
          { onConflict: "user_id,order_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unread-orders", user?.id] });
    },
  });
}

/** Create notifications for @mentioned users in a comment */
export async function createMentionNotifications(
  commentText: string,
  orderId: string,
  commentId: string,
  authorName: string,
  orderNumber: string,
  profileMap: Record<string, { userId: string; name: string }>
) {
  const mentionRegex = /@(\S+)/g;
  let match;
  const mentionedUserIds = new Set<string>();

  while ((match = mentionRegex.exec(commentText)) !== null) {
    const mentionName = match[1].toLowerCase();
    // Find matching profile by first_name, last_name, or full_name
    for (const [, profile] of Object.entries(profileMap)) {
      const nameParts = profile.name.toLowerCase().split(" ");
      if (nameParts.some((part) => part === mentionName) || profile.name.toLowerCase().replace(/\s/g, "") === mentionName) {
        mentionedUserIds.add(profile.userId);
      }
    }
  }

  if (mentionedUserIds.size === 0) return;

  const notifications = Array.from(mentionedUserIds).map((userId) => ({
    user_id: userId,
    type: "MENTION",
    title: `${authorName} wspomniał/a o Tobie`,
    body: `W komentarzu do zlecenia ${orderNumber}: "${commentText.substring(0, 100)}${commentText.length > 100 ? "..." : ""}"`,
    related_order_id: orderId,
    related_comment_id: commentId,
  }));

  await supabase.from("notifications").insert(notifications);
}

/** Create notification for all relevant users about a new comment */
export async function createCommentNotification(
  orderId: string,
  commentId: string,
  authorId: string,
  authorName: string,
  orderNumber: string
) {
  // Notify technicians assigned to this order
  const { data: technicians } = await supabase
    .from("order_technicians")
    .select("user_id")
    .eq("order_id", orderId);

  const userIds = new Set<string>();
  (technicians ?? []).forEach((t: any) => {
    if (t.user_id !== authorId) userIds.add(t.user_id);
  });

  if (userIds.size === 0) return;

  const notifications = Array.from(userIds).map((userId) => ({
    user_id: userId,
    type: "COMMENT",
    title: "Nowy komentarz",
    body: `${authorName} dodał/a komentarz do zlecenia ${orderNumber}`,
    related_order_id: orderId,
    related_comment_id: commentId,
  }));

  await supabase.from("notifications").insert(notifications);
}
