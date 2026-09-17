import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

const PlanContext = createContext(null);

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user || user.role !== 'gym_owner') {
      setPlanData(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/gym/plan');
      setPlanData(res.data.data);
    } catch (error) {
      console.error('Failed to fetch plan:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Expose a method to manually refresh the plan (e.g. after adding a member)
  const refreshPlan = fetchPlan;

  const value = {
    plan: planData?.plan || null,
    memberCount: planData?.memberCount || 0,
    staffCount: planData?.staffCount || 0,
    loading,
    refreshPlan,
    
    // Helpers
    canUseFeature: (featureKey) => {
      if (!planData?.plan?.features) return true; // Default allow if unknown
      return planData.plan.features[featureKey] !== false;
    },
    
    isAtMemberLimit: () => {
      if (!planData?.plan) return false;
      if (planData.plan.member_limit === null) return false; // Unlimited
      return planData.memberCount >= planData.plan.member_limit;
    },
    
    memberLimit: planData?.plan?.member_limit || null,
  };

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  return useContext(PlanContext);
}
