import { Dialog, DialogContent } from "@/components/ui/dialog";
import OrderDetailPage from "@/pages/OrderDetailPage";

interface OrderQuickEditDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderQuickEditDialog({ orderId, open, onOpenChange }: OrderQuickEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[84vh] overflow-y-auto p-4">
        {orderId && open && (
          <OrderDetailPage orderId={orderId} isDialog />
        )}
      </DialogContent>
    </Dialog>
  );
}
