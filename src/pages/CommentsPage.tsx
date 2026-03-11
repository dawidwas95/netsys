import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Check, Eye, EyeOff, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function CommentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  // Fetch all comments with order info and author profile
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["all-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_order_comments")
        .select(`
          id, comment, created_at, user_id, order_id, is_internal,
          service_orders!inner(order_number, deleted_at),
          profiles!service_order_comments_user_id_fkey(first_name, last_name, email)
        `)
        .is("deleted_at", null)
        .is("service_orders.deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  // Fetch read statuses for current user
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

  // Mark as read
  const markRead = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comment_reads" as any).insert({
        comment_id: commentId,
        user_id: user!.id,
      });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-reads"] });
    },
  });

  // Mark as unread
  const markUnread = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comment_reads" as any)
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-reads"] });
    },
  });

  // Mark all visible as read
  const markAllRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const toInsert = ids
        .filter((id) => !readIds.has(id))
        .map((comment_id) => ({ comment_id, user_id: user!.id }));
      if (toInsert.length === 0) return;
      const { error } = await supabase.from("comment_reads" as any).insert(toInsert);
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comment-reads"] });
      toast.success("Wszystkie oznaczone jako przeczytane");
    },
  });

  const filtered = comments.filter((c: any) => {
    const isRead = readIds.has(c.id);
    if (filter === "unread" && isRead) return false;
    if (filter === "read" && !isRead) return false;
    if (search) {
      const q = search.toLowerCase();
      const authorName = [c.profiles?.first_name, c.profiles?.last_name].filter(Boolean).join(" ").toLowerCase();
      const orderNum = (c.service_orders?.order_number || "").toLowerCase();
      return c.comment.toLowerCase().includes(q) || authorName.includes(q) || orderNum.includes(q);
    }
    return true;
  });

  const unreadCount = comments.filter((c: any) => !readIds.has(c.id)).length;

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
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllRead.mutate(filtered.map((c: any) => c.id))}
            >
              <Check className="h-4 w-4 mr-1" />
              Oznacz wszystkie
            </Button>
          )}
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
            const isRead = readIds.has(c.id);
            const authorName = [c.profiles?.first_name, c.profiles?.last_name].filter(Boolean).join(" ") || c.profiles?.email || "—";
            const orderNumber = c.service_orders?.order_number || "—";

            return (
              <Card
                key={c.id}
                className={`transition-colors ${!isRead ? "border-destructive/50 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{authorName}</span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {" "}
                          {new Date(c.created_at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="text-muted-foreground text-xs">·</span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary"
                          onClick={() => navigate(`/orders/${c.order_id}`)}
                        >
                          {orderNumber}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                        {!isRead && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">nowy</Badge>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{c.comment}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`shrink-0 h-8 w-8 ${isRead ? "text-green-600 hover:text-destructive" : "text-destructive hover:text-green-600"}`}
                      onClick={() => isRead ? markUnread.mutate(c.id) : markRead.mutate(c.id)}
                      title={isRead ? "Oznacz jako nieprzeczytany" : "Oznacz jako przeczytany"}
                    >
                      {isRead ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
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
