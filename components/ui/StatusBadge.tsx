import "./StatusBadge.css";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <span className={`status-badge status-badge--${normalized}`}>
      <span className="status-badge-dot" />
      {status}
    </span>
  );
}
