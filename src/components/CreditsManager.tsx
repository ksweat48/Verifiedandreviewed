import React, { useState, useEffect } from 'react';
import { Zap, RefreshCw, TrendingUp, Users, Edit, Share2, Check, Calendar, CreditCard, Star, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CreditUsageInfo from './CreditUsageInfo';
import { formatCredits, formatLargeNumber } from '../utils/formatters';
import { StripeService } from '../services/stripeService';
import { STRIPE_PRODUCTS, type StripeProduct } from '../stripe-config';

interface CreditsManagerProps {
  currentCredits: number;
  userRole?: string;
}

const CreditsManager: React.FC<CreditsManagerProps> = ({ 
  currentCredits = 200,
  userRole
}) => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [freeCreditsInfo, setFreeCreditsInfo] = useState<{
    received: number;
    nextRefillDate: Date;
  }>({
    received: 100,
    nextRefillDate: new Date()
  });

  // Load user's credit history and next refill date
  useEffect(() => {
    loadStripeData();
    // Simplified initialization
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setFreeCreditsInfo({
      received: 100,
      nextRefillDate: nextMonth
    });
  }, []);

  const loadStripeData = async () => {
    setLoadingSubscription(true);
    try {
      const [subscriptionData, ordersData] = await Promise.all([
        StripeService.getUserSubscription(),
        StripeService.getUserOrders()
      ]);
      
      setSubscription(subscriptionData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading Stripe data:', error);
    } finally {
      setLoadingSubscription(false);
    }
  };

  // Get the current subscription product
  const getCurrentSubscriptionProduct = (): StripeProduct | null => {
    if (!subscription?.price_id) return null;
    return StripeService.getProductByPriceId(subscription.price_id) || null;
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
      const product = STRIPE_PRODUCTS.find(p => p.id === selectedPackage);
      if (!product) {
        throw new Error('Product not found');
      }

      const result = await StripeService.createCheckoutSession(product.priceId, product.mode);
      
      if (result.success && result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Failed to create checkout session');
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
      {/* Current Subscription Status */}
      {loadingSubscription ? (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        </div>
      ) : subscription && subscription.subscription_status !== 'not_started' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-poppins text-xl font-semibold text-neutral-900">
                  Active Subscription
                </h3>
                <p className="font-lora text-neutral-600">
                  {getCurrentSubscriptionProduct()?.name || 'Unknown Plan'}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-poppins font-semibold ${
              subscription.subscription_status === 'active' 
                ? 'bg-green-100 text-green-700'
                : subscription.subscription_status === 'past_due'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {subscription.subscription_status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          
          {subscription.current_period_end && (
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-lora text-neutral-600">Next billing date:</span>
                <span className="font-poppins font-semibold text-neutral-900">
                  {StripeService.formatDate(subscription.current_period_end)}
                </span>
              </div>
              {subscription.cancel_at_period_end && (
                <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                  Your subscription will cancel at the end of this period.
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                <Star className="h-6 w-6 text-green-600" />
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
              <Edit className="h-4 w-4 mr-2" />
              View My Activity
            </button>
          </div>

          {/* Refer a Friend */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-5 border border-purple-200">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                <Users className="h-6 w-6 text-purple-600" />
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
        {STRIPE_PRODUCTS.map((pkg) => (
          <div
            key={pkg.id}
            className={`relative border rounded-xl p-4 transition-all duration-200 cursor-pointer ${
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
              </div>

              <div className="font-lora text-xs text-neutral-600 mb-2 line-clamp-2">
                {pkg.description}
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

      {/* Selected package summary */}
      {selectedPackage && (
        <div className="bg-primary-50 rounded-xl p-4 mb-6">
          <h4 className="font-poppins font-semibold text-primary-900 mb-2">
            Selected Package
          </h4>
          
          {(() => {
            const pkg = STRIPE_PRODUCTS.find(p => p.id === selectedPackage);
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
                  <span className="font-lora text-primary-700">Credits:</span>
                  <span className="font-poppins font-semibold text-primary-900">{formatLargeNumber(pkg.credits)}</span>
                </div>
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
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Redirecting to checkout...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Buy Credits
          </span>
        )}
      </button>

      {/* Order History */}
      {orders.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-xl font-semibold text-neutral-900 mb-6">
            Purchase History
          </h3>
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => {
              const product = StripeService.getProductByPriceId(order.price_id);
              return (
                <div key={order.order_id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <div>
                    <div className="font-poppins font-semibold text-neutral-900">
                      {product?.name || 'Credit Purchase'}
                    </div>
                    <div className="font-lora text-sm text-neutral-600">
                      {new Date(order.order_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-poppins font-semibold text-neutral-900">
                      {StripeService.formatPrice(order.amount_total / 100, order.currency)}
                    </div>
                    <div className={`text-xs font-poppins font-semibold ${
                      order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {order.payment_status.toUpperCase()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default CreditsManager;