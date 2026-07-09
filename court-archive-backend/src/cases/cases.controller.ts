import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@Controller('archive/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateCaseDto) {
    return this.casesService.create(dto);
  }

  @Get()
  @Roles('admin', 'petugas')
  findAll() {
    return this.casesService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'petugas')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin', 'petugas')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseStatusDto) {
    return this.casesService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.casesService.remove(id);
  }
}
