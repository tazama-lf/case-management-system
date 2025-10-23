import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

(pdfMake as any).vfs = pdfFonts;

export interface ExportData {
  [key: string]: any;
}

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export const exportToExcel = (
  data: ExportData[],
  filename: string,
  sheetName: string = 'Data'
) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    if (data.length > 0) {
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length))
      }));
      worksheet['!cols'] = colWidths;
    }

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}.xlsx`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export to Excel');
  }
};

export const exportToCSV = (
  data: ExportData[],
  filename: string
) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Failed to export to CSV');
  }
};

export const exportToPDF = async (
  data: ExportData[],
  filename: string,
  title: string,
  columns: TableColumn[]
) => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const tableBody = [
      columns.map(col => ({
        text: col.label,
        style: 'tableHeader',
        fillColor: '#3b82f6',
        color: '#ffffff'
      })),
      ...data.map(row =>
        columns.map(col => {
          const value = row[col.key];
          return {
            text: value !== undefined && value !== null ? String(value) : '',
            style: 'tableCell'
          };
        })
      )
    ];

    const docDefinition = {
      content: [
        {
          text: title,
          style: 'header',
          margin: [0, 0, 0, 20]
        },
        {
          text: `Generated on: ${new Date().toLocaleString()}`,
          style: 'subheader',
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: columns.map(() => '*'),
            body: tableBody
          },
          layout: {
            fillColor: function (rowIndex: number) {
              return (rowIndex === 0) ? '#3b82f6' : (rowIndex % 2 === 0) ? '#f9fafb' : null;
            },
            hLineWidth: function () {
              return 0.5;
            },
            vLineWidth: function () {
              return 0.5;
            },
            hLineColor: function () {
              return '#e5e7eb';
            },
            vLineColor: function () {
              return '#e5e7eb';
            }
          }
        }
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 12,
          margin: [0, 10, 0, 5]
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: 'white',
          fillColor: '#3b82f6'
        },
        tableCell: {
          fontSize: 9,
          margin: [0, 5, 0, 5]
        }
      },
      defaultStyle: {
        fontSize: 10
      }
    };

    const pdfDoc = (pdfMake as any).createPdf(docDefinition);
    pdfDoc.download(`${filename}.pdf`);

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export to PDF');
  }
};

export const formatDataForExport = (data: any[], reportType: string): ExportData[] => {
  switch (reportType) {
    case 'CASE_STATUS':
      return data.map(item => ({
        'Status': item.status,
        'Count': item.count,
        'Percentage': item.percentage,
        'Avg Time in Status': item.avgTimeInStatus,
        'Current Trend Period': item.currentTrendPeriod,
      }));

    case 'TASK_COMPLETION':
      return data.map(item => ({
        'Task Type': item.taskType,
        'Total': item.total,
        'Completed': item.completed,
        'Completion Rate': `${item.completionRate}%`,
        'Avg Time (Days)': item.avgTime,
        'Trend': `${item.trend > 0 ? '+' : ''}${item.trend}%`,
      }));

    case 'AUDIT_LOGS':
      return data.map(item => ({
        'Log ID': item.audit_log_id || '',
        'User ID': item.user_id || '',
        'Operation': item.operation || '',
        'Entity Name': item.entity_name || '',
        'Action Performed': item.action_performed || '',
        'Outcome': item.outcome || '',
        'Performed At': item.performed_at || '',
        'Type': item.type || 'Info',
      }));

    case 'CASE_AGEING':
      return data.map(item => ({
        'Case ID': item.caseId,
        'Type': item.type,
        'Status': item.status,
        'Created Date': item.createdDate,
        'Age (Days)': item.ageDays,
        'Priority': item.priority,
        'Investigator': item.investigator,
      }));

    case 'INVESTIGATOR_WORKLOAD':
      return data.map(item => ({
        'Investigator': item.investigator || item.name || 'Unknown',
        'Role': item.role || 'N/A',
        'Active Cases': item.activeCases || 0,
        'Completed Cases': item.completedCases || 0,
        'Avg Resolution Time': item.avgResolutionTime || 0,
        'Case Closure Rate': item.caseClosureRate || 0,
        'Performance Trend': item.performanceTrend || 'N/A',
      }));

    default:
      return data;
  }
};

export const getColumnsForReport = (reportType: string): TableColumn[] => {
  switch (reportType) {
    case 'CASE_STATUS':
      return [
        { key: 'Status', label: 'Status', width: 120 },
        { key: 'Count', label: 'Count', width: 80 },
        { key: 'Percentage', label: 'Percentage', width: 100 },
        { key: 'Avg Time in Status', label: 'Avg Time in Status', width: 140 },
        { key: 'Current Trend Period', label: 'Current Trend Period', width: 150 },
      ];

    case 'TASK_COMPLETION':
      return [
        { key: 'Task Type', label: 'Task Type', width: 120 },
        { key: 'Total', label: 'Total', width: 80 },
        { key: 'Completed', label: 'Completed', width: 100 },
        { key: 'Completion Rate', label: 'Completion Rate', width: 120 },
        { key: 'Avg Time (Days)', label: 'Avg Time (Days)', width: 120 },
        { key: 'Trend', label: 'Trend', width: 80 },
      ];

    case 'AUDIT_LOGS':
      return [
        { key: 'Log ID', label: 'Log ID', width: 150 },
        { key: 'User ID', label: 'User ID', width: 150 },
        { key: 'Operation', label: 'Operation', width: 120 },
        { key: 'Entity Name', label: 'Entity Name', width: 100 },
        { key: 'Action Performed', label: 'Action Performed', width: 200 },
        { key: 'Outcome', label: 'Outcome', width: 150 },
        { key: 'Performed At', label: 'Performed At', width: 150 },
        { key: 'Type', label: 'Type', width: 80 },
      ];

    case 'CASE_AGEING':
      return [
        { key: 'Case ID', label: 'Case ID', width: 100 },
        { key: 'Type', label: 'Type', width: 100 },
        { key: 'Status', label: 'Status', width: 120 },
        { key: 'Created Date', label: 'Created Date', width: 100 },
        { key: 'Age (Days)', label: 'Age (Days)', width: 100 },
        { key: 'Priority', label: 'Priority', width: 80 },
        { key: 'Investigator', label: 'Investigator', width: 120 },
      ];

    case 'INVESTIGATOR_WORKLOAD':
      return [
        { key: 'Investigator', label: 'Investigator', width: 150 },
        { key: 'Role', label: 'Role', width: 100 },
        { key: 'Active Cases', label: 'Active Cases', width: 120 },
        { key: 'Completed Cases', label: 'Completed Cases', width: 120 },
        { key: 'Avg Resolution Time', label: 'Avg Resolution Time', width: 140 },
        { key: 'Case Closure Rate', label: 'Case Closure Rate', width: 140 },
        { key: 'Performance Trend', label: 'Performance Trend', width: 120 },
      ];

    default:
      return [];
  }
};