"use client";

import type { RawInventoryItem } from "@/data/inventory";
import { getIconForCategory } from "@/data/inventory";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tag } from "@/components/ui/Tag";
import { X } from "lucide-react";
import "./ItemDetail.css";

interface ItemDetailProps {
  item: RawInventoryItem;
  onClose: () => void;
}

export function ItemDetail({ item, onClose }: ItemDetailProps) {
  const Icon = getIconForCategory(item.category);

  // Build spec-like rows from the available fields
  const details: [string, string][] = [];
  if (item.partNumber) details.push(["Part Number", item.partNumber]);
  details.push(["Quantity", `${item.quantity} ${item.unit}`]);
  details.push(["Source", item.source]);
  if (item.notes) details.push(["Notes", item.notes]);

  return (
    <div className="item-detail-overlay" onClick={onClose}>
      <div className="item-detail" onClick={(e) => e.stopPropagation()}>
        <button className="item-detail-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={1.5} />
        </button>

        <div className="item-detail-top">
          <span className="item-detail-icon">
            <Icon size={32} strokeWidth={1.5} />
          </span>
          <div>
            <span className="item-detail-category-label">
              {item.category} / {item.subcategory}
            </span>
            <h2 className="item-detail-name">{item.name}</h2>
          </div>
        </div>

        <div className="item-detail-meta">
          <StatusBadge status={item.status} />
          <span className="item-detail-qty">
            <span className="item-detail-qty-num">{item.quantity}</span>
            <span className="item-detail-qty-label">{item.unit}</span>
          </span>
          <span className="item-detail-id">{item.id}</span>
        </div>

        <p className="item-detail-desc">{item.description}</p>

        <div className="item-detail-specs">
          <h4 className="item-detail-section-label">Details</h4>
          <table className="item-detail-specs-table">
            <tbody>
              {details.map(([key, value]) => (
                <tr key={key}>
                  <td className="item-detail-spec-key">{key}</td>
                  <td className="item-detail-spec-val">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {item.relatedCategories.length > 0 && (
          <div className="item-detail-related">
            <h4 className="item-detail-section-label">Related</h4>
            <div className="item-detail-tags-list">
              {item.relatedCategories.map((cat) => (
                <Tag key={cat} label={cat} />
              ))}
            </div>
          </div>
        )}

        {item.tags.length > 0 && (
          <div className="item-detail-tags">
            <h4 className="item-detail-section-label">Tags</h4>
            <div className="item-detail-tags-list">
              {item.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
