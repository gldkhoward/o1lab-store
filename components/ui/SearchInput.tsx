"use client";

import { Search, X } from "lucide-react";
import "./SearchInput.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, onFocus, placeholder = "Search equipment & consumables..." }: SearchInputProps) {
  return (
    <div className="search-input">
      <Search size={18} strokeWidth={1.5} className="search-input-icon" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className="search-input-field"
      />
      {value && (
        <button
          className="search-input-clear"
          onClick={() => onChange("")}
          type="button"
          aria-label="Clear search"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
