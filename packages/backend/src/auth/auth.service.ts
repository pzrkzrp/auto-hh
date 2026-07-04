import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Db, ObjectId } from 'mongodb';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @Inject('DATABASE_CONNECTION') private db: Db,
    private jwtService: JwtService,
  ) {}

  private get usersCol() {
    return this.db.collection('users');
  }

  async register(email: string, password: string, name: string) {
    const existing = await this.usersCol.findOne({ email: email.toLowerCase() });
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

    const result = await this.usersCol.insertOne(user as any);
    const userId = result.insertedId.toHexString();

    const tokens = this.generateTokens(userId);
    return {
      user: { id: userId, email: user.email, name: user.name, createdAt: user.createdAt },
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersCol.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersCol.updateOne(
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
      const user = await this.usersCol.findOne({ _id: new ObjectId(payload.sub) } as any);
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
    const user = await this.usersCol.findOne({ _id: new ObjectId(userId) } as any);
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
