import { Injectable, Inject } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {}

  private get usersCol() {
    return this.db.collection('users');
  }

  private encryptKey(plaintext: string): string | null {
    if (!plaintext) return null;
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef').slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
      tag: tag.toString('hex'),
    });
  }

  private decryptKey(encoded: string | null): string | null {
    if (!encoded) return null;
    try {
      const { iv, data, tag } = JSON.parse(encoded);
      const key = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef').slice(0, 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersCol.findOne({ _id: new ObjectId(userId) } as any);
    if (!user) return null;
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
      hasApiKeys: !!(user.apiKeys?.openai || user.apiKeys?.anthropic),
      activeResumeId: user.activeResumeId || null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const set: any = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    await this.usersCol.updateOne({ _id: new ObjectId(userId) } as any, { $set: set });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersCol.findOne({ _id: new ObjectId(userId) } as any);
    if (!user) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersCol.updateOne(
      { _id: new ObjectId(userId) } as any,
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    return { ok: true };
  }

  async updateApiKeys(userId: string, keys: { openai?: string; anthropic?: string }) {
    const apiKeys: any = {};
    if (keys.openai !== undefined) apiKeys.openai = this.encryptKey(keys.openai);
    if (keys.anthropic !== undefined) apiKeys.anthropic = this.encryptKey(keys.anthropic);
    await this.usersCol.updateOne(
      { _id: new ObjectId(userId) } as any,
      { $set: { apiKeys, updatedAt: new Date() } },
    );
    return { hasApiKeys: !!(apiKeys.openai || apiKeys.anthropic) };
  }

  async getApiKeys(userId: string): Promise<{ openai?: string; anthropic?: string }> {
    const user = await this.usersCol.findOne({ _id: new ObjectId(userId) } as any);
    if (!user?.apiKeys) return {};
    return {
      openai: this.decryptKey(user.apiKeys.openai) || undefined,
      anthropic: this.decryptKey(user.apiKeys.anthropic) || undefined,
    };
  }
}
