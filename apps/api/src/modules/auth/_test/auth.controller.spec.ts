import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import type { CartService } from '../../cart/cart.service';
import { AuthenticatedUser } from '../../../common/types/authenticated-request';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    logoutAll: jest.Mock;
    me: jest.Mock;
    verifyEmail: jest.Mock;
    resendVerification: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    changePassword: jest.Mock;
    deleteAccount: jest.Mock;
  };
  let cartService: { mergeGuestCartIntoUser: jest.Mock };
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    role: 'CUSTOMER',
    sessionId: 'session-1',
  };

  const request = (overrides: Partial<Request> = {}) =>
    ({
      headers: { 'user-agent': 'jest-agent' },
      cookies: {},
      ...overrides,
    }) as unknown as Request;

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
      me: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerification: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      deleteAccount: jest.fn(),
    };
    cartService = { mergeGuestCartIntoUser: jest.fn() };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
    controller = new AuthController(
      authService as unknown as AuthService,
      cartService as unknown as CartService,
    );
  });

  it('register delegates to the service', async () => {
    const dto = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'super-secret',
    };
    authService.register.mockResolvedValue({ id: 'user-1' });

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'user-1' });
  });

  it('login sets both auth cookies and returns the user', async () => {
    authService.login.mockResolvedValue({
      user: { id: 'user-1' },
      tokens: { accessToken: 'access-tok', refreshToken: 'refresh-tok' },
    });

    const result = await controller.login(
      { email: 'ada@example.com', password: 'secret' },
      request(),
      res as unknown as Response,
    );

    expect(authService.login).toHaveBeenCalledWith(
      { email: 'ada@example.com', password: 'secret' },
      'jest-agent',
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'access-tok',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-tok',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
    expect(result).toEqual({ id: 'user-1' });
  });

  describe('refresh', () => {
    it('rejects when there is no refresh cookie', async () => {
      await expect(
        controller.refresh(
          request({ cookies: {} }),
          res as unknown as Response,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('rotates tokens and re-sets cookies when a refresh cookie is present', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(
        request({ cookies: { refresh_token: 'old-refresh' } }),
        res as unknown as Response,
      );

      expect(authService.refresh).toHaveBeenCalledWith(
        'old-refresh',
        'jest-agent',
      );
      expect(res.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });
  });

  it('logout clears cookies and revokes the current session', async () => {
    const result = await controller.logout(
      currentUser,
      res as unknown as Response,
    );

    expect(authService.logout).toHaveBeenCalledWith('session-1', 'user-1');
    expect(res.clearCookie).toHaveBeenCalledWith('access_token');
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', {
      path: '/api/v1/auth',
    });
    expect(result).toEqual({ success: true });
  });

  it('logoutAll clears cookies and revokes every session', async () => {
    const result = await controller.logoutAll(
      currentUser,
      res as unknown as Response,
    );

    expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ success: true });
  });

  it('me returns the service result for the current user', async () => {
    authService.me.mockResolvedValue({ id: 'user-1' });

    const result = await controller.me(currentUser);

    expect(authService.me).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('verifyEmail delegates and reports success', async () => {
    const result = await controller.verifyEmail({ token: 'raw-token' });

    expect(authService.verifyEmail).toHaveBeenCalledWith('raw-token');
    expect(result).toEqual({ success: true });
  });

  it('resendVerification always reports success regardless of match', async () => {
    const result = await controller.resendVerification({
      email: 'ada@example.com',
    });

    expect(authService.resendVerification).toHaveBeenCalledWith(
      'ada@example.com',
    );
    expect(result.success).toBe(true);
  });

  it('forgotPassword always reports success regardless of match', async () => {
    const result = await controller.forgotPassword({
      email: 'ada@example.com',
    });

    expect(authService.forgotPassword).toHaveBeenCalledWith('ada@example.com');
    expect(result.success).toBe(true);
  });

  it('resetPassword delegates with the raw token and new password', async () => {
    const result = await controller.resetPassword({
      token: 'raw-token',
      password: 'new-pass',
    });

    expect(authService.resetPassword).toHaveBeenCalledWith(
      'raw-token',
      'new-pass',
    );
    expect(result).toEqual({ success: true });
  });

  describe('changePassword', () => {
    it('rejects when the new password matches the current one', async () => {
      await expect(
        controller.changePassword(currentUser, {
          currentPassword: 'same',
          newPassword: 'same',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(authService.changePassword).not.toHaveBeenCalled();
    });

    it('delegates when the passwords differ', async () => {
      const result = await controller.changePassword(currentUser, {
        currentPassword: 'old',
        newPassword: 'new',
      });

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'old',
        'new',
      );
      expect(result).toEqual({ success: true });
    });
  });

  it('deleteAccount clears cookies and delegates to the service', async () => {
    const result = await controller.deleteAccount(
      currentUser,
      res as unknown as Response,
    );

    expect(authService.deleteAccount).toHaveBeenCalledWith('user-1');
    expect(res.clearCookie).toHaveBeenCalledWith('access_token');
    expect(result).toEqual({ success: true });
  });
});
