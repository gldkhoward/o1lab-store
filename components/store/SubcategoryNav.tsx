"use client";

import "./SubcategoryNav.css";

interface SubcategoryNavProps {
  subcategories: string[];
  activeSubcategory: string | null;
  onSubcategoryChange: (subcategory: string | null) => void;
  itemCounts: Record<string, number>;
}

export function SubcategoryNav({
  subcategories,
  activeSubcategory,
  onSubcategoryChange,
  itemCounts,
}: SubcategoryNavProps) {
  if (subcategories.length === 0) return null;

  return (
    <nav className="subcategory-nav">
      <button
        className={`subcategory-nav-item${activeSubcategory === null ? " active" : ""}`}
        onClick={() => onSubcategoryChange(null)}
        type="button"
      >
        All
      </button>
      {subcategories.map((sub) => (
        <button
          key={sub}
          className={`subcategory-nav-item${activeSubcategory === sub ? " active" : ""}`}
          onClick={() => onSubcategoryChange(sub)}
          type="button"
        >
          {sub}
          {itemCounts[sub] != null && (
            <span className="subcategory-nav-count">{itemCounts[sub]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
