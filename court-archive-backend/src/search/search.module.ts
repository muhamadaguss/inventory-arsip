import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { NumberWordsService } from './number-words.service';
import { CaseTypeLookupService } from './case-type-lookup.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SearchController],
  providers: [SearchService, NumberWordsService, CaseTypeLookupService],
})
export class SearchModule {}
