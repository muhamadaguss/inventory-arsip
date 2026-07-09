import { CaseTypeLookupService } from './case-type-lookup.service';

describe('CaseTypeLookupService', () => {
  let service: CaseTypeLookupService;

  beforeEach(() => {
    service = new CaseTypeLookupService();
  });

  it('resolves "pidana biasa" to "Pid.B"', () => {
    expect(service.resolve('pidana biasa')).toBe('Pid.B');
  });

  it('resolves "perdata gugatan" to "Pdt.G"', () => {
    expect(service.resolve('perdata gugatan')).toBe('Pdt.G');
  });

  it('returns null for an unrecognized phrase', () => {
    expect(service.resolve('perkara antariksa')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(service.resolve('')).toBeNull();
  });
});
