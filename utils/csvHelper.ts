
/**
 * Removes UTF-8 BOM if present
 */
const stripBOM = (content: string): string => {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
};

/**
 * Parses a CSV string into a 2D array of strings.
 * Handles quoted fields and newlines within fields (RFC 4180 compliant-ish).
 */
export const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // normalize line endings and strip BOM
  const cleanText = stripBOM(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Handle the last cell/row if file doesn't end in newline
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Generates a CSV string from an array of strings (single column).
 */
export const generateCSV = (header: string, data: string[]): string => {
  const escapeCsvCell = (cell: string) => {
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const rows = data.map(escapeCsvCell);
  return `${header}\n${rows.join('\n')}`;
};

/**
 * Generates a CSV string from a 2D array of strings (multiple columns).
 */
export const generateCSVForRows = (headers: string[], rows: string[][]): string => {
  const escapeCsvCell = (cell: string) => {
    if (cell === undefined || cell === null) return '';
    const val = String(cell);
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerRow = headers.map(escapeCsvCell).join(',');
  const dataRows = rows.map(row => row.map(escapeCsvCell).join(','));
  
  return `${headerRow}\n${dataRows.join('\n')}`;
};
