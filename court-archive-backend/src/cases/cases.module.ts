import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';
import { CaseImportService } from './import/case-import.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CasesController],
  providers: [CasesService, CaseImportService],
  exports: [CasesService],
})
export class CasesModule {}
