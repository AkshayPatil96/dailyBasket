import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub: string;
  role: AuthenticatedUser['role'];
  sessionId: string;
}

// Like JwtAuthGuard, but for endpoints guests may also call (e.g. cart) —
// populates request.user when a valid access token is present, and quietly
// leaves it undefined otherwise instead of throwing 401.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) {
      return true;
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      request.user = {
        id: payload.sub,
        role: payload.role,
        sessionId: payload.sessionId,
      };
    } catch {
      // Expired/invalid token — treat as guest rather than blocking the request.
    }
    return true;
  }
}
