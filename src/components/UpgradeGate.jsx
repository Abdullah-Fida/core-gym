import React from 'react';
import { Lock, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { usePlan } from '../contexts/PlanContext';
import { Button } from './ui';

export default function UpgradeGate({ featureKey, children, title, description }) {
  const { canUseFeature, plan, loading } = usePlan();

  if (loading) return null; // Or a skeleton

  // If the plan has the feature, render the content
  if (canUseFeature(featureKey)) {
    return <>{children}</>;
  }

  // Otherwise, show a premium upgrade prompt
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-2 rounded-2xl border border-line">
      <div className="flex items-center justify-center size-20 rounded-full bg-gradient-to-br from-accent/20 to-accent-soft mb-6 shadow-sm border border-accent/10">
        <Lock className="size-10 text-accent" aria-hidden="true" />
      </div>
      
      <h2 className="text-2xl font-bold text-heading mb-3">
        {title || 'Premium Feature'}
      </h2>
      
      <p className="text-body max-w-md mb-8">
        {description || `This feature is not included in your current ${plan?.name || ''} plan. Upgrade to unlock this and many other premium tools to grow your gym.`}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={() => window.open('mailto:support@batgos.com?subject=Upgrade%20Plan', '_blank')}
          size="lg"
          className="bg-gradient-to-r from-accent to-accent-hover hover:opacity-90 transition-opacity"
        >
          <Zap className="size-4" aria-hidden="true" />
          Upgrade to Pro
        </Button>
        <Button variant="secondary" size="lg" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-muted bg-surface-3 py-2 px-4 rounded-full border border-line">
        <ShieldAlert className="size-4 text-warning" />
        <span>You are currently on the <strong className="text-heading">{plan?.name || 'Unknown'}</strong> plan</span>
      </div>
    </div>
  );
}
