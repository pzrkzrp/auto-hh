import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from './user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.userModel.findOne({ email: email.toLowerCase() }).lean().exec();
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const user = {
      email: email.toLowerCase(),
      passwordHash,
      name,
      apiKeys: {},
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.userModel.create(user);
    const userId = created._id.toHexString();

    const tokens = this.generateTokens(userId);
    return {
      user: { id: userId, email: user.email, name: user.name, createdAt: user.createdAt },
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).lean().exec();
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const userId = user._id.toHexString();
    const tokens = this.generateTokens(userId);
    return {
      user: { id: userId, email: user.email, name: user.name, createdAt: user.createdAt, activeResumeId: user.activeResumeId },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh-secret',
      });
      const user = await this.userModel.findById(payload.sub).lean().exec();
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const userId = user._id.toHexString();
      return this.generateTokens(userId);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) return null;
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
    };
  }

  private generateTokens(userId: string) {
    const payload = { sub: userId };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'access-secret',
      expiresIn: '1h',
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh-secret',
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }
}
