"use client";

import "./Tag.css";

interface TagProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Tag({ label, active, onClick }: TagProps) {
  return (
    <button
      className={`tag${active ? " tag--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
