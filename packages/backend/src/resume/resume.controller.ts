import { Controller, Get, Post, Delete, Put, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ResumeService } from './resume.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('resumes')
@ApiBearerAuth()
@Controller('api/resumes')
@UseGuards(JwtAuthGuard)
export class ResumeController {
  constructor(private resumeService: ResumeService) {}

  @Get()
  @ApiOperation({ summary: 'Список резюме пользователя' })
  listResumes(@CurrentUser('id') userId: string) {
    return this.resumeService.listResumes(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Загрузить резюме (.md, .txt, .pdf)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, name: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file'))
  uploadResume(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name?: string,
  ) {
    if (!file) throw new Error('File is required');
    return this.resumeService.uploadResume(userId, file, name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить резюме по ID' })
  getResume(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.resumeService.getResumeById(userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить резюме' })
  deleteResume(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.resumeService.deleteResume(userId, id);
  }

  @Put(':id/activate')
  @ApiOperation({ summary: 'Сделать резюме активным' })
  setActive(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.resumeService.setActive(userId, id);
  }
}
