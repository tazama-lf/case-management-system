import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export function exportToCSV(data: any[], headers: string[]): string {
  const escape = (val: any) => {
    if (val === null || typeof val === 'undefined') return '';
    if (typeof val === 'object') val = JSON.stringify(val);
    const str = String(val);
    if (str.includes('"')) {
      // escape double quotes by doubling them
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    if (str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str}"`;
    }
    return str;
  };

  const headerLine = headers.join(',');
  const rows = data.map(row => headers.map(h => escape(row[h])).join(','));
  return [headerLine, ...rows].join('\n');
}

export async function exportToExcel(data: any[], headers: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');
  worksheet.addRow(headers);
  data.forEach(row => worksheet.addRow(headers.map(h => row[h])));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer); // Convert ArrayBuffer to Node.js Buffer
}

export function exportToPDF(data: any[], headers: string[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.fontSize(12).text(headers.join(' | '));
    data.forEach(row => doc.text(headers.map(h => row[h]).join(' | ')));
    doc.end();
  });
}
