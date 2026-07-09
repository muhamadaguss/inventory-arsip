import { Injectable } from '@nestjs/common';

const CASE_TYPE_LOOKUP: Record<string, string> = {
  'pidana biasa': 'Pid.B',
  pidana: 'Pid.B',
  'perdata gugatan': 'Pdt.G',
  perdata: 'Pdt.G',
};

@Injectable()
export class CaseTypeLookupService {
  resolve(phrase: string): string | null {
    const trimmed = phrase.trim();
    if (!trimmed) {
      return null;
    }
    return CASE_TYPE_LOOKUP[trimmed] ?? null;
  }
}
