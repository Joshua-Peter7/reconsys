const { Readable } = require('stream');
const { parse } = require('csv-parse');
const ExcelJS = require('exceljs');

function isCsvFile(fileName, mimeType) {
  const normalizedName = String(fileName || '').toLowerCase();
  const normalizedType = String(mimeType || '').toLowerCase();

  return normalizedName.endsWith('.csv') || normalizedType.includes('csv');
}

function isExcelFile(fileName, mimeType) {
  const normalizedName = String(fileName || '').toLowerCase();
  const normalizedType = String(mimeType || '').toLowerCase();

  return (
    normalizedName.endsWith('.xlsx') ||
    normalizedName.endsWith('.xls') ||
    normalizedType.includes('spreadsheet') ||
    normalizedType.includes('excel')
  );
}

async function parseCsvBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const records = [];

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

    parser.on('error', reject);
    parser.on('end', () => resolve(records));

    Readable.from([buffer]).pipe(parser);
  });
}

async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((header) => String(header || '').trim())
    .filter(Boolean);

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row.getCell(index + 1).value;
    });

    rows.push(rowObject);
  });

  return rows;
}

async function parseFileBuffer(file) {
  if (!file || !file.buffer) {
    throw new Error('No file payload found.');
  }

  if (isCsvFile(file.originalname, file.mimetype)) {
    return parseCsvBuffer(file.buffer);
  }

  if (isExcelFile(file.originalname, file.mimetype)) {
    return parseExcelBuffer(file.buffer);
  }

  throw new Error('Unsupported file format. Please upload CSV or Excel.');
}

async function getPreview(file, limit = 20) {
  const rows = await parseFileBuffer(file);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  return {
    headers,
    preview: rows.slice(0, limit),
    totalRows: rows.length,
  };
}

module.exports = {
  parseFileBuffer,
  getPreview,
};
