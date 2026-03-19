"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { SearchInput } from "@/components/ui/SearchInput";
import { CategoryGrid } from "@/components/store/CategoryGrid";
import { SubcategoryNav } from "@/components/store/SubcategoryNav";
import { StoreVisual } from "@/components/store/StoreVisual";
import { ItemCard } from "@/components/store/ItemCard";
import { ItemDetail } from "@/components/store/ItemDetail";
import { ChevronDown } from "lucide-react";
import {
  searchInventory,
  getCategories,
  getSubcategories,
  type RawInventoryItem,
  type InventoryData,
} from "@/data/inventory";
import "./page.css";

export default function StorePage() {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<RawInventoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RawInventoryItem | null>(null);

  // Load inventory
  useEffect(() => {
    fetch("/inventory.json")
      .then((res) => res.json())
      .then((data: InventoryData) => setItems(data.items));
  }, []);

  // Categories with counts based on current search query
  const categories = useMemo(() => {
    const filtered = searchInventory(items, query);
    const cats = getCategories(items);
    return cats.map((name) => ({
      name,
      count: filtered.filter((i) => i.category === name).length,
    }));
  }, [items, query]);

  // Results filtered by query + category + subcategory
  const results = useMemo(() => {
    return searchInventory(items, query, {
      category: activeCategory ?? undefined,
      subcategory: activeSubcategory ?? undefined,
    });
  }, [items, query, activeCategory, activeSubcategory]);

  // Subcategories for active category (based on query-filtered items)
  const subcategoryList = useMemo(() => {
    if (!activeCategory) return [];
    const filtered = searchInventory(items, query, { category: activeCategory });
    return getSubcategories(filtered, activeCategory);
  }, [items, query, activeCategory]);

  // Subcategory counts
  const subcategoryCounts = useMemo(() => {
    if (!activeCategory) return {};
    const filtered = searchInventory(items, query, { category: activeCategory });
    const counts: Record<string, number> = {};
    filtered.forEach((i) => {
      counts[i.subcategory] = (counts[i.subcategory] || 0) + 1;
    });
    return counts;
  }, [items, query, activeCategory]);

  const isBrowsing = query.length > 0 || activeCategory !== null;

  const handleCategorySelect = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  }, []);

  const handleSubcategoryChange = useCallback((sub: string | null) => {
    setActiveSubcategory(sub);
  }, []);

  const scrollToBrowse = useCallback(() => {
    browseRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Cursor follower
  useEffect(() => {
    const dot = cursorDotRef.current;
    if (!dot) return;
    if ("ontouchstart" in window) { dot.style.display = "none"; return; }
    let mx = 0, my = 0, dx = 0, dy = 0, id: number;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    function tick() {
      dx += (mx - dx) * 0.12; dy += (my - dy) * 0.12;
      dot!.style.left = (dx - 8) + "px"; dot!.style.top = (dy - 8) + "px";
      id = requestAnimationFrame(tick);
    }
    document.addEventListener("mousemove", onMove); tick();
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(id); };
  }, []);

  // Escape to close detail
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedItem(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Lock scroll when detail open
  useEffect(() => {
    document.body.style.overflow = selectedItem ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedItem]);

  return (
    <>
      <div className="cursor-dot" ref={cursorDotRef} />
      <Nav />

      {/* ═══ HERO ═══ */}
      <section className="hero">
        <div className="hero-left">
          <h1 className="hero-title">
            <span className="hero-title-accent">o1</span> lab<br />store
          </h1>
          <p className="hero-subtitle">
            Free consumables and tools for all<br />
            Browse · Check out · Return<br />
            Sydney, AU
          </p>
        </div>
        <div className="hero-right">
          <StoreVisual itemCount={items.length} />
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-num">{items.length}</span>
              <span className="hero-stat-label">Items</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">{categories.length}</span>
              <span className="hero-stat-label">Categories</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">
                {items.filter((i) => i.status === "In Stock").length}
              </span>
              <span className="hero-stat-label">Available</span>
            </div>
          </div>
        </div>
        <button className="hero-arrow" onClick={scrollToBrowse} aria-label="Browse inventory">
          <ChevronDown size={24} strokeWidth={1.5} />
        </button>
      </section>

      {/* ═══ BROWSE ═══ */}
      <section className="browse" ref={browseRef} onClick={scrollToBrowse}>
        <div className="browse-sidebar">
          <div className="browse-search">
            <SearchInput value={query} onChange={setQuery} onFocus={scrollToBrowse} placeholder="Search inventory..." />
          </div>
          <div className="browse-categories">
            <CategoryGrid
              categories={categories}
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
              filterQuery={query}
            />
          </div>
        </div>

        <div className="browse-main">
          {!isBrowsing ? (
            <div className="browse-prompt">
              <p className="browse-prompt-title">The shared tool wall, digitized.</p>
              <p className="browse-prompt-text">
                Pick a category or search to find what&apos;s on the shelf.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="browse-prompt">
              <p className="browse-prompt-title">No items matched.</p>
              <p className="browse-prompt-text">Try a different search or category.</p>
            </div>
          ) : (
            <>
              <div className="browse-results-header">
                <span className="browse-results-title">
                  {activeCategory || "Results"}
                </span>
                <span className="browse-results-count">
                  {results.length}
                </span>
              </div>
              {subcategoryList.length > 1 && (
                <div className="browse-subcategories">
                  <SubcategoryNav
                    subcategories={subcategoryList}
                    activeSubcategory={activeSubcategory}
                    onSubcategoryChange={handleSubcategoryChange}
                    itemCounts={subcategoryCounts}
                  />
                  {activeCategory && (
                    <button
                      className="browse-results-clear"
                      onClick={() => handleCategorySelect(null)}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <div className="browse-list">
                {results.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />

      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
