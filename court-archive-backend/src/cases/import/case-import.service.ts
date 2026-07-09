import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportResult, RejectedRow } from './dto/import-result.dto';

interface ParsedRow {
  case_number_raw?: string;
  case_type?: string;
  year?: string;
  parties_involved?: string;
  rack_name?: string;
  row_number?: string;
  file_position_number?: string;
}

const EXCEL_COLUMNS = [
  'case_number_raw',
  'case_type',
  'year',
  'parties_involved',
  'rack_name',
  'row_number',
  'file_position_number',
] as const;

@Injectable()
export class CaseImportService {
  constructor(private prisma: PrismaService) {}

  async importFromCsv(buffer: Buffer): Promise<ImportResult> {
    const rows: ParsedRow[] = parse(buffer, { columns: true, skip_empty_lines: true });
    return this.importRows(rows);
  }

  async importFromExcel(buffer: Buffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    // exceljs@4's bundled type defs predate @types/node's generic `Buffer<T>`,
    // so `load` reports a spurious type mismatch even though the runtime buffer is valid.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const worksheet = workbook.worksheets[0];

    const rows: ParsedRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }
      const parsed: ParsedRow = {};
      EXCEL_COLUMNS.forEach((column, index) => {
        const cellValue = row.getCell(index + 1).value;
        parsed[column] =
          typeof cellValue === 'string' || typeof cellValue === 'number' ? String(cellValue) : undefined;
      });
      rows.push(parsed);
    });

    return this.importRows(rows);
  }

  private async importRows(rows: ParsedRow[]): Promise<ImportResult> {
    let importedCount = 0;
    const rejectedRows: RejectedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 1;
      const row = rows[i];

      if (!row.case_number_raw?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_number_raw' });
        continue;
      }
      if (!row.case_type?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing case_type' });
        continue;
      }
      if (!row.year?.trim() || Number.isNaN(Number(row.year))) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing or invalid year' });
        continue;
      }
      if (!row.parties_involved?.trim()) {
        rejectedRows.push({ row: rowNumber, reason: 'Missing parties_involved' });
        continue;
      }

      let shelfId: number | null = null;
      const rackName = row.rack_name?.trim();
      const rowNumberField = row.row_number?.trim();

      if (rackName || rowNumberField) {
        if (!rackName || !rowNumberField || Number.isNaN(Number(rowNumberField))) {
          rejectedRows.push({ row: rowNumber, reason: 'Incomplete shelf reference (need both rack_name and row_number)' });
          continue;
        }
        const shelf = await this.prisma.shelf.findFirst({
          where: { rackName, rowNumber: Number(rowNumberField) },
        });
        if (!shelf) {
          rejectedRows.push({
            row: rowNumber,
            reason: `Unresolvable shelf reference '${rackName}' row ${rowNumberField}`,
          });
          continue;
        }
        shelfId = shelf.id;
      }

      await this.prisma.courtCase.create({
        data: {
          caseNumberRaw: row.case_number_raw.trim(),
          caseType: row.case_type.trim(),
          year: Number(row.year),
          partiesInvolved: row.parties_involved.trim(),
          shelfId,
          filePositionNumber: row.file_position_number?.trim() || null,
        },
      });
      importedCount++;
    }

    return { importedCount, rejectedRows };
  }
}
