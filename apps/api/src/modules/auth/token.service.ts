import { Injectable } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { Role } from '@grocery-delivery/types';

const expiresIn = (value: string | undefined, fallback: string): JwtSignOptions['expiresIn'] =>
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
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: expiresIn(process.env.JWT_ACCESS_EXPIRES_IN, '15m')
    });
  }

  signRefreshToken(payload: RefreshTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: expiresIn(process.env.JWT_REFRESH_EXPIRES_IN, '30d')
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    return this.jwtService.verify<RefreshTokenPayload>(token, { secret: process.env.JWT_REFRESH_SECRET });
  }
}
