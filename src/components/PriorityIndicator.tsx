import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_PRIORITY_LABELS, type OrderPriority } from "@/types/database";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const LEVEL_MAP: Record<OrderPriority, number> = {
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

const PRIORITIES: OrderPriority[] = ["NORMAL", "HIGH", "URGENT"];

function Flames({ level, size = "h-4 w-4" }: { level: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <Flame
          key={i}
          className={cn(size, i <= level ? "text-destructive" : "text-muted-foreground/25")}
          fill={i <= level ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function PriorityIndicator({ priority }: { priority: OrderPriority }) {
  const level = LEVEL_MAP[priority] ?? 1;

  return (
    <div title={ORDER_PRIORITY_LABELS[priority]}>
      <Flames level={level} />
    </div>
  );
}

export function PrioritySelector({
  priority,
  onSelect,
}: {
  priority: OrderPriority;
  onSelect: (p: OrderPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  const level = LEVEL_MAP[priority] ?? 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="hover:opacity-80 transition-opacity" title="Zmień priorytet">
          <Flames level={level} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 space-y-1" align="start">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            onClick={() => { onSelect(p); setOpen(false); }}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-1.5 rounded text-sm hover:bg-muted transition-colors",
              p === priority && "bg-muted font-medium"
            )}
          >
            <Flames level={LEVEL_MAP[p]} size="h-3.5 w-3.5" />
            <span>{ORDER_PRIORITY_LABELS[p]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
