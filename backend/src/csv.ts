const escapeCell = (value: unknown) => {
  if (value == null) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
};

export const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const header = columns.join(',');
  const body = rows
    .map((row) => columns.map((column) => escapeCell(row[column])).join(','))
    .join('\n');
  return `${header}\n${body}\n`;
};
