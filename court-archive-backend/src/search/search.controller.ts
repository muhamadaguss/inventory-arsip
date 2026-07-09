import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';

@Controller('archive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post('search')
  @Roles('admin', 'petugas')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchDto) {
    const keywords = this.searchService.extractKeywords(dto.raw_transcript);
    const matches = await this.searchService.findMatches(keywords);
    const ttsPayload = this.searchService.buildTtsPayload(matches);

    return {
      status: 'success',
      match_count: matches.length,
      tts_payload: ttsPayload,
      data: matches.map((match) => ({
        id: match.id,
        case_number_raw: match.caseNumberRaw,
        case_type: match.caseType,
        year: match.year,
        parties_involved: match.partiesInvolved,
        status: match.status,
        location:
          match.rackName === null || match.rowNumber === null
            ? null
            : {
                rack: match.rackName,
                row: match.rowNumber,
                position: match.filePositionNumber,
              },
        tts_payload: this.searchService.buildTtsPayload([match]),
      })),
    };
  }
}
