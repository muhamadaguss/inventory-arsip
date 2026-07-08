import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  @Get('admin-only')
  @Roles('admin')
  adminOnly() {
    return { message: 'You are an authenticated admin.' };
  }
}
