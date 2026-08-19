function normalizeCell(value) {
  return typeof value === 'string' ? value.replace(/\r/g, '') : '';
}

export function parseCsv(text) {
  if (typeof text !== 'string') {
    throw new Error('CSV text must be a string');
  }

  const rows = [];
  let currentCell = '';
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(normalizeCell(currentCell));
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      currentRow.push(normalizeCell(currentCell));
      currentCell = '';

      if (!(currentRow.length === 1 && currentRow[0] === '')) {
        rows.push(currentRow);
      }

      currentRow = [];

      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new Error('CSV contains an unterminated quoted field');
  }

  currentRow.push(normalizeCell(currentCell));
  if (!(currentRow.length === 1 && currentRow[0] === '')) {
    rows.push(currentRow);
  }

  return rows;
}
