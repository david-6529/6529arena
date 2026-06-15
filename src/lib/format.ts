export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatUsd(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
}

export function formatLatency(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
