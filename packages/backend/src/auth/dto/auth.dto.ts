import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email пользователя' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'Пароль (мин. 6 символов)', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @ApiProperty({ example: 'Иван Петров', description: 'Имя пользователя' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'Refresh-токен, полученный при логине' })
  @IsString()
  refreshToken!: string;
}
