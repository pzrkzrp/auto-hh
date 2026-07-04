import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto, ChangePasswordDto, UpdateApiKeysDto } from './dto/users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Получить профиль текущего пользователя' })
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Обновить имя' })
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('me/password')
  @ApiOperation({ summary: 'Сменить пароль' })
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }

  @Get('me/api-keys')
  @ApiOperation({ summary: 'Проверить наличие API-ключей (без значений)' })
  getApiKeys(@CurrentUser('id') userId: string) {
    return this.usersService.getApiKeys(userId);
  }

  @Put('me/api-keys')
  @ApiOperation({ summary: 'Обновить API-ключи (шифруются)' })
  updateApiKeys(@CurrentUser('id') userId: string, @Body() dto: UpdateApiKeysDto) {
    return this.usersService.updateApiKeys(userId, dto);
  }
}
