import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Calculator, Package, ShoppingCart, Receipt, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

interface OrderItem {
  id: string;
  item_type: string;
  quantity: number;
  sale_net: number;
  purchase_net: number;
  total_sale_net: number;
  total_purchase_net: number;
}

interface OrderCostSummaryProps {
  orderId: string;
  orderItems: OrderItem[];
  laborNet: number;
  partsNet: number;
  extraCostNet: number;
}

export function OrderCostSummary({ orderId, orderItems, laborNet, partsNet, extraCostNet }: OrderCostSummaryProps) {
  const { data: purchaseRequests = [] } = useQuery({
    queryKey: ["purchase-requests", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("id, item_name, quantity, estimated_net, estimated_gross, status")
        .eq("order_id", orderId)
        .neq("status", "CANCELLED");
      if (error) throw error;
      return data ?? [];
    },
  });

  const costs = useMemo(() => {
    const vatRate = 1.23;

    // 1. Inventory parts cost (PRODUCT items from order_items)
    const inventoryItems = orderItems.filter(i => i.item_type === "PRODUCT");
    const inventoryCostNet = inventoryItems.reduce((s, i) => s + i.total_purchase_net, 0);
    const inventoryCostGross = inventoryCostNet * vatRate;

    // 2. Purchase request costs (external procurement)
    const procurementCostGross = purchaseRequests.reduce((s, r: any) => s + (Number(r.estimated_gross) || 0), 0);
    const procurementCostNet = purchaseRequests.reduce((s, r: any) => s + (Number(r.estimated_net) || 0), 0);

    // 3. Internal/manual costs from order_items (INTERNAL_COST type)
    const internalItems = orderItems.filter(i => i.item_type === "INTERNAL_COST");
    const internalCostNet = internalItems.reduce((s, i) => s + i.total_purchase_net, 0);
    const internalCostGross = internalCostNet * vatRate;

    // 4. Extra cost from order header fields (parts_net + extra_cost_net)
    const headerExtraCostNet = partsNet + extraCostNet;
    const headerExtraCostGross = headerExtraCostNet * vatRate;

    // Total costs
    const totalCostNet = inventoryCostNet + procurementCostNet + internalCostNet + headerExtraCostNet;
    const totalCostGross = inventoryCostGross + procurementCostGross + internalCostGross + headerExtraCostGross;

    // Revenue: labor + service items + product sale prices
    const itemsRevenueNet = orderItems.reduce((s, i) => s + i.total_sale_net, 0);
    const revenueNet = laborNet + itemsRevenueNet;
    const revenueGross = revenueNet * vatRate;

    // Profit
    const profitGross = revenueGross - totalCostGross;
    const marginPercent = revenueGross > 0 ? (profitGross / revenueGross) * 100 : 0;

    return {
      inventoryCostGross,
      procurementCostGross,
      internalCostGross,
      headerExtraCostGross,
      totalCostGross,
      revenueGross,
      profitGross,
      marginPercent,
    };
  }, [orderItems, purchaseRequests, laborNet, partsNet, extraCostNet]);

  const isProfit = costs.profitGross >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Podsumowanie kosztów
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {/* Cost breakdown */}
        <CostRow
          icon={<Package className="h-3.5 w-3.5" />}
          label="Części z magazynu"
          value={costs.inventoryCostGross}
        />
        <CostRow
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label="Zapotrzebowanie"
          value={costs.procurementCostGross}
        />
        <CostRow
          icon={<Receipt className="h-3.5 w-3.5" />}
          label="Koszty dodatkowe"
          value={costs.internalCostGross + costs.headerExtraCostGross}
        />

        <Separator className="my-2" />

        {/* Totals */}
        <div className="flex justify-between items-center font-medium">
          <span>Koszt razem</span>
          <span className="font-mono">{fmt(costs.totalCostGross)}</span>
        </div>
        <div className="flex justify-between items-center font-medium">
          <span>Cena dla klienta</span>
          <span className="font-mono">{fmt(costs.revenueGross)}</span>
        </div>

        <Separator className="my-2" />

        {/* Profit & Margin */}
        <div className="flex justify-between items-center font-semibold">
          <span className="flex items-center gap-1.5">
            {isProfit ? (
              <TrendingUp className="h-4 w-4 text-primary" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            Zysk
          </span>
          <span className={cn("font-mono", isProfit ? "text-primary" : "text-destructive")}>
            {fmt(costs.profitGross)}
          </span>
        </div>
        <div className="flex justify-between items-center text-muted-foreground">
          <span>Marża</span>
          <span className={cn(
            "font-mono font-medium",
            costs.marginPercent >= 30 ? "text-primary" : costs.marginPercent >= 0 ? "text-foreground" : "text-destructive"
          )}>
            {costs.marginPercent.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CostRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex justify-between items-center text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="font-mono tabular-nums">
        {value > 0 ? fmt(value) : "—"}
      </span>
    </div>
  );
}
