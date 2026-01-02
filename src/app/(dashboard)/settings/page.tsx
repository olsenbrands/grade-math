'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import {
  getSubscriptionWithUsage,
  PLANS,
  formatPrice,
  getDaysRemaining,
  openCustomerPortal,
  createOverageCheckout,
  createAddonCheckout,
  type SubscriptionWithUsage,
} from '@/lib/services/subscriptions';
import type { User } from '@supabase/supabase-js';

import type { TeachingMethodology } from '@/types/database';

interface Profile {
  id: string;
  full_name: string | null;
  school_name: string | null;
  grade_level: string | null;
  teaching_methodology: TeachingMethodology | null;
}

const GRADE_OPTIONS = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1', label: '1st Grade' },
  { value: '2', label: '2nd Grade' },
  { value: '3', label: '3rd Grade' },
  { value: '4', label: '4th Grade' },
  { value: '5', label: '5th Grade' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
  { value: 'college', label: 'College' },
];

const METHODOLOGY_OPTIONS: { value: TeachingMethodology; label: string; description: string }[] = [
  { value: 'standard', label: 'Standard (Balanced)', description: 'Combines conceptual understanding with procedural fluency' },
  { value: 'singapore', label: 'Singapore Math / Bar Model', description: 'Concrete-Pictorial-Abstract progression with visual models' },
  { value: 'traditional', label: 'Traditional / Direct Instruction', description: 'Step-by-step procedures with teacher-guided examples' },
  { value: 'common-core', label: 'Common Core', description: 'Deep conceptual understanding with multiple strategies' },
  { value: 'montessori', label: 'Montessori', description: 'Self-discovery through manipulatives and concrete materials' },
  { value: 'saxon', label: 'Saxon Math', description: 'Incremental learning with constant spiral review' },
  { value: 'classical', label: 'Classical Education', description: 'Logic-based with formal mathematical reasoning' },
  { value: 'waldorf', label: 'Waldorf / Steiner', description: 'Artistic integration with movement and storytelling' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionWithUsage | null>(null);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', schoolName: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [overageLoading, setOverageLoading] = useState(false);
  const [gradeLevelSaving, setGradeLevelSaving] = useState(false);
  const [methodologySaving, setMethodologySaving] = useState(false);
  const [hasSmartExplanations, setHasSmartExplanations] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get user
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/login');
        return;
      }
      setUser(user);

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, school_name, grade_level, teaching_methodology')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        // Parse full_name into first/last
        const nameParts = (profileData.full_name || '').split(' ');
        setProfileForm({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          schoolName: profileData.school_name || '',
        });
      }

      // Get subscription and usage data
      try {
        const subData = await getSubscriptionWithUsage();
        setSubscriptionData(subData);
        // Check if user has Smart Explanations add-on
        setHasSmartExplanations(subData.subscription?.has_smart_explanations === true);
      } catch (e) {
        console.error('Failed to load subscription data:', e);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile() {
    if (!user) return;

    setProfileSaving(true);
    try {
      const supabase = createClient();
      const fullName = `${profileForm.firstName} ${profileForm.lastName}`.trim();

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName || null,
          school_name: profileForm.schoolName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, full_name: fullName, school_name: profileForm.schoolName } : null);
      setEditingProfile(false);
    } catch (err) {
      console.error('Failed to save profile:', err);
      alert('Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleChangePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new
      });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      setPasswordSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setChangingPassword(false);
    } catch (err) {
      setPasswordError('Failed to change password');
    }
  }

  async function handleDeleteAccount() {
    // For now, just sign out - actual deletion requires backend work
    alert('Please contact support to delete your account and all associated data.');
    setShowDeleteConfirm(false);
  }

  async function handleManageBilling() {
    setBillingLoading(true);
    try {
      const portalUrl = await openCustomerPortal();
      if (portalUrl) {
        window.location.href = portalUrl;
      } else {
        alert('Unable to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleAddPapers() {
    setOverageLoading(true);
    try {
      const checkoutUrl = await createOverageCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        alert('Unable to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Overage checkout error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setOverageLoading(false);
    }
  }

  async function handleGradeLevelChange(newGradeLevel: string) {
    if (!user) return;

    setGradeLevelSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          grade_level: newGradeLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, grade_level: newGradeLevel } : null);
    } catch (err) {
      console.error('Failed to save grade level:', err);
      alert('Failed to save grade level');
    } finally {
      setGradeLevelSaving(false);
    }
  }

  async function handleMethodologyChange(newMethodology: TeachingMethodology) {
    if (!user) return;

    setMethodologySaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          teaching_methodology: newMethodology,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => prev ? { ...prev, teaching_methodology: newMethodology } : null);
    } catch (err) {
      console.error('Failed to save teaching methodology:', err);
      alert('Failed to save teaching methodology');
    } finally {
      setMethodologySaving(false);
    }
  }

  async function handleAddSmartExplanations() {
    setAddonLoading(true);
    try {
      const checkoutUrl = await createAddonCheckout('smart_explanations');
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        alert('Unable to start checkout. Please try again.');
      }
    } catch (error) {
      console.error('Add-on checkout error:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setAddonLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Loading your settings...</p>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Account
          </CardTitle>
          <CardDescription>Your profile and authentication settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Info */}
          {editingProfile ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolName">School Name</Label>
                <Input
                  id="schoolName"
                  value={profileForm.schoolName}
                  onChange={(e) => setProfileForm({ ...profileForm, schoolName: e.target.value })}
                  placeholder="Your school"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Contact support to change your email</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button variant="outline" onClick={() => setEditingProfile(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {profile?.full_name || 'No name set'}
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  {profile?.school_name && (
                    <p className="text-sm text-muted-foreground">{profile.school_name}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
                  Edit Profile
                </Button>
              </div>
            </div>
          )}

          {/* Change Password */}
          <div className="border-t pt-4">
            {changingPassword ? (
              <div className="space-y-4">
                <h4 className="font-medium">Change Password</h4>
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleChangePassword}>Save Password</Button>
                  <Button variant="outline" onClick={() => setChangingPassword(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">Change your account password</p>
                </div>
                <Button variant="outline" onClick={() => setChangingPassword(true)}>
                  Change Password
                </Button>
              </div>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 mt-2">Password changed successfully!</p>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                Sign Out
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription & Usage Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            Plan & Usage
          </CardTitle>
          <CardDescription>Manage your subscription and view usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan */}
          {subscriptionData?.plan ? (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="text-2xl font-bold">{subscriptionData.plan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {subscriptionData.subscription?.status === 'trialing' ? 'Free Trial' : 'Monthly'}
                  </p>
                  <p className="text-lg font-medium">
                    {subscriptionData.plan.price_cents === 0
                      ? 'Free'
                      : formatPrice(subscriptionData.plan.price_cents) + '/mo'}
                  </p>
                </div>
              </div>

              {/* Usage Progress */}
              {subscriptionData.usage && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Papers graded this month</span>
                    <span className="font-medium">
                      {subscriptionData.usage.papers_graded} of{' '}
                      {subscriptionData.usage.papers_limit + subscriptionData.usage.overage_papers}
                    </span>
                  </div>
                  <Progress
                    value={
                      (subscriptionData.usage.papers_graded /
                        (subscriptionData.usage.papers_limit + subscriptionData.usage.overage_papers)) *
                      100
                    }
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {subscriptionData.usage.papers_remaining} papers remaining
                    {subscriptionData.usage.period_end && (
                      <> &middot; Resets in {getDaysRemaining(subscriptionData.usage.period_end)} days</>
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-muted-foreground">No active subscription</p>
            </div>
          )}

          {/* Upgrade Plan */}
          {subscriptionData?.subscription?.plan_id !== 'heavy' && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {subscriptionData?.subscription?.plan_id === 'free'
                      ? 'Upgrade to a Paid Plan'
                      : 'Need More Papers?'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscriptionData?.subscription?.plan_id === 'free'
                      ? 'Get more papers and features'
                      : 'Upgrade for more grading capacity'}
                  </p>
                </div>
                <Link href="/pricing">
                  <Button>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                    View Plans
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Add More Papers (Overage) */}
          {subscriptionData?.usage && subscriptionData.usage.papers_remaining < 20 && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Running low on papers?</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Add 100 more papers for $5 — no interruption
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-amber-500 text-amber-700 hover:bg-amber-100"
                  onClick={handleAddPapers}
                  disabled={overageLoading}
                >
                  {overageLoading ? 'Processing...' : 'Add Papers'}
                </Button>
              </div>
            </div>
          )}

          {/* Manage Subscription */}
          {subscriptionData?.subscription?.stripe_subscription_id && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Manage Subscription</p>
                  <p className="text-sm text-muted-foreground">Update payment method, cancel, or change plan</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={billingLoading}
                >
                  {billingLoading ? 'Opening...' : 'Manage Billing'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Smart Explanations Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 2v4" />
              <path d="m6.343 6.343 2.829 2.829" />
              <path d="M2 12h4" />
              <path d="m6.343 17.657 2.829-2.829" />
              <path d="M12 18v4" />
              <path d="m17.657 17.657-2.829-2.829" />
              <path d="M18 12h4" />
              <path d="m17.657 6.343-2.829 2.829" />
            </svg>
            Smart Explanations
          </CardTitle>
          <CardDescription>
            Age-appropriate feedback for your students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grade Level Setting */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium">Default Grade Level</p>
              <p className="text-sm text-muted-foreground">
                Set the grade level for age-appropriate explanations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={profile?.grade_level || '6'}
                onChange={(e) => handleGradeLevelChange(e.target.value)}
                disabled={gradeLevelSaving}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {GRADE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {gradeLevelSaving && (
                <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
            </div>
          </div>

          {/* Teaching Methodology Setting */}
          <div className="border-t pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium">Teaching Methodology</p>
                <p className="text-sm text-muted-foreground">
                  Choose how math concepts are explained to match your teaching style
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={profile?.teaching_methodology || 'standard'}
                  onChange={(e) => handleMethodologyChange(e.target.value as TeachingMethodology)}
                  disabled={methodologySaving}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[200px]"
                >
                  {METHODOLOGY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {methodologySaving && (
                  <svg className="animate-spin h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
              </div>
            </div>
            {/* Methodology description */}
            <p className="text-xs text-muted-foreground mt-2 italic">
              {METHODOLOGY_OPTIONS.find(m => m.value === (profile?.teaching_methodology || 'standard'))?.description}
            </p>
          </div>

          {/* Smart Explanations Status / Upgrade */}
          <div className="border-t pt-4">
            {hasSmartExplanations ? (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-green-600 dark:text-green-400">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Smart Explanations Active</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Generate personalized feedback for your students
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-lg border border-violet-200 dark:border-violet-900">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-violet-800 dark:text-violet-200">Upgrade to Smart Explanations</p>
                    <span className="text-xs bg-violet-200 dark:bg-violet-900 text-violet-800 dark:text-violet-200 px-2 py-0.5 rounded-full">
                      $5/mo
                    </span>
                  </div>
                  <p className="text-sm text-violet-700 dark:text-violet-300 mb-2">
                    Get AI-powered, grade-appropriate explanations for every question
                  </p>
                  <ul className="text-sm text-violet-600 dark:text-violet-400 space-y-1">
                    <li className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Step-by-step solutions in student-friendly language
                    </li>
                    <li className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Personalized feedback: what they did right & how to improve
                    </li>
                    <li className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Research-backed, growth mindset encouragement
                    </li>
                  </ul>
                </div>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  onClick={handleAddSmartExplanations}
                  disabled={addonLoading}
                >
                  {addonLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    'Add to Plan'
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive email when grading is complete
              </p>
            </div>
            <Button
              variant={emailNotifications ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEmailNotifications(!emailNotifications)}
            >
              {emailNotifications ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Data & Privacy
          </CardTitle>
          <CardDescription>Export your data or delete your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Grades */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export All Grades</p>
              <p className="text-sm text-muted-foreground">
                Download all your grading data as a CSV file
              </p>
            </div>
            <Button variant="outline">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Export CSV
            </Button>
          </div>

          {/* Delete Account */}
          <div className="border-t pt-4">
            {showDeleteConfirm ? (
              <div className="space-y-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <p className="font-medium text-destructive">Are you sure?</p>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete your account and all associated data including assignments,
                  student work, and grades. This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleDeleteAccount}>
                    Yes, Delete My Account
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Account
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
