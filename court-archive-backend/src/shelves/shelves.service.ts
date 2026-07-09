import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShelfDto } from './dto/create-shelf.dto';
import { UpdateShelfDto } from './dto/update-shelf.dto';

@Injectable()
export class ShelvesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateShelfDto) {
    return this.prisma.shelf.create({ data: dto });
  }

  findAll() {
    return this.prisma.shelf.findMany();
  }

  async findOne(id: number) {
    const shelf = await this.prisma.shelf.findUnique({ where: { id } });
    if (!shelf) {
      throw new NotFoundException(`Shelf ${id} not found`);
    }
    return shelf;
  }

  update(id: number, dto: UpdateShelfDto) {
    return this.prisma.shelf.update({ where: { id }, data: dto });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.shelf.delete({ where: { id } });
  }
}
