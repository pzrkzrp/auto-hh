import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GradeService } from './grade.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('grade')
@ApiBearerAuth()
@Controller('api/grade')
@UseGuards(JwtAuthGuard)
export class GradeController {
  constructor(private gradeService: GradeService) {}

  @Post()
  @ApiOperation({ summary: 'Запустить AI-оценку резюме' })
  createGrade(@CurrentUser('id') userId: string, @Body('resumeId') resumeId: string) {
    return this.gradeService.createGradeJob(userId, resumeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить результат оценки' })
  getGrade(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.gradeService.getGradeJob(userId, id);
  }
}
