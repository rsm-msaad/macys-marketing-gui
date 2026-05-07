"use client";

import { CheckCircle2, ShoppingBag } from "lucide-react";

import { ApprovalActions, ContextStack, type StepContentProps } from "./shared";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  in_stock: { bg: "#dcfce7", text: "#15803d" },
  low_stock: { bg: "#fef9c3", text: "#854d0e" },
  out_of_stock: { bg: "#fee2e2", text: "#991b1b" },
};

export function SKUSelectionContent({
  context,
  canAct,
  busy,
  onApprove,
  onRequestRevisions,
}: StepContentProps) {
  const skus = context.mock_data.sku_suggestions;
  const totalRevenue = skus.reduce((acc, s) => acc + s.base_price, 0);

  return (
    <div className="space-y-3">
      <ContextStack context={context} />

      <div className="rounded-md border border-charcoal/10 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-teal-600" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">
              Suggested SKU list ({skus.length})
            </span>
          </div>
          <span className="text-[11px] text-charcoal/55">
            Combined catalog price: ${totalRevenue.toFixed(0)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="border-b border-charcoal/10 text-charcoal/55">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Brand</th>
                <th className="px-2 py-1.5 text-left font-medium">SKU</th>
                <th className="px-2 py-1.5 text-right font-medium">Price</th>
                <th className="px-2 py-1.5 text-left font-medium">Stock</th>
                <th className="px-2 py-1.5 text-right font-medium">Margin</th>
                <th className="px-2 py-1.5 text-right font-medium">Match</th>
                <th className="px-2 py-1.5 text-left font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => {
                const badge = STATUS_BADGE[s.inventory_status] ?? STATUS_BADGE.in_stock;
                return (
                  <tr key={s.sku_id} className="border-b border-charcoal/5">
                    <td className="px-2 py-1.5 font-medium text-charcoal/85">{s.brand}</td>
                    <td className="px-2 py-1.5 text-charcoal/75">{s.name}</td>
                    <td className="px-2 py-1.5 text-right text-charcoal/85">
                      ${s.base_price.toFixed(0)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: badge.bg, color: badge.text }}
                      >
                        {s.inventory_status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-charcoal/70">
                      {(s.margin_pct * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="font-semibold text-teal-700">
                        {(s.segment_match_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-charcoal/65">{s.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-sage">
          <CheckCircle2 className="h-3 w-3" />
          All 18 SKUs validated against the brief constraints (no prestige skincare).
        </div>
      </div>

      <ApprovalActions
        canAct={canAct}
        busy={busy}
        primaryLabel={`Approve ${skus.length} SKUs`}
        secondaryLabel="Request Different SKUs"
        stepNumber={3}
        onPrimary={() =>
          onApprove("Approve SKU List", {
            approved_skus: skus.map((s) => s.sku_id),
          })
        }
        onRequestRevisions={() => onRequestRevisions(3, 2)}
      />
    </div>
  );
}
