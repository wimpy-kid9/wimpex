"use client";

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api-client';
import { extractPlanPrice } from '@/lib/plan-pricing';

export interface PaidUpgradeFlowProps {
  productName: string;
  planName: string;
  // eslint-disable-next-line no-unused-vars
  onSuccess?: (subscription: any) => void;
  // eslint-disable-next-line no-unused-vars
  onError?: (error: string) => void;
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export function usePaidUpgradeFlow(props: PaidUpgradeFlowProps) {
  const { productName, planName, onSuccess, onError } = props;
  const [price, setPrice] = useState<number | null>(null);
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [walletShortfall, setWalletShortfall] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fundingInProgress, setFundingInProgress] = useState(false);
  const [notice, setNotice] = useState('');

  const loadPlanPrice = useCallback(async () => {
    try {
      const response = await authedFetch(
        `/api/wimpypay?product_name=${encodeURIComponent(productName)}&plan_name=${encodeURIComponent(planName)}`
      );
      if (!response.ok) return;
      const payload = await response.json();
      const normalized = extractPlanPrice(payload);
      setPrice(normalized.price);
      setBillingInterval(normalized.billing_interval || 'monthly');
    } catch {
      setPrice(null);
    }
  }, [productName, planName]);

  useEffect(() => {
    loadPlanPrice();
  }, [loadPlanPrice]);

  const attemptPurchase = async (): Promise<{ success: boolean; subscription?: any; shortfall?: number }> => {
    setLoading(true);
    setNotice('');
    try {
      const response = await authedFetch('/api/wimpypay', {
        method: 'POST',
        body: JSON.stringify({ product_name: productName, plan_name: planName })
      });
      const payload = await response.json();

      if (!response.ok) {
        const errorCode = typeof payload.error === 'string' ? payload.error.toLowerCase() : '';
        const normalizedError = errorCode.replace(/[_\s]+/g, '-');
        const isInsufficientFunds = normalizedError.includes('insufficient') && normalizedError.includes('fund');

        if (isInsufficientFunds) {
          const rawShortfall = Number(payload.requiredAmount ?? payload.required_amount ?? payload.amount ?? 0);
          const shortfall = rawShortfall > 0 ? rawShortfall : (price ?? 0);
          setWalletShortfall(shortfall);
          setNotice(`You need ${formatNaira(shortfall)} more in your WimpyPay wallet`);
          setLoading(false);
          onError?.(payload.error);
          return { success: false, shortfall };
        }

        const errorMsg = payload.error || 'Unable to complete purchase.';
        setNotice(errorMsg);
        setLoading(false);
        onError?.(errorMsg);
        return { success: false };
      }

      setWalletShortfall(null);
      setNotice(`${productName} upgrade successful!`);
      setLoading(false);
      onSuccess?.(payload.subscription);
      return { success: true, subscription: payload.subscription };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unable to complete purchase.';
      setNotice(errorMsg);
      setLoading(false);
      onError?.(errorMsg);
      return { success: false };
    }
  };

  const fundWallet = async (amount?: number) => {
    const fundingAmount = amount || walletShortfall || price || 0;
    if (!fundingAmount || !window) {
      return;
    }

    const paystackScript = 'https://js.paystack.co/v1/inline.js';
    const script = document.createElement('script');
    script.src = paystackScript;
    script.async = true;

    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load Paystack.'));
      document.body.appendChild(script);
    }).catch((error) => {
      setNotice(error instanceof Error ? error.message : 'Unable to open wallet funding flow.');
      return;
    });

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || !(window as any).PaystackPop) {
      setNotice('Paystack is not configured for wallet funding.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    const email = data?.session?.user?.email || 'user@example.com';

    setFundingInProgress(true);
    const paystack = (window as any).PaystackPop.setup({
      key: paystackKey,
      email,
      amount: Math.max(Math.ceil(fundingAmount), 1) * 100,
      currency: 'NGN',
      ref: `${productName}-wallet-${Date.now()}`,
      onClose: () => {
        setNotice('Wallet funding cancelled.');
        setFundingInProgress(false);
      },
      callback: async (response: any) => {
        if (!response || !response.reference) {
          setNotice('Wallet funding did not complete.');
          setFundingInProgress(false);
          return;
        }

        setNotice('Wallet funded. Completing your upgrade…');
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const result = await attemptPurchase();
        setFundingInProgress(false);

        if (!result.success && result.shortfall) {
          setNotice(`You need ${formatNaira(result.shortfall)} more. Fund again?`);
        }
      }
    });

    paystack.openIframe();
  };

  return {
    price,
    billingInterval,
    walletShortfall,
    loading,
    fundingInProgress,
    notice,
    attemptPurchase,
    fundWallet
  };
}
