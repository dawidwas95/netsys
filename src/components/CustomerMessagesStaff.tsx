import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orderId: string;
}

export default function CustomerMessagesStaff({ orderId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const staffName = useMemo(() => {
    if (!profile) return "Serwis";
    return [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email || "Serwis";
  }, [profile]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["customer-messages", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_messages" as any)
        .select("*")
        .eq("service_order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 10000,
  });

  // Mark client messages as read by staff
  useEffect(() => {
    const unread = messages.filter((m: any) => m.sender_type === "CLIENT" && !m.is_read_by_staff);
    if (unread.length > 0) {
      supabase
        .from("customer_messages" as any)
        .update({ is_read_by_staff: true })
        .eq("service_order_id", orderId)
        .eq("sender_type", "CLIENT")
        .eq("is_read_by_staff", false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["customer-messages", orderId] });
          queryClient.invalidateQueries({ queryKey: ["customer-messages-unread"] });
          queryClient.invalidateQueries({ queryKey: ["unread-orders"] });
        });
    }
  }, [messages, orderId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!reply.trim()) return;
      const { error } = await supabase.from("customer_messages" as any).insert({
        service_order_id: orderId,
        sender_type: "STAFF",
        sender_user_id: user?.id,
        sender_name: staffName,
        message: reply.trim(),
        is_read_by_staff: true,
        is_read_by_client: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["customer-messages", orderId] });
      toast.success("Odpowiedź wysłana");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Brak wiadomości od klienta</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
            {messages.map((m: any) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender_type === "STAFF" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                    m.sender_type === "STAFF"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                  <span className="font-medium">{m.sender_name}</span>
                  <span>·</span>
                  <span>
                    {new Date(m.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    {" "}
                    {new Date(m.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {m.sender_type === "CLIENT" && !m.is_read_by_staff && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">nowa</Badge>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            placeholder="Odpowiedz klientowi..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendReply.mutate();
              }
            }}
          />
          <Button
            size="icon"
            onClick={() => sendReply.mutate()}
            disabled={!reply.trim() || sendReply.isPending}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
