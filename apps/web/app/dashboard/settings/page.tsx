"use client";

import { useAuth } from '@/components/auth-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPage() {
  const { user, organization } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and organization</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name</label>
              <Input defaultValue={user?.firstName} className="mt-1" disabled />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name</label>
              <Input defaultValue={user?.lastName} className="mt-1" disabled />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input defaultValue={user?.email} className="mt-1" disabled />
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <Input defaultValue={user?.role} className="mt-1" disabled />
          </div>
        </CardContent>
      </Card>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Organization Name</label>
            <Input defaultValue={organization?.name} className="mt-1" disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
