import type { LucideIcon } from "lucide-react";
import {
  Cable,
  Battery,
  CircuitBoard,
  Lightbulb,
  ToggleLeft,
  Zap,
  Disc,
  Cpu,
  Monitor,
  Volume2,
  Plug,
  Cog,
  Microchip,
  Radar,
  Keyboard,
  Gauge,
  Box,
  Wrench,
  Printer,
  Shield,
  Pipette,
  Ruler,
  Bolt,
  TestTube,
  Lamp,
  Archive,
  Grid3X3,
  Radio,
} from "lucide-react";

/* ── Types ── */

export interface RawInventoryItem {
  id: string;
  category: string;
  subcategory: string;
  name: string;
  description: string;
  partNumber: string | null;
  quantity: number;
  unit: string;
  status: string;
  source: string;
  notes: string | null;
  tags: string[];
  relatedCategories: string[];
}

export interface InventoryMeta {
  title: string;
  description: string;
  lastUpdated: string;
  totalItems: number;
}

export interface InventoryData {
  meta: InventoryMeta;
  items: RawInventoryItem[];
}

/* ── Category icon mapping ── */

const categoryIcons: Record<string, LucideIcon> = {
  Connectors: Cable,
  "Battery Holders": Battery,
  Resistors: CircuitBoard,
  LEDs: Lightbulb,
  Switches: ToggleLeft,
  Diodes: Zap,
  Capacitors: Disc,
  Transistors: Cpu,
  Displays: Monitor,
  Audio: Volume2,
  Power: Plug,
  Motors: Cog,
  Microcontrollers: Microchip,
  Sensors: Radar,
  Input: Keyboard,
  "Test & Measurement": Gauge,
  "ICs & Modules": Box,
  Prototyping: Grid3X3,
  Wiring: Cable,
  Tools: Wrench,
  Equipment: Wrench,
  Filament: Printer,
  Safety: Shield,
  Supplies: Pipette,
  Consumables: Pipette,
  Mechanical: Ruler,
  Hardware: Bolt,
  Electronics: CircuitBoard,
  Cabling: TestTube,
  Electrical: Lamp,
  "Tools/Storage": Archive,
};

export function getIconForCategory(category: string): LucideIcon {
  return categoryIcons[category] || Radio;
}

/* ── Search & filter helpers ── */

export function searchInventory(
  items: RawInventoryItem[],
  query: string,
  filters?: {
    category?: string;
    subcategory?: string;
  }
): RawInventoryItem[] {
  const q = query.toLowerCase().trim();

  return items.filter((item) => {
    if (filters?.category && item.category !== filters.category) return false;
    if (filters?.subcategory && item.subcategory !== filters.subcategory) return false;

    if (!q) return true;

    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.subcategory.toLowerCase().includes(q) ||
      (item.partNumber && item.partNumber.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function getCategories(items: RawInventoryItem[]): string[] {
  const cats = new Map<string, number>();
  items.forEach((item) => {
    cats.set(item.category, (cats.get(item.category) || 0) + 1);
  });
  // Sort by item count descending
  return [...cats.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export function getSubcategories(items: RawInventoryItem[], category?: string): string[] {
  const filtered = category ? items.filter((i) => i.category === category) : items;
  const subs = new Map<string, number>();
  filtered.forEach((item) => {
    subs.set(item.subcategory, (subs.get(item.subcategory) || 0) + 1);
  });
  return [...subs.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sub]) => sub);
}
