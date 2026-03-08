import { useState } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, MessageSquare, AtSign, UserPlus, CheckCheck, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof Bell> = {
  MENTION: AtSign,
  COMMENT: MessageSquare,
  MESSAGE: MessageSquare,
  ASSIGNMENT: UserPlus,
};

const TYPE_COLORS: Record<string, string> = {
  MENTION: "text-amber-500",
  COMMENT: "text-blue-500",
  MESSAGE: "text-green-500",
  ASSIGNMENT: "text-purple-500",
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "teraz";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} godz.`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} dn.`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.related_order_id) {
      navigate(`/orders/${n.related_order_id}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] bg-destructive text-destructive-foreground border-2 border-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Powiadomienia</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAllAsRead.mutate()}>
                <CheckCheck className="mr-1 h-3 w-3" /> Odczytaj
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => clearAll.mutate()}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Brak powiadomień
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              const iconColor = TYPE_COLORS[n.type] || "text-muted-foreground";
              return (
                <button
                  key={n.id}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 transition-colors flex gap-3",
                    !n.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleClick(n)}
                >
                  <div className={cn("mt-0.5 shrink-0", iconColor)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", !n.is_read && "font-semibold")}>{n.title}</span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />}
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-1 block">{timeAgo(n.created_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
