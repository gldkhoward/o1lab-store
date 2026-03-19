"use client";

import "./CategoryFilter.css";

interface CategoryFilterProps {
  categories: string[];
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  categoryCounts: Record<string, number>;
  totalCount: number;
}

export function CategoryFilter({
  categories,
  activeCategory,
  onCategoryChange,
  categoryCounts,
  totalCount,
}: CategoryFilterProps) {
  return (
    <div className="category-filter">
      <button
        className={`category-filter-btn${activeCategory === null ? " active" : ""}`}
        onClick={() => onCategoryChange(null)}
        type="button"
      >
        All <span className="category-filter-count">{totalCount}</span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          className={`category-filter-btn${activeCategory === cat ? " active" : ""}`}
          onClick={() => onCategoryChange(cat)}
          type="button"
        >
          {cat} <span className="category-filter-count">{categoryCounts[cat] || 0}</span>
        </button>
      ))}
    </div>
  );
}
