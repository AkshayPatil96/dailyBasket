import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { Role } from '@grocery-delivery/types';
import { ConfigService } from '@nestjs/config';

const expiresIn = (
  value: string | undefined,
  fallback: string,
): JwtSignOptions['expiresIn'] =>
  (value ?? fallback) as JwtSignOptions['expiresIn'];

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.secret'),
      expiresIn: expiresIn(
        this.configService.get<string>('jwt.accessExpiresIn'),
        '15m',
      ),
    });
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: expiresIn(
        this.configService.get<string>('jwt.refreshExpiresIn'),
        '30d',
      ),
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
    });
  }
}
