'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, getApiErrorMessage } from '@/lib/api-client';
import { currentUserQueryKey, useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: 'Customer',
  DELIVERY_PARTNER: 'Delivery partner',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super admin',
};

export default function ProfilePage() {
  const { user } = useCurrentUser();

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Profile</h1>
      <ProfileForm />
      <ChangePasswordForm />
      <DangerZone />
    </div>
  );
}

const RESEND_COOLDOWN_SECONDS = 5 * 60;

function ProfileForm() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  // Local-only, resets on reload — the real gate lives server-side
  // (resendVerification silently no-ops within the cooldown window), this
  // just stops an obvious same-session double-click and shows a countdown.
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown === 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setPhone(user.phone ?? '');
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ firstName, lastName, phone: phone || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(currentUserQueryKey, updated);
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update profile.')),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerification({ email }),
    onSuccess: () => {
      toast.success('Check your inbox for the verification link.', {
        description: 'Link is valid for 24 hours.',
      });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Could not send verification email.')),
  });

  if (!user) {
    return null;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateMutation.mutate();
      }}
      className="flex flex-col gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Account details</h2>
        <span className="rounded-full bg-(--color-muted) px-2.5 py-0.5 text-xs font-medium text-(--color-muted-foreground)">
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label="Email" value={user.email} disabled readOnly />
        </div>
        {!user.emailVerifiedAt ? (
          <Button
            type="button"
            variant="link"
            disabled={resendCooldown > 0}
            loading={resendMutation.isPending}
            onClick={() => resendMutation.mutate(user.email)}
          >
            {resendCooldown > 0
              ? `Resend in ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')}`
              : 'Verify email'}
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <FormField
          label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <FormField
        label="Phone"
        type="tel"
        placeholder="10-digit mobile number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {!user.emailVerifiedAt ? (
        <p className="text-xs text-(--color-destructive)">Email not verified.</p>
      ) : null}

      <Button type="submit" loading={updateMutation.isPending} className="self-start">
        Save changes
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not change password.')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="flex flex-col gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4"
    >
      <h2 className="text-sm font-semibold text-(--color-foreground)">Change password</h2>
      <FormField
        label="Current password"
        type="password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <FormField
        label="New password"
        type="password"
        required
        helperText="At least 8 characters."
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Button type="submit" loading={mutation.isPending} className="self-start">
        Update password
      </Button>
    </form>
  );
}

function DangerZone() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      queryClient.setQueryData(currentUserQueryKey, undefined);
      queryClient.invalidateQueries();
      router.push('/');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not delete account.')),
  });

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-destructive)/30 bg-(--color-card) p-4">
      <h2 className="text-sm font-semibold text-(--color-destructive)">Danger zone</h2>
      <p className="text-sm text-(--color-muted-foreground)">
        Deleting your account is permanent and cannot be undone.
      </p>
      <Button variant="destructive" className="self-start" onClick={() => setShowDialog(true)}>
        Delete account
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account. Past orders are kept for records, but you
              will lose access to them. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep account</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
