import React from 'react';
import { usePlan } from '../contexts/PlanContext';
import { Badge } from './ui';
import { Crown, Star, Sparkles } from 'lucide-react';
import { cn } from '../lib/cn';

export default function PlanBadge({ className }) {
  const { plan, loading } = usePlan();

  if (loading || !plan) return null;

  const getPlanStyles = () => {
    switch (plan.name?.toLowerCase()) {
      case 'pro':
        return {
          variant: 'accent',
          icon: <Crown className="size-3 mr-1" />,
          classes: 'bg-gradient-to-r from-accent to-accent-hover text-accent-contrast border-none shadow-sm'
        };
      case 'basic':
        return {
          variant: 'info',
          icon: <Star className="size-3 mr-1" />,
          classes: ''
        };
      case 'free':
        return {
          variant: 'neutral',
          icon: <Sparkles className="size-3 mr-1" />,
          classes: ''
        };
      default:
        return {
          variant: 'neutral',
          icon: null,
          classes: ''
        };
    }
  };

  const style = getPlanStyles();

  return (
    <Badge 
      variant={style.variant} 
      className={cn('flex items-center text-[0.65rem] uppercase tracking-wider font-bold', style.classes, className)}
    >
      {style.icon}
      {plan.name}
    </Badge>
  );
}
