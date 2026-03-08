import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, User } from "lucide-react";

interface Message {
  id: string;
  sender_type: "CLIENT" | "STAFF";
  sender_name: string;
  message: string;
  created_at: string;
}

interface Props {
  token?: string | null;
  orderNumber?: string;
  phone?: string;
  orderId?: string;
}

export default function CustomerMessagesPublic({ token, orderNumber, phone }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const authPayload = token ? { token } : { order_number: orderNumber, phone };

  async function fetchMessages() {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("order-status", {
        body: { ...authPayload, action: "get_messages" },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Błąd");
      setMessages(data.messages ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [token, orderNumber, phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!newMessage.trim()) return;
    setSending(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("order-status", {
        body: { ...authPayload, action: "send_message", message: newMessage.trim(), sender_name: "Klient" },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Błąd wysyłania");
      setNewMessage("");
      await fetchMessages();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Wiadomości z serwisem
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : (
          <>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Brak wiadomości. Napisz do serwisu poniżej.
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender_type === "CLIENT" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                      m.sender_type === "CLIENT"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                    <span className="font-medium">
                      {m.sender_type === "CLIENT" ? "Ty" : m.sender_name}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(m.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                      {" "}
                      {new Date(m.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Textarea
                placeholder="Napisz wiadomość do serwisu..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={2}
                className="flex-1 text-sm"
                maxLength={2000}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="shrink-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
