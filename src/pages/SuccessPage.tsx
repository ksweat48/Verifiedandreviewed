import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { StripeService } from '../services/stripeService';
import { useAuth } from '../hooks/useAuth';

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID found');
      setLoading(false);
      return;
    }

    // Load order details
    const loadOrderDetails = async () => {
      try {
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const orders = await StripeService.getUserOrders();
        const recentOrder = orders.find(order => order.checkout_session_id === sessionId);
        
        if (recentOrder) {
          const product = StripeService.getProductByPriceId(recentOrder.price_id);
          setOrderDetails({
            ...recentOrder,
            product
          });
        } else {
          // If order not found immediately, it might still be processing
          setError('Order is still processing. Please check your dashboard in a few minutes.');
        }
      } catch (err) {
        console.error('Error loading order details:', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    loadOrderDetails();
  }, [sessionId]);

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Please Log In
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            You need to be logged in to view this page.
          </p>
          <button
            onClick={() => navigate('/')}
            className="font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-16 w-16 text-primary-500 mx-auto mb-4 animate-spin" />
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-2">
            Processing Your Order
          </h1>
          <p className="font-lora text-neutral-600">
            Please wait while we confirm your payment...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="h-8 w-8 text-yellow-600" />
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-neutral-900 mb-4">
            Order Processing
          </h1>
          <p className="font-lora text-neutral-600 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/dashboard?tab=credits')}
              className="w-full font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
            >
              View Dashboard
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full font-poppins border border-neutral-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-green-200">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h1 className="font-cinzel text-3xl font-bold text-neutral-900 mb-2">
              Payment Successful!
            </h1>
            <p className="font-lora text-lg text-neutral-600">
              Your credits have been added to your account
            </p>
          </div>

          {/* Order Details */}
          {orderDetails && (
            <div className="bg-green-50 rounded-xl p-6 mb-8">
              <h2 className="font-poppins text-xl font-semibold text-green-900 mb-4 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Order Summary
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-lora text-green-700">Package:</span>
                  <span className="font-poppins font-semibold text-green-900">
                    {orderDetails.product?.name || 'Credit Package'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-lora text-green-700">Credits Added:</span>
                  <span className="font-poppins font-semibold text-green-900">
                    {orderDetails.product?.credits || 'N/A'} credits
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-lora text-green-700">Amount Paid:</span>
                  <span className="font-poppins font-semibold text-green-900">
                    {StripeService.formatPrice(orderDetails.amount_total / 100, orderDetails.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-lora text-green-700">Order Date:</span>
                  <span className="font-poppins font-semibold text-green-900">
                    {new Date(orderDetails.order_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* What's Next */}
          <div className="bg-neutral-50 rounded-xl p-6 mb-8">
            <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
              What's Next?
            </h3>
            <ul className="font-lora text-neutral-700 space-y-2">
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                Your credits are now available in your account
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                Start searching for businesses with AI-powered vibe matching
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                Earn more credits by leaving reviews and referring friends
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => navigate('/')}
              className="w-full font-poppins bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center justify-center"
            >
              Start Searching
              <ArrowRight className="h-5 w-5 ml-2" />
            </button>
            
            <button
              onClick={() => navigate('/dashboard?tab=credits')}
              className="w-full font-poppins border border-neutral-300 text-neutral-700 px-6 py-3 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
            >
              View Dashboard
            </button>
          </div>

          {/* Receipt Info */}
          <div className="mt-8 pt-6 border-t border-neutral-200 text-center">
            <p className="font-lora text-sm text-neutral-500">
              A receipt has been sent to your email address.
              <br />
              Need help? Contact our support team.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;