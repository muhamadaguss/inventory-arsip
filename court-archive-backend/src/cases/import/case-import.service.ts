import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
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

@Injectable()
export class CaseImportService {
  constructor(private prisma: PrismaService) {}

  async importFromCsv(buffer: Buffer): Promise<ImportResult> {
    const rows: ParsedRow[] = parse(buffer, { columns: true, skip_empty_lines: true });
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
