import React, { useState } from 'react';
import { Users, Zap, Copy, Check, Share2 } from 'lucide-react';

interface ReferralProgramProps {
  userId: number;
  userName: string;
}

const ReferralProgram: React.FC<ReferralProgramProps> = ({ userId, userName }) => {
  const [copied, setCopied] = useState(false);
  
  // Generate a referral link
  const getReferralLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?ref=${userId}-${encodeURIComponent(userName.replace(/\s+/g, '-').toLowerCase())}`;
  };
  
  const referralLink = getReferralLink();
  
  // Copy referral link to clipboard
  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Share referral link
  const shareReferralLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Verified & Reviewed',
          text: `Join me on Verified & Reviewed and get 200 free credits! Use my referral link:`,
          url: referralLink
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      copyReferralLink();
    }
  };
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
      <div className="flex items-center mb-6">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
          <Users className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h3 className="font-poppins text-xl font-semibold text-neutral-900">
            Referral Program
          </h3>
          <p className="font-lora text-neutral-600">
            Invite friends and earn credits
          </p>
        </div>
      </div>
                  Earn 20 credits per referral
      <div className="bg-purple-50 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Zap className="h-5 w-5 text-purple-600 mr-2" />
              <div>
                <h4 className="font-poppins font-semibold text-purple-900">
                  Earn 20 credits per referral
                </h4>
                <ul className="font-lora text-sm text-purple-700 mt-2 space-y-1">
                  <li>You earn 20 credits for each friend who signs up</li>
                  <li>Your friend gets 100 signup credits + 20 referral bonus</li>
                </ul>
              </div>
          </div>
        </div>
        
        <p className="font-lora text-sm text-purple-700 mb-4">
          Share your unique link with friends. When they sign up, you'll both receive credits!
        </p>
        
        <div className="bg-white rounded-lg p-3 flex items-center justify-between border border-purple-200">
          <div className="font-mono text-sm text-purple-800 truncate mr-2">
            {referralLink}
          </div>
          <button
            onClick={copyReferralLink}
            className="bg-purple-100 text-purple-700 p-2 rounded-lg hover:bg-purple-200 transition-colors duration-200 flex-shrink-0"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
      </div>
      
      <div className="space-y-4">
        <button
          onClick={shareReferralLink}
          className="w-full font-poppins bg-purple-500 text-white px-4 py-3 rounded-lg font-semibold hover:bg-purple-600 transition-colors duration-200 flex items-center justify-center"
        >
          <Share2 className="h-5 w-5 mr-2" />
          Share Your Referral Link
        </button>
        
        <div className="bg-neutral-50 rounded-lg p-4">
          <h4 className="font-poppins font-semibold text-neutral-800 mb-2">
            How it works:
          </h4>
          <ol className="font-lora text-sm text-neutral-600 space-y-2 list-decimal pl-5">
            <li>Share your unique referral link with friends</li>
            <li>When they create an account, you both get rewarded</li>
            <li>You earn 100 credits for each friend who signs up</li>
            <li>Your friend gets 200 signup credits + 100 referral bonus</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ReferralProgram;