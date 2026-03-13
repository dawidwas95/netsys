import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderPriority } from "@/types/database";

const LEVEL_MAP: Record<OrderPriority, number> = {
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

const ACTIVE_COLORS: Record<OrderPriority, string> = {
  NORMAL: "text-primary",
  HIGH: "text-warning",
  URGENT: "text-destructive",
};

export function PriorityIndicator({ priority }: { priority: OrderPriority }) {
  const level = LEVEL_MAP[priority] ?? 1;
  const activeColor = ACTIVE_COLORS[priority] ?? "text-primary";

  return (
    <div className="flex items-center gap-0.5" title={`Priorytet: ${priority}`}>
      {[1, 2, 3].map((i) => (
        <Flame
          key={i}
          className={cn("h-3.5 w-3.5", i <= level ? activeColor : "text-muted-foreground/30")}
          fill={i <= level ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}
