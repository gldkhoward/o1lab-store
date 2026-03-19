"use client";

import type { RawInventoryItem } from "@/data/inventory";
import { StatusBadge } from "@/components/ui/StatusBadge";
import "./ItemCard.css";

interface ItemCardProps {
  item: RawInventoryItem;
  onClick?: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <article className="item-card" onClick={onClick} tabIndex={0}>
      <h3 className="item-card-name">{item.name}</h3>
      <div className="item-card-meta">
        <span className="item-card-qty">{item.quantity} {item.unit}</span>
        <span className="item-card-dot">·</span>
        <span className="item-card-sub">{item.subcategory}</span>
        <span className="item-card-dot">·</span>
        <StatusBadge status={item.status} />
      </div>
    </article>
  );
}
