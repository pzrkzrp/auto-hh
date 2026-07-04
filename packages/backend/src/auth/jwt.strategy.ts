import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Db, ObjectId } from 'mongodb';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject('DATABASE_CONNECTION') private db: Db) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'access-secret',
    });
  }

  async validate(payload: { sub: string }) {
    const user = await this.db.collection('users').findOne({ _id: new ObjectId(payload.sub) } as any);
    if (!user) return null;
    return {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
    };
  }
}
