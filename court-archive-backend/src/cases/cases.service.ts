import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@Injectable()
export class CasesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCaseDto) {
    return this.prisma.courtCase.create({ data: dto });
  }

  findAll() {
    return this.prisma.courtCase.findMany();
  }

  async findOne(id: number) {
    const courtCase = await this.prisma.courtCase.findUnique({ where: { id } });
    if (!courtCase) {
      throw new NotFoundException(`Case ${id} not found`);
    }
    return courtCase;
  }

  update(id: number, dto: UpdateCaseDto) {
    return this.prisma.courtCase.update({ where: { id }, data: dto });
  }

  updateStatus(id: number, status: 'Available' | 'Borrowed') {
    return this.prisma.courtCase.update({ where: { id }, data: { status } });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.courtCase.delete({ where: { id } });
  }
}
