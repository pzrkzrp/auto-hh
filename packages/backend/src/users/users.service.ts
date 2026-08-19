import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from '../auth/user.schema';
import { encryptSecret, decryptSecret } from '../common/crypto.util';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) return null;
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
      hasApiKeys: !!(user.apiKeys?.openai || user.apiKeys?.anthropic),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const set: any = { updatedAt: new Date() };
    if (data.name !== undefined) set.name = data.name;
    await this.userModel.updateOne({ _id: userId }, { $set: set });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new Error('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    return { ok: true };
  }

  async updateApiKeys(userId: string, keys: { openai?: string; anthropic?: string }) {
    const apiKeys: any = {};
    if (keys.openai !== undefined) apiKeys.openai = encryptSecret(keys.openai);
    if (keys.anthropic !== undefined) apiKeys.anthropic = encryptSecret(keys.anthropic);
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { apiKeys, updatedAt: new Date() } },
    );
    return { hasApiKeys: !!(apiKeys.openai || apiKeys.anthropic) };
  }

  async getApiKeys(userId: string): Promise<{ openai?: string; anthropic?: string }> {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user?.apiKeys) return {};
    return {
      openai: decryptSecret(user.apiKeys.openai) || undefined,
      anthropic: decryptSecret(user.apiKeys.anthropic) || undefined,
    };
  }
}
