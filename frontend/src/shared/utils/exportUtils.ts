import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type {
  FindingDetail,
} from '@/features/reports/types/reports.types';

(pdfMake as any).vfs = (pdfFonts as any).vfs;

export type ExportData = Record<string, any>;

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
}

export const exportToExcel = (
  data: ExportData[],
  filename: string,
  sheetName = 'Data',
): void => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    if (data.length > 0) {
      const colWidths = Object.keys(data[0] ?? {}).map((key) => ({
        wch: Math.max(
          key.length,
          ...data.map((row) => String(row[key] ?? '').length),
        ),
      }));
      worksheet['!cols'] = colWidths;
    }

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `${filename}.xlsx`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export to Excel', { cause: error });
  }
};

export const exportToCSV = (data: ExportData[], filename: string): void => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (
              typeof value === 'string' &&
              (value.includes(',') ||
                value.includes('"') ||
                value.includes('\n'))
            ) {
              return `"${value.replace(/"/gu, '""')}"`;
            }
            return value ?? '';
          })
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    throw new Error('Failed to export to CSV', { cause: error });
  }
};

export const exportToPDF = (
  data: ExportData[],
  filename: string,
  title: string,
  columns: TableColumn[],
): void => {
  try {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // A4 dimensions in points: 841.89 x 595.28 (landscape)
    // With margins [40, 60, 100, 60], available width = 841.89 - 140 = 701.89
    const availableWidth = 550;
    const totalRequestedWidth = columns.reduce(
      (sum, col) => sum + (col.width ?? 100),
      0,
    );
    const widthScale = availableWidth / totalRequestedWidth;

    const tableBody = [
      columns.map((col) => ({
        text: col.label,
        style: 'tableHeader',
        fillColor: '#3b82f6',
        color: '#ffffff',
        alignment: 'center',
      })),
      ...data.map((row) =>
        columns.map((col) => {
          const value = row[col.key];
          let displayValue = '';

          if (value !== undefined && value !== null) {
            displayValue = String(value);
          }

          return {
            text: displayValue,
            style: 'tableCell',
            fontSize: col.key.toLowerCase().includes('id') ? 7 : 9,
          };
        }),
      ),
    ];

    const columnWidths = columns.map((col) => {
      const requestedWidth = col.width ?? 100;
      const scaledWidth = Math.floor(requestedWidth * widthScale);

      if (col.key.toLowerCase().includes('id')) {
        return Math.max(scaledWidth, 70);
      }

      return Math.max(scaledWidth, 50);
    });

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape' as const,
      pageMargins: [40, 60, 100, 60] as [number, number, number, number],
      content: [
        {
          text: title,
          style: 'header',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          text: `Generated on: ${new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          style: 'subheader',
          margin: [0, 0, 0, 20] as [number, number, number, number],
        },
        {
          table: {
            headerRows: 1,
            widths: columnWidths,
            body: tableBody,
            dontBreakRows: false,
            keepWithHeaderRows: 1,
          },
          layout: {
            fillColor: function (rowIndex: number) {
              return rowIndex === 0
                ? '#3b82f6'
                : rowIndex % 2 === 0
                  ? '#f3f4f6'
                  : '#ffffff';
            },
            hLineWidth: function (i: number, node: any) {
              return i === 0 || i === 1 || i === node.table.body.length
                ? 1
                : 0.5;
            },
            vLineWidth: function (i: number, node: any) {
              return i === 0 || i === node.table.widths.length ? 1 : 0.5;
            },
            hLineColor: function (i: number, node: any) {
              return i === 0 || i === 1 || i === node.table.body.length
                ? '#1f2937'
                : '#d1d5db';
            },
            vLineColor: function () {
              return '#d1d5db';
            },
            paddingLeft: function () {
              return 6;
            },
            paddingRight: function () {
              return 6;
            },
            paddingTop: function () {
              return 6;
            },
            paddingBottom: function () {
              return 6;
            },
          },
        },
        {
          text: `Total Records: ${data.length}`,
          style: 'footer',
          margin: [0, 20, 0, 0] as [number, number, number, number],
        },
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          alignment: 'center' as const,
          color: '#1f2937',
        },
        subheader: {
          fontSize: 11,
          alignment: 'center' as const,
          color: '#6b7280',
          italics: true,
        },
        tableHeader: {
          bold: true,
          fontSize: 10,
          color: '#ffffff',
          fillColor: '#3b82f6',
          alignment: 'center' as const,
        },
        tableCell: {
          fontSize: 9,
          alignment: 'left' as const,
          color: '#1f2937',
        },
        footer: {
          fontSize: 10,
          alignment: 'right' as const,
          color: '#6b7280',
          bold: true,
        },
      },
      defaultStyle: {
        fontSize: 9,
      },
    };

    const pdfDoc = (pdfMake as any).createPdf(docDefinition);
    pdfDoc.download(`${filename}.pdf`);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export to PDF', { cause: error });
  }
};

export const formatDataForExport = (
  data: any[],
  reportType: string,
): ExportData[] => {
  switch (reportType) {
    case 'CASE_STATUS':
      return data.map((item) => ({
        Status: item.status ?? '',
        Count: item.count ?? 0,
        Percentage: item.percentage ?? '0%',
        'Avg Time in Status': item.avgTimeInStatus ?? '0 days',
        'Current Trend Period': item.currentTrendPeriod ?? 'No trend',
      }));

    case 'TASK_COMPLETION':
      return data.map((item) => ({
        'Task Type': item.taskType ?? '',
        Total: item.total ?? 0,
        Completed: item.completed ?? 0,
        'Completion Rate': `${item.completionRate ?? 0}%`,
        'Avg Time (Days)': item.avgTime ?? 0,
        Trend: `${item.trend > 0 ? '+' : ''}${item.trend ?? 0}%`,
      }));

    case 'AUDIT_LOGS':
      return data.map((item) => ({
        'Log ID': String(item.audit_log_id ?? item.logId ?? item.id ?? ''),
        'User ID': String(item.user_id ?? item.userId ?? item.user ?? ''),
        Operation: item.operation ?? '',
        'Entity Name': item.entity_name ?? item.entityName ?? '',
        'Action Performed':
          item.action_performed ?? item.actionPerformed ?? item.action ?? '',
        Outcome: item.outcome ?? '',
        'Performed At':
          item.performed_at ?? item.performedAt ?? item.timestamp ?? '',
        Type: item.type ?? 'Info',
      }));

    case 'CASE_AGEING':
      return data.map((item) => ({
        'Case ID': String(item.caseId ?? item.case_id ?? item.id ?? ''),
        Type: item.type ?? item.caseType ?? '',
        Status: item.status ?? '',
        'Created Date':
          item.createdDate ?? item.created_date ?? item.createdAt ?? '',
        'Age (Days)': item.ageDays ?? item.age_days ?? item.age ?? 0,
        Priority: item.priority ?? 'Normal',
        'User ID': String(
          item.userId ??
            item.user_id ??
            item.assigneeId ??
            item.assignee_id ??
            '',
        ),
        Investigator:
          item.investigator ??
          item.assignee ??
          item.assigned_to ??
          'Unassigned',
      }));

    case 'INVESTIGATOR_WORKLOAD':
      return data.map((item) => ({
        'Investigator ID': String(
          item.investigatorId ??
            item.investigator_id ??
            item.userId ??
            item.user_id ??
            '',
        ),
        Investigator:
          item.investigator ?? item.name ?? item.fullName ?? 'Unknown',
        Role: item.role ?? 'Investigator',
        'Active Cases': item.activeCases ?? item.active_cases ?? 0,
        'Completed Cases': item.completedCases ?? item.completed_cases ?? 0,
        'Avg Resolution Time (Days)':
          item.avgResolutionTime ?? item.avg_resolution_time ?? 0,
        'Case Closure Rate (%)':
          item.caseClosureRate ?? item.case_closure_rate ?? 0,
        'Performance Trend':
          item.performanceTrend ?? item.performance_trend ?? 'Stable',
      }));

    case 'EVIDENCE_FINDINGS':
      return (data as FindingDetail[]).reduce<Array<Record<string, string>>>(
        (rows, caseItem) => {
          for (const task of caseItem.tasks) {
            for (const ev of task.supportingEvidence) {
              rows.push({
                'Case ID': String(caseItem.caseId),
                'Task ID': String(task.taskId ?? ''),
                Finding: caseItem.finding ?? '',
                Conclusion: caseItem.conclusion ?? '',
                'Supporting Evidence': ev.fileName ?? '',
                Comments: [
                  ev.id,
                  ev.evidenceType,
                  ev.uploadedByName,
                  ev.description,
                ]
                  .filter(Boolean)
                  .join(' | '),
                'Date Identified': caseItem.dateIdentified ?? '',
              });
            }
          }
          return rows;
        },
        [],
      );

    default:
      return data.map((item) => {
        const formatted: ExportData = {};
        Object.keys(item).forEach((key) => {
          const value = item[key];

          if (
            key.toLowerCase().includes('id') ||
            key.toLowerCase().includes('case')
          ) {
            formatted[key] = String(value ?? '');
          } else {
            formatted[key] = value;
          }
        });
        return formatted;
      });
  }
};

export const getColumnsForReport = (reportType: string): TableColumn[] => {
  switch (reportType) {
    case 'CASE_STATUS':
      return [
        { key: 'Status', label: 'Status', width: 100 },
        { key: 'Count', label: 'Count', width: 60 },
        { key: 'Percentage', label: 'Percentage', width: 80 },
        { key: 'Avg Time in Status', label: 'Avg Time in Status', width: 120 },
        {
          key: 'Current Trend Period',
          label: 'Current Trend Period',
          width: 140,
        },
      ];

    case 'TASK_COMPLETION':
      return [
        { key: 'Task Type', label: 'Task Type', width: 120 },
        { key: 'Total', label: 'Total', width: 60 },
        { key: 'Completed', label: 'Completed', width: 80 },
        { key: 'Completion Rate', label: 'Completion Rate', width: 100 },
        { key: 'Avg Time (Days)', label: 'Avg Time (Days)', width: 100 },
        { key: 'Trend', label: 'Trend', width: 60 },
      ];

    case 'AUDIT_LOGS':
      return [
        { key: 'Log ID', label: 'Log ID', width: 120 },
        { key: 'User ID', label: 'User ID', width: 120 },
        { key: 'Operation', label: 'Operation', width: 100 },
        { key: 'Entity Name', label: 'Entity Name', width: 90 },
        { key: 'Action Performed', label: 'Action Performed', width: 140 },
        { key: 'Outcome', label: 'Outcome', width: 80 },
        { key: 'Performed At', label: 'Performed At', width: 120 },
        { key: 'Type', label: 'Type', width: 60 },
      ];

    case 'CASE_AGEING':
      return [
        { key: 'Case ID', label: 'Case ID', width: 120 },
        { key: 'Type', label: 'Type', width: 90 },
        { key: 'Status', label: 'Status', width: 80 },
        { key: 'Created Date', label: 'Created Date', width: 100 },
        { key: 'Age (Days)', label: 'Age (Days)', width: 80 },
        { key: 'Priority', label: 'Priority', width: 70 },
        { key: 'User ID', label: 'User ID', width: 120 },
        { key: 'Investigator', label: 'Investigator', width: 100 },
      ];

    case 'INVESTIGATOR_WORKLOAD':
      return [
        { key: 'Investigator ID', label: 'Investigator ID', width: 120 },
        { key: 'Investigator', label: 'Investigator', width: 120 },
        { key: 'Role', label: 'Role', width: 80 },
        { key: 'Active Cases', label: 'Active Cases', width: 90 },
        { key: 'Completed Cases', label: 'Completed Cases', width: 100 },
        {
          key: 'Avg Resolution Time (Days)',
          label: 'Avg Resolution Time (Days)',
          width: 130,
        },
        {
          key: 'Case Closure Rate (%)',
          label: 'Case Closure Rate (%)',
          width: 120,
        },
        { key: 'Performance Trend', label: 'Performance Trend', width: 110 },
      ];

    case 'EVIDENCE_FINDINGS':
      return [
        { key: 'Case ID', label: 'Case ID', width: 20 },
        { key: 'Task ID', label: 'Task ID', width: 20 },
        { key: 'Finding', label: 'Finding', width: 80 },
        { key: 'Conclusion', label: 'Conclusion', width: 80 },
        {
          key: 'Supporting Evidence',
          label: 'Supporting Evidence',
          width: 150,
        },
        { key: 'Comments', label: 'Comments', width: 120 },
        { key: 'Date Identified', label: 'Date Identified', width: 100 },
      ];

    default:
      return [];
  }
};
