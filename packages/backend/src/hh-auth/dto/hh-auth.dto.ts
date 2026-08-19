import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HhSmsCodeDto {
  @ApiProperty({ example: 'name@example.com', description: 'Аккаунт, на который запрошен код (email или телефон входа)' })
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty({ example: '123456', description: 'Код из смс/письма' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,8}$/, { message: 'Код должен содержать от 4 до 8 цифр' })
  code!: string;
}

export class HhSessionIdDto {
  @ApiProperty({ example: '665e...', description: 'ID сохранённой hh-сессии' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}

export class HhLoginDto {
  @ApiPropertyOptional({ example: '9000000000', description: 'Телефон (указывается вместо email)' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10,15}$/, { message: 'Телефон должен содержать от 10 до 15 цифр' })
  phone?: string;

  @ApiPropertyOptional({ example: 'name@example.com', description: 'Почта (указывается вместо телефона)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Пароль от hh.ru (обязателен, если wait_code = false)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: true, description: 'Вход по коду из смс — пароль не нужен' })
  @IsOptional()
  @IsBoolean()
  wait_code?: boolean;
}
