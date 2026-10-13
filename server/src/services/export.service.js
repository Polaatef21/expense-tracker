import ExcelJS from 'exceljs';

const HEADERS = ['Date', 'Type', 'Category', 'Description', 'Amount'];
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Text starting with these characters can be executed as a formula when the
// CSV is opened in Excel/Sheets ("CSV injection"); prefix it with an apostrophe.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value, { isText = true } = {}) {
  let s = value == null ? '' : String(value);
  if (isText && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  const lines = [HEADERS.join(',')];
  for (const t of rows) {
    lines.push(
      [
        csvCell(t.date, { isText: false }),
        csvCell(capitalize(t.type)),
        csvCell(t.category.name),
        csvCell(t.description),
        csvCell(t.amount, { isText: false }),
      ].join(','),
    );
  }
  // The BOM tells Excel the file is UTF-8, so non-English text displays correctly
  return `﻿${lines.join('\r\n')}\r\n`;
}

function describeFilters({ startDate, endDate, type, categoryName }) {
  return [
    ['From', startDate ?? 'Any'],
    ['To', endDate ?? 'Any'],
    ['Type', type ? capitalize(type) : 'All'],
    ['Category', categoryName ?? 'All'],
  ];
}

export async function toXlsxBuffer(rows, { summary, filters, generatedAt = new Date() }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expense Tracker';
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'Date', key: 'date', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Amount', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const t of rows) {
    const [y, m, d] = t.date.split('-').map(Number);
    sheet.addRow({
      date: new Date(Date.UTC(y, m - 1, d)), // real Excel date (sortable/filterable)
      type: capitalize(t.type),
      category: t.category.name,
      description: t.description ?? '',
      amount: Number(t.amount), // numeric cell so Excel can sum it
    });
  }
  if (rows.length > 0) sheet.autoFilter = { from: 'A1', to: `E${rows.length + 1}` };

  const info = workbook.addWorksheet('Summary');
  info.columns = [{ width: 18 }, { width: 24 }];
  info.addRow(['Expense Tracker export']).font = { bold: true, size: 14 };
  info.addRow(['Generated', generatedAt.toISOString().slice(0, 10)]);
  info.addRow([]);
  info.addRow(['Filters']).font = { bold: true };
  describeFilters(filters).forEach((r) => info.addRow(r));
  info.addRow([]);
  info.addRow(['Totals']).font = { bold: true };
  info.addRow(['Transactions', summary.count]);
  for (const [label, value] of [['Income', summary.income], ['Expenses', summary.expense], ['Net', summary.net]]) {
    info.addRow([label, Number(value)]).getCell(2).numFmt = '#,##0.00';
  }

  return workbook.xlsx.writeBuffer();
}

export function exportFileName(format, now = new Date()) {
  return `transactions-${now.toISOString().slice(0, 10)}.${format}`;
}
