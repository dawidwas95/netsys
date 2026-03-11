import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Eye, EyeOff, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { renderCommentWithMentions } from "@/components/MentionTextarea";

export default function CommentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["all-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_comments")
        .select("id, comment, created_at, user_id, order_id, is_internal")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  // Fetch order info with client and device
  const orderIds = useMemo(() => [...new Set(comments.map((c: any) => c.order_id))], [comments]);
  const { data: ordersMap = {} } = useQuery({
    queryKey: ["orders-map-full", orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return {};
      const { data } = await supabase
        .from("service_orders")
        .select("id, order_number, clients(display_name, first_name, last_name, company_name, address_city, address_street), devices(manufacturer, model)")
        .in("id", orderIds)
        .is("deleted_at", null);
      const map: Record<string, any> = {};
      (data ?? []).forEach((o: any) => { map[o.id] = o; });
      return map;
    },
    enabled: orderIds.length > 0,
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, email");
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        map[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik";
      });
      return map;
    },
  });

  const { data: readIds = new Set<string>() } = useQuery({
    queryKey: ["comment-reads", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comment_reads" as any)
        .select("comment_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data as any[]).map((r: any) => r.comment_id));
    },
    enabled: !!user?.id,
  });

  const markRead = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comment_reads" as any).insert({
        comment_id: commentId,
        user_id: user!.id,
      });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comment-reads"] }),
  });

  const markUnread = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comment_reads" as any)
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comment-reads"] }),
  });

  const visibleComments = useMemo(() => {
    return comments.filter((c: any) => ordersMap[c.order_id]);
  }, [comments, ordersMap]);

  const filtered = visibleComments.filter((c: any) => {
    const isOwn = c.user_id === user?.id;
    const isRead = isOwn || readIds.has(c.id);
    if (filter === "unread" && isRead) return false;
    if (filter === "read" && !isRead) return false;
    if (search) {
      const q = search.toLowerCase();
      const authorName = (profileMap[c.user_id] || "").toLowerCase();
      const orderInfo = ordersMap[c.order_id];
      const orderNum = (orderInfo?.order_number || "").toLowerCase();
      const clientName = (orderInfo?.clients?.display_name || orderInfo?.clients?.company_name || "").toLowerCase();
      return c.comment.toLowerCase().includes(q) || authorName.includes(q) || orderNum.includes(q) || clientName.includes(q);
    }
    return true;
  });

  const unreadCount = visibleComments.filter((c: any) => c.user_id !== user?.id && !readIds.has(c.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Komentarze</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">{unreadCount} nieprzeczytanych</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              <SelectItem value="unread">Nieprzeczytane</SelectItem>
              <SelectItem value="read">Przeczytane</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Ładowanie...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Brak komentarzy do wyświetlenia</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => {
            const isOwn = c.user_id === user?.id;
            const isRead = isOwn || readIds.has(c.id);
            const authorName = profileMap[c.user_id] || "—";
            const orderInfo = ordersMap[c.order_id];
            const orderNumber = orderInfo?.order_number || "—";
            const client = orderInfo?.clients;
            const device = orderInfo?.devices;
            const clientName = client?.display_name || client?.company_name || [client?.first_name, client?.last_name].filter(Boolean).join(" ") || "";
            const clientAddress = [client?.address_street, client?.address_city].filter(Boolean).join(", ");
            const deviceName = [device?.manufacturer, device?.model].filter(Boolean).join(" ");

            return (
              <Card
                key={c.id}
                className={`transition-colors ${isOwn ? "border-border" : !isRead ? "border-destructive/50 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Order info row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-sm font-bold text-primary"
                          onClick={() => navigate(`/orders/${c.order_id}`)}
                        >
                          {orderNumber}
                          <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </Button>
                        {clientName && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs font-medium">{clientName}</span>
                          </>
                        )}
                        {clientAddress && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{clientAddress}</span>
                          </>
                        )}
                        {deviceName && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground">{deviceName}</span>
                          </>
                        )}
                      </div>
                      {/* Author + date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground">{authorName}</span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {" "}
                          {new Date(c.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {!isOwn && !isRead && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">nowy</Badge>
                        )}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {renderCommentWithMentions(c.comment)}
                      </div>
                    </div>
                    {!isOwn && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`shrink-0 h-10 w-10 ${isRead ? "text-green-600 hover:text-destructive" : "text-destructive hover:text-green-600"}`}
                        onClick={() => readIds.has(c.id) ? markUnread.mutate(c.id) : markRead.mutate(c.id)}
                        title={isRead ? "Oznacz jako nieprzeczytany" : "Oznacz jako przeczytany"}
                      >
                        {readIds.has(c.id) ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
