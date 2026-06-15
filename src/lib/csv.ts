export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

function stringifyCsvValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function escapeCsvValue(value: unknown) {
  const text = stringifyCsvValue(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  return [
    columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(column.value(row))).join(",")),
  ].join("\n");
}
