import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub: string;
  role: AuthenticatedUser['role'];
  sessionId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token, { secret: process.env.JWT_SECRET });
      request.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
