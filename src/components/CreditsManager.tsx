import React, { useState, useEffect } from 'react';
import { Zap, RefreshCw, Share2, Check, CreditCard, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCredits, formatLargeNumber } from '../utils/formatters';

interface CreditPackage {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
  tag: string;
  discount?: {
    percentage: number;
    label: string;
  };
  isPopular?: boolean;
}

interface CreditsManagerProps {
  currentCredits: number;
  userRole?: string;
  onPurchase?: (packageId: string, withAutoRefill: boolean) => Promise<boolean>;
}

const CreditsManager: React.FC<CreditsManagerProps> = ({ 
  currentCredits = 200,
  userRole,
  onPurchase 
}) => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [autoRefill, setAutoRefill] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [freeCreditsInfo, setFreeCreditsInfo] = useState<{
    received: number;
    nextRefillDate: Date;
  }>({
    received: 100,
    nextRefillDate: new Date()
  });

  // Load user's credit history and next refill date
  useEffect(() => {
    // Simplified initialization
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setFreeCreditsInfo({
      received: 100,
      nextRefillDate: nextMonth
    });
  }, []);

  // Credit packages configuration
  const creditPackages: CreditPackage[] = [
    {
      id: 'starter',
      name: 'Starter Pack',
      price: 2.99,
      credits: 250,
      description: 'Great for light users',
      tag: 'Starter'
    },
    {
      id: 'standard',
      name: 'Standard Pack',
      price: 5.99,
      credits: 500,
      description: 'Perfect for regular users',
      tag: 'Standard'
    },
    {
      id: 'best-value',
      name: 'Best Value Pack',
      price: 8.99,
      credits: 1000,
      description: 'Most popular! Extra value',
      tag: 'Best Value',
      discount: {
        percentage: 25,
        label: 'Save 25%'
      },
      isPopular: true
    },
    {
      id: 'power-user',
      name: 'Power User Pack',
      price: 14.99,
      credits: 2000,
      description: 'For power users and businesses',
      tag: 'Power User',
      discount: {
        percentage: 40,
        label: 'Save 40%'
      }
    }
  ];

  // Calculate bonus credits with auto-refill
  const calculateBonusCredits = (baseCredits: number): number => {
    return autoRefill ? Math.round(baseCredits * 0.1) : 0;
  };

  // Get total credits (base + bonus)
  const getTotalCredits = (baseCredits: number): number => {
    return baseCredits + calculateBonusCredits(baseCredits);
  };

  // Handle package selection
  const handleSelectPackage = (packageId: string) => {
    setSelectedPackage(packageId);
    setError(null);
  };

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedPackage) {
      setError('Please select a credit package');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // If onPurchase prop is provided, use it
      if (onPurchase) {
        const success = await onPurchase(selectedPackage, autoRefill);
        if (success) {
          setPurchaseSuccess(true);
          setTimeout(() => setPurchaseSuccess(false), 3000);
        } else {
          throw new Error('Purchase failed');
        }
      } else {
        // Simulate purchase for demo
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPurchaseSuccess(true);
        setTimeout(() => setPurchaseSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during purchase');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate referral link (simplified version)
  const getReferralLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?ref=user123`; // In real app, use actual user ID
  };

  // Copy referral link to clipboard
  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    } catch (error) {
      console.error('Failed to copy referral link:', error);
    }
  };

  // Format date to Month DD, YYYY
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-8">
      {/* Current Credits Status */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-4">
              <Zap className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                Your Credits
              </h3>
              <p className="font-lora text-neutral-600">
                Use credits for AI-powered searches and recommendations
              </p>
            </div>
          </div>
          <div className="bg-primary-50 px-4 py-2 rounded-xl">
            <span className="font-poppins text-2xl font-bold text-primary-700">
              {formatCredits(currentCredits, userRole)}
            </span>
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 mb-4">
        <div className="flex items-start">
          <div className="bg-green-100 rounded-full p-2 mr-3 mt-1">
            <RefreshCw className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="font-poppins font-semibold text-green-800 mb-1">
              Free Monthly Credits
            </p>
            <p className="font-lora text-sm text-green-700">
              You've received {formatLargeNumber(freeCreditsInfo.received)} free credits this month. Come back on {formatDate(freeCreditsInfo.nextRefillDate)} for 50 more!
            </p>
          </div>
        </div>
        </div>

        {/* Credit usage info */}
      </div>

      {/* Ways to Earn Credits */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
          Ways to Earn Credits
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Leave a Review */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-poppins text-lg font-semibold text-green-900">
                  Leave a Review
                </h4>
                <p className="font-poppins text-2xl font-bold text-green-600">
                  +2 Credits
                </p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="font-lora text-sm text-green-800">
                Earn 2 credits for each complete review that includes:
              </p>
              <ul className="font-lora text-sm text-green-700 space-y-1 ml-4">
                <li>• A thumbs up or down rating</li>
                <li>• Written review text</li>
                <li>• At least 3 photos</li>
              </ul>
            </div>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-green-500 text-white font-poppins font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors duration-200 flex items-center justify-center"
            >
              <Zap className="h-4 w-4 mr-2" />
              View My Activity
            </button>
          </div>

          {/* Refer a Friend */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <Share2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-poppins text-lg font-semibold text-purple-900">
                  Refer a Friend
                </h4>
                <p className="font-poppins text-2xl font-bold text-purple-600">
                  +20 Credits
                </p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <p className="font-lora text-sm text-purple-800">
                Earn 20 credits when someone signs up using your referral link.
              </p>
              <p className="font-lora text-xs text-purple-700">
                Your friend also gets 100 signup credits + 20 referral bonus!
              </p>
            </div>
            
            <button
              onClick={copyReferralLink}
              className="w-full bg-purple-500 text-white font-poppins font-semibold py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors duration-200 flex items-center justify-center"
            >
              {copiedReferral ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Copy Referral Link
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Monthly Free Credits Info */}
      </div>
      
      {/* Credit Packages */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
      <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
        Buy More Credits
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {creditPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative border rounded-xl p-5 transition-all duration-200 cursor-pointer ${
              selectedPackage === pkg.id
                ? 'border-primary-500 bg-primary-50 shadow-md'
                : 'border-neutral-200 hover:border-primary-300 hover:shadow-sm'
            } ${pkg.isPopular ? 'ring-2 ring-primary-300' : ''}`}
            onClick={() => handleSelectPackage(pkg.id)}
          >
            {/* Popular badge */}
            {pkg.isPopular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-poppins font-semibold">
                Most Popular
              </div>
            )}

            {/* Discount badge */}
            {pkg.discount && (
              <div className="absolute -top-3 -right-3 bg-yellow-500 text-white w-12 h-12 rounded-full flex items-center justify-center transform rotate-12">
                <div className="text-center">
                  <div className="text-xs font-bold leading-none">SAVE</div>
                  <div className="text-xs font-bold leading-none">{pkg.discount.percentage}%</div>
                </div>
              </div>
            )}

            {/* Package content */}
            <div className={`pt-${pkg.isPopular ? '4' : '0'}`}>
              <div className="font-poppins font-semibold text-neutral-900 mb-1">
                {pkg.name}
              </div>
              <div className="flex items-baseline mb-2">
                <span className="font-poppins text-2xl font-bold text-primary-500">
                  ${pkg.price}
                </span>
              </div>

              <div className="space-y-3 mb-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-lora text-sm text-neutral-600">Credits:</span>
                  <span className="font-poppins font-semibold text-neutral-900">
                    {formatLargeNumber(pkg.credits)}
                  </span>
                </div>

                {autoRefill && (
                  <div className="flex items-baseline justify-between">
                    <span className="font-lora text-sm text-neutral-600">Bonus:</span>
                    <span className="font-poppins font-semibold text-green-600">
                      +{formatLargeNumber(calculateBonusCredits(pkg.credits))}
                    </span>
                  </div>
                )}

                {autoRefill && (
                  <div className="flex items-baseline justify-between">
                    <span className="font-lora text-sm text-neutral-600">Total:</span>
                    <span className="font-poppins font-semibold text-neutral-900">
                      {formatLargeNumber(getTotalCredits(pkg.credits))}
                    </span>
                  </div>
                )}
              </div>

              <div className="font-lora text-xs text-neutral-600 mb-3">
                {pkg.description}
              </div>

              <div className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-full text-xs font-poppins font-semibold inline-block">
                {pkg.tag}
              </div>

              {/* Selection indicator */}
              {selectedPackage === pkg.id && (
                <div className="absolute bottom-3 right-3 bg-primary-500 text-white rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Auto-refill option */}
      <div className="bg-neutral-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <RefreshCw className="h-5 w-5 text-primary-500 mr-3" />
            <div>
              <p className="font-poppins font-semibold text-neutral-900">
                🔁 Enable Monthly Auto-Refill
              </p>
              <p className="font-lora text-sm text-neutral-600">
                Automatically refill your selected package every month and get 10% bonus credits
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoRefill(!autoRefill)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoRefill ? 'bg-primary-500' : 'bg-neutral-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoRefill ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Selected package summary */}
      {selectedPackage && (
        <div className="bg-primary-50 rounded-xl p-4 mb-6">
          <h4 className="font-poppins font-semibold text-primary-900 mb-2">
            Selected Package
          </h4>
          
          {(() => {
            const pkg = creditPackages.find(p => p.id === selectedPackage);
            if (!pkg) return null;
            
            return (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-lora text-primary-700">Package:</span>
                  <span className="font-poppins font-semibold text-primary-900">{pkg.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-lora text-primary-700">Price:</span>
                  <span className="font-poppins font-semibold text-primary-900">${pkg.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-lora text-primary-700">Base Credits:</span>
                  <span className="font-poppins font-semibold text-primary-900">{formatLargeNumber(pkg.credits)}</span>
                </div>
                {autoRefill && (
                  <>
                    <div className="flex justify-between">
                      <span className="font-lora text-primary-700">Bonus Credits (10%):</span>
                      <span className="font-poppins font-semibold text-green-600">+{formatLargeNumber(calculateBonusCredits(pkg.credits))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-lora text-primary-700">Total Credits:</span>
                      <span className="font-poppins font-semibold text-primary-900">{formatLargeNumber(getTotalCredits(pkg.credits))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-lora text-primary-700">Billing:</span>
                      <span className="font-poppins font-semibold text-primary-900">Monthly</span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="font-lora text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Success message */}
      {purchaseSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <p className="font-lora text-green-700">✅ Credits added to your account!</p>
          </div>
        </div>
      )}

      {/* Purchase button */}
      <button
        onClick={handlePurchase}
        disabled={!selectedPackage || isProcessing}
        className={`w-full font-poppins py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
          !selectedPackage || isProcessing
            ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
            : 'bg-primary-500 text-white hover:bg-primary-600'
        }`}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Buy Credits
          </span>
        )}
      </button>
      </div>
    </div>
  );
};

export default CreditsManager;