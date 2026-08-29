import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '@grocery-delivery/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-request';

// Reads request.user, which only JwtAuthGuard populates. Not registered
// globally — a global guard always runs before a route's local @UseGuards(),
// so it would check the role before authentication ever ran. Always pair as
// @UseGuards(JwtAuthGuard, RolesGuard) on the route (that order — guards in
// one @UseGuards() call run left to right).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();

    // SUPER_ADMIN can reach any @Roles()-gated route — it's a strict superset
    // of every other role, not a role callers list explicitly on each route.
    if (request.user?.role === 'SUPER_ADMIN') {
      return true;
    }
    if (!requiredRoles.includes(request.user?.role)) {
      throw new ForbiddenException('Insufficient role for this resource');
    }
    return true;
  }
}
