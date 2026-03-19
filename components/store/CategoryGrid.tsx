"use client";

import { getIconForCategory } from "@/data/inventory";
import "./CategoryGrid.css";

interface CategoryItem {
  name: string;
  count: number;
}

interface CategoryGridProps {
  categories: CategoryItem[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
  filterQuery?: string;
}

export function CategoryGrid({ categories, activeCategory, onSelect, filterQuery }: CategoryGridProps) {
  // Filter categories based on search query
  const visible = filterQuery
    ? categories.filter((c) => c.count > 0)
    : categories;

  if (visible.length === 0) return null;

  return (
    <div className="cat-list">
      {visible.map((cat) => {
        const Icon = getIconForCategory(cat.name);
        const isActive = activeCategory === cat.name;
        return (
          <button
            key={cat.name}
            className={`cat-list-item${isActive ? " cat-list-item--active" : ""}`}
            onClick={() => onSelect(isActive ? null : cat.name)}
            type="button"
          >
            <Icon size={16} strokeWidth={1.5} className="cat-list-icon" />
            <span className="cat-list-name">{cat.name}</span>
            <span className="cat-list-count">{cat.count}</span>
          </button>
        );
      })}
    </div>
  );
}
