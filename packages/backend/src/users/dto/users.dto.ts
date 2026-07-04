import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Иван Петров', description: 'Новое имя', required: false })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Текущий пароль' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'Новый пароль (мин. 6 символов)', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}

export class UpdateApiKeysDto {
  @ApiProperty({ description: 'OpenAI API-ключ', required: false })
  @IsString()
  @IsOptional()
  openai?: string;

  @ApiProperty({ description: 'Anthropic API-ключ', required: false })
  @IsString()
  @IsOptional()
  anthropic?: string;
}
