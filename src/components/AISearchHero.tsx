              </div>
            </div>
            
            {/* Sample Prompts */}
            <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setSearchQuery(prompt);
                    handleSearch();
                  }}
                  className="bg-white/10 border border-white/30 text-white px-3 py-1 rounded-full text-sm font-lora hover:bg-white/20 hover:border-white transition-colors duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showResults && (
        <div className={`w-full bg-white border-b border-neutral-100 shadow-sm ${isAppModeActive ? 'search-bar-fixed' : 'sticky top-16 z-40'} mb-1`}>
        <div ref={searchBarRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div 
            ref={searchRef}
            className="relative w-full"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
            <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
              <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center w-full">
                <Icons.Sparkles className="h-5 w-5 text-primary-500 ml-2 sm:ml-4 mr-2 sm:mr-3 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
                  className="flex-1 py-2 sm:py-3 px-2 text-base font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none min-w-0"
                />
                <button
                  onClick={startVoiceRecognition}
                  className={`p-2 rounded-full ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200 flex-shrink-0`}
                  aria-label="Voice search"
                  type="button"
                >
                  <Icons.Mic className="h-5 w-5" />
                </button>
                
                {/* Credit display for logged-in users */}
               {isAuthenticated && userCredits > 0 && (
                  <div className="hidden sm:flex items-center mr-2 bg-primary-50 px-2 py-1 rounded-lg">
                    {semanticSearchAvailable && useSemanticSearch ? (
                      <Icons.Brain className="h-3 w-3 text-purple-500 mr-1" />
                    ) : (
                      <Icons.Zap className="h-3 w-3 text-primary-500 mr-1" />
                    )}
                    <span className="font-poppins text-xs font-semibold text-primary-700">
                      {userCredits} credits
                    </span>
                  </div>
                )}
                
                {/* Free trial credits for non-logged-in users */}
                <button
                  type="submit"
                  disabled={isSearching || geoLoading} // Disable search if geolocation is loading
                  className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                  aria-label="Search"
                >
                  {isSearching ? (
                    <span className="flex items-center">
                      <Icons.Loader2 className="h-5 w-5 animate-spin sm:mr-2" />
                      <span className="hidden sm:inline">Thinking...</span>
                    </span>
                  ) : geoLoading ? ( // Show loading state for geolocation
                    <span className="flex items-center">
                      <Icons.MapPin className="h-5 w-5 animate-pulse sm:mr-2" />
                      <span className="hidden sm:inline">Locating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <Icons.Search className="h-5 w-5 sm:mr-2" />
                      <span className="hidden sm:inline">Search</span>
                    </span>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
        </div>
      )}
      
      {/* Exit Search Button */}
      {isAppModeActive && (
        <button 
          onClick={exitAppMode}
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-auto px-4 py-2 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
          aria-label="Exit search mode"
        >
          <Icons.LogOut className="h-4 w-4 mr-2 text-neutral-600" />
          <span className="font-poppins text-sm text-neutral-600">Exit Search</span>
        </button>
      )}
      
      {geoError && ( // Display geolocation error
        <div className="max-w-md mx-auto mt-4 bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icons.AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="ml-3">
              <h3 className="font-poppins text-sm font-semibold text-red-800">
                Location Error
              </h3>
              <p className="font-lora text-xs text-red-700 mt-1">
                {geoError}
              </p>
              <p className="font-lora text-xs text-red-700 mt-1">
                Search results might be less relevant without your precise location.
              </p>
            </div>
            <button
              onClick={() => { /* Optionally clear error or provide retry */ }}
              className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showCreditWarning && (
        <div className="max-w-md mx-auto mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Icons.AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div className="ml-3">
              <h3 className="font-poppins text-sm font-semibold text-yellow-800">
                {userCredits < (usedAI ? 10 : 1) ? 'Not enough credits' : 'Search temporarily unavailable'}
              </h3>
              <p className="font-lora text-xs text-yellow-700 mt-1">
                {userCredits < (usedAI ? 10 : 1) 
                  ? `You need ${usedAI ? '10 credits' : '1 credit'} for this search. Purchase more credits to continue searching.`
                  : 'AI search is temporarily unavailable. Please try again in a moment.'
                }
              </p>
              <div className="mt-2">
                {userCredits < (usedAI ? 10 : 1) ? (
                  <button
                    onClick={() => {
                      // Navigate to credits page
                      window.location.href = '/account';
                    }}
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Get More Credits
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCreditWarning(false)}
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCreditWarning(false)}
              className="ml-auto flex-shrink-0 text-yellow-500 hover:text-yellow-700"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showSignupPrompt && (
        <div className="max-w-md mx-auto mt-4 animate-in slide-in-from-top-4 duration-300">
          <SignupPrompt 
            onClose={() => setShowSignupPrompt(false)}
            onSignup={handleSignup}
            onLogin={handleLogin}
          />
        </div>
      )}

      <div
        ref={resultsRef} 
        className={`transition-all duration-500 z-10 w-full ${isAppModeActive ? 'pt-20' : ''} ${
          showResults && results.length > 0 ? 'opacity-100 mt-0 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
        style={{
          height: isAppModeActive ? 'calc(100vh - 60px)' : 'auto',
          maxHeight: isAppModeActive ? 'calc(100vh - 60px)' : showResults ? '800px' : '0'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 relative z-20">
          {results.length > 0 && showResults && (
            <div className="relative">
              {/* Vertical scrollable layout */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-8"
              >
                {results.map((business, businessIndex) => (
                  <div key={`${business.id}-${businessIndex}`} className={business.isPlatformBusiness ? "sm:col-span-2 lg:col-span-2 flex flex-col h-full" : ""}>
                    {business.isPlatformBusiness ? (
                      <PlatformBusinessCard
                        business={business}
                        onRecommend={handleRecommend}
                        onTakeMeThere={handleTakeMeThere}
                      />
                    ) : (
                      <AIBusinessCard
                        business={business}
                        onRecommend={handleRecommend}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {showResults && results.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Search className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                No businesses found
              </h3>
              <p className="font-lora text-neutral-600 mb-4">
                We couldn't find any businesses matching "{searchQuery}" in your area.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                  setIsAppModeActive(false);
                }}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
              >
                Try Another Search
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AISearchHero;
                reviews: business.reviews || [],
                isPlatformBusiness: false
                duration: business.duration || Math.floor(Math.random() * 10 + 5), // Ensure duration is present
              }));
                distance: business.distance || Math.round((Math.random() * 4 + 1) * 10) / 10, // Ensure distance is present
              
                address: business.address || 'Address not available',
              console.log(`🤖 Using AI to enhance search results for: ${searchQuery} (${numAINeeded} AI businesses)`);
                hours: business.hours || 'Hours unavailable',
              const combinedResults = [...platformBusinesses, ...aiGeneratedBusinesses];
                isOpen: business.isOpen !== undefined ? business.isOpen : true,
              
                image: business.image || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
              // Sort and limit results: Platform businesses first, then open businesses, then closest, limit to 5 total
                rating: business.rating || { thumbsUp: 0, thumbsDown: 0, sentimentScore: 75 },
              const sortedResults = combinedResults.sort((a, b) => {
                id: business.id || `ai-${Date.now()}-${Math.random()}`,
                // First priority: Platform businesses
                // Ensure all required fields are present
                if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
                ...business,
                if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
              const aiGeneratedBusinesses = data.results.map(business => ({
                
              // Combine platform businesses with AI-generated businesses
                // First priority: Open businesses
            if (data.success && data.results) {
                if (a.isOpen && !b.isOpen) return -1;
            
                if (!a.isOpen && b.isOpen) return 1;
            console.log('🎯 AI search response:', data);
                
            const data = await response.json();
                // Second priority: Closest businesses (by distance)
            
                if (a.distance && b.distance) {
            }
                  if (a.distance < b.distance) return -1;
              throw new Error(`AI search failed: ${response.status} - ${errorText}`);
                  if (a.distance > b.distance) return 1;
              console.error('AI search API error:', response.status, errorText);
                }
              const errorText = await response.text();
                
            if (!response.ok) {
                return 0;
            
              });
            }, 25000); // 25 second timeout for AI business search
              
              })
              // Remove duplicates by ID and limit to 5
                longitude: longitude  // Pass user's longitude from hook
              const uniqueResults = sortedResults.filter((business, index, self) => 
                latitude: latitude,   // Pass user's latitude from hook
                index === self.findIndex(b => b.id === business.id)
                numToGenerate: numAINeeded,
              ).slice(0, 5);
                existingResultsCount: transformedBusinesses.length,
              
                searchQuery: searchQuery,
              setResults(uniqueResults);
                prompt: aiPrompt,
              console.log('✅ Combined results:', combinedResults.length, 'businesses');
              body: JSON.stringify({ 
              
              },
              trackEvent('search_performed', { 
                'Accept': 'application/json'
                query: searchQuery, 
                'Content-Type': 'application/json',
                used_ai: needsAI,
              headers: {
                used_semantic: usedSemanticSearch,
              method: 'POST',
                credits_deducted: creditsRequired,
            const response = await fetchWithTimeout('/.netlify/functions/ai-business-search', {
                results_count: uniqueResults.length,

                platform_results: platformBusinesses.length,
              : `Find businesses that match: "${searchQuery}". Focus on the mood, vibe, or specific needs expressed in this search.`;
                ai_results: aiGeneratedBusinesses.length
              ? `Find businesses similar to "${searchQuery}". I already have ${transformedBusinesses.length} results, so provide ${numAINeeded} different but related businesses that match this search intent.`
              });
            const aiPrompt = transformedBusinesses.length > 0 
            } else {
            // Prepare the AI prompt with context about existing results
              console.error('AI search failed:', data);
            
              throw new Error(data.error || data.message || 'Failed to get AI business suggestions');
            }
            }
              return;
          } catch (aiError) {
              });
            console.error('AI search error:', aiError);
                ai_results: 0
            console.log('🔄 Falling back to platform-only results');
                platform_results: Math.min(transformedBusinesses.length, 5),
            
                results_count: Math.min(transformedBusinesses.length, 5),
            // Show error message to user
                credits_deducted: creditsRequired,
            setShowCreditWarning(true);
                used_ai: false, 
            // Sort and limit results: Platform businesses first, then open businesses first, limit to 5 total
                query: searchQuery, 
            const sortedResults = transformedBusinesses.sort((a, b) => {
              trackEvent('search_performed', { 
              // First priority: Platform businesses
              console.log('📊 Using platform-only results (5+ available):', searchQuery);
              if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
              setResults(transformedBusinesses.slice(0, 5));
              if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
              // We already have 5 or more platform businesses, no AI needed
              
            if (numAINeeded === 0) {
              // Second priority: Open businesses
            
              if (a.isOpen && !b.isOpen) return -1;
            const numAINeeded = Math.max(0, 5 - transformedBusinesses.length);
              if (!a.isOpen && b.isOpen) return 1;
            // Calculate how many AI businesses we need (max 4 total cards)
              
          try {
              // Third priority: Closest businesses (by distance)
          
              if (a.distance && b.distance) {
          setIsSearching(true);
                if (a.distance < b.distance) return -1;
          // Call OpenAI API through our serverless function
                if (a.distance > b.distance) return 1;
        if (needsAI) {
              }
      if (canProceed) {
              
      
              return 0;
      }
            }).slice(0, 5);
        }
            
          }
            // Fallback to platform businesses if AI search fails
            canProceed = false;
            // Remove duplicates by ID and limit to 5
            setShowCreditWarning(true);
            const uniquePlatformResults = sortedResults.filter((business, index, self) => 
          } else {
              index === self.findIndex(b => b.id === business.id)
            setUserCredits(prev => prev - creditsRequired);
            ).slice(0, 5);
            // Update local credit count
            
          if (success) {
            setResults(uniquePlatformResults);
          const success = await CreditService.deductSearchCredits(currentUser.id, usedSemanticSearch ? 'semantic' : (needsAI ? 'ai' : 'platform')); // Fix: use currentUser.id
            trackEvent('search_performed', { 
          // Deduct credits
              query: searchQuery, 
        } else {
              used_ai: false, 
          canProceed = false;
              credits_deducted: creditsRequired,
          setShowCreditWarning(true);
              results_count: uniquePlatformResults.length,
        if (userCredits < creditsRequired) {
              error: aiError.message,
        // Check credit balance for all users
              fallback: true
      if (currentUser && currentUser.id) {
            });
      
          }
      const creditsRequired = usedSemanticSearch ? 5 : (needsAI ? 10 : 1); // Semantic search costs 5 credits
        } else {
      let canProceed = true;
          // Just use the platform businesses

          const sortedResults = transformedBusinesses.sort((a, b) => {
      setUsedAI(needsAI && !usedSemanticSearch);
            // First priority: Platform businesses (all are platform businesses here)

            if (a.isPlatformBusiness && !b.isPlatformBusiness) return -1;
      }
            if (!a.isPlatformBusiness && b.isPlatformBusiness) return 1;
        }
            
          needsAI = true;
            // Second priority: Open businesses
          console.error('Error fetching businesses from Supabase:', error);
            if (a.isOpen && !b.isOpen) return -1;
        } catch (error) {
            if (!a.isOpen && b.isOpen) return 1;
          needsAI = transformedBusinesses.length < 6;
            
          // Use AI if we have fewer than 6 total results (platform + unverified)
            // Third priority: Closest businesses (by distance)
          
            if (a.distance && b.distance) {
              </div>
              if (a.distance < b.distance) return -1;
            </div>
              if (a.distance > b.distance) return 1;
            
            }
            {/* Sample Prompts */}
            
            <div className="flex flex-wrap justify-center gap-1 sm:gap-2">
            return 0;
              {samplePrompts.map((prompt) => (
          });
                <button
          
                  key={prompt}
          // Remove duplicates by ID and limit to 5
                  onClick={() => {
          const uniquePlatformResults = sortedResults.filter((business, index, self) => 
                    setSearchQuery(prompt);
            index === self.findIndex(b => b.id === business.id)
                    handleSearch();
          ).slice(0, 5);
                  }}
          
                  className="bg-white/10 border border-white/30 text-white px-3 py-1 rounded-full text-sm font-lora hover:bg-white/20 hover:border-white transition-colors duration-200"
          setResults(uniquePlatformResults);
                >
          console.log('📊 Using platform-only results for:', searchQuery);
                  {prompt}
          trackEvent('search_performed', { 
                </button>
            query: searchQuery, 
              ))}
            used_ai: false,
            </div>
            used_semantic: usedSemanticSearch,
          </div>
            credits_deducted: creditsRequired,
        </div>
            results_count: uniquePlatformResults.length
      )}
          });

        }
      {showResults && (
      } else {
        <div className={`w-full bg-white border-b border-neutral-100 shadow-sm ${isAppModeActive ? 'search-bar-fixed' : 'sticky top-16 z-40'} mb-1`}>
        setShowCreditWarning(true);
        <div ref={searchBarRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        setResults([]);
          <div 
        trackEvent('search_performed', { 
            ref={searchRef}
          query: searchQuery, 
            className="relative w-full"
          used_ai: false,
          >
          used_semantic: false,
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
          credits_deducted: 0,
            <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
          error: 'Insufficient credits'
              <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center w-full">
        });
                <Icons.Sparkles className="h-5 w-5 text-primary-500 ml-2 sm:ml-4 mr-2 sm:mr-3 flex-shrink-0" />
      }
                <input
    } catch (error) {
                  ref={searchInputRef}
      console.error('Search error:', error);
                  type="text"
    } finally {
                  value={searchQuery}
      setIsSearching(false);
                  onChange={(e) => setSearchQuery(e.target.value)}
    }
                  placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
  };
                  className="flex-1 py-2 sm:py-3 px-2 text-base font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none min-w-0"

                />
  // Exit app mode
                <button
  const exitAppMode = () => {
                  onClick={startVoiceRecognition}
    setIsAppModeActive(false);
                  className={`p-2 rounded-full ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200 flex-shrink-0`}
    setShowResults(false);
                  aria-label="Voice search"
    
                  type="button"
    // Go back in history to remove the app-mode state
                >
    window.history.back();
                  <Icons.Mic className="h-5 w-5" />
  };
                </button>

                
  const startVoiceRecognition = () => {
                {/* Credit display for logged-in users */}
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
               {isAuthenticated && userCredits > 0 && (
      alert('Voice recognition is not supported in your browser.');
                  <div className="hidden sm:flex items-center mr-2 bg-primary-50 px-2 py-1 rounded-lg">
      return;
                    {semanticSearchAvailable && useSemanticSearch ? (
    }
                      <Icons.Brain className="h-3 w-3 text-purple-500 mr-1" />

                    ) : (
    setIsListening(true);
                      <Icons.Zap className="h-3 w-3 text-primary-500 mr-1" />

                    )}
    // @ts-ignore
                    <span className="font-poppins text-xs font-semibold text-primary-700">
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                      {userCredits} credits
    const recognition = new SpeechRecognition();
                    </span>
    
                  </div>
    recognition.lang = 'en-US';
                )}
    recognition.continuous = false;
                
    recognition.interimResults = false;
                {/* Free trial credits for non-logged-in users */}

                <button
    recognition.onresult = (event) => {
                  type="submit"
      const transcript = event.results[0][0].transcript;
                  disabled={isSearching || geoLoading} // Disable search if geolocation is loading
      setSearchQuery(transcript);
                  className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
      handleSearch();
                  aria-label="Search"
      setIsListening(false);
                >
    };
                  {isSearching ? (

                    <span className="flex items-center">
    recognition.onerror = (event) => {
                      <Icons.Loader2 className="h-5 w-5 animate-spin sm:mr-2" />
      console.error('Speech recognition error', event.error);
                      <span className="hidden sm:inline">Thinking...</span>
      setIsListening(false);
                    </span>
    };
                  ) : geoLoading ? ( // Show loading state for geolocation

                    <span className="flex items-center">
    recognition.onend = () => {
                      <Icons.MapPin className="h-5 w-5 animate-pulse sm:mr-2" />
      setIsListening(false);
                      <span className="hidden sm:inline">Locating...</span>
    };
                    </span>

                  ) : (
    recognition.start();
                    <span className="flex items-center">
  };
                      <Icons.Search className="h-5 w-5 sm:mr-2" />

                      <span className="hidden sm:inline">Search</span>
  const handleRecommend = async (business) => {
                    </span>
    // Log to Supabase for admin approval
                  )}
    console.log('Recommending business:', business.name);
                </button>
    alert(`Thanks! We'll review ${business.name} for addition to our platform.`);
              </form>
  };
            </div>

          </div>
  const handleTakeMeThere = (business) => {
        </div>
    // Record the business visit for platform businesses
        </div>
    if (business.isPlatformBusiness && currentUser && currentUser.id) {
      )}
      BusinessService.recordBusinessVisit(business.id, currentUser.id)
      
        .then(success => {
      {/* Exit Search Button */}
          if (success) {
      {isAppModeActive && (
            console.log('✅ Business visit recorded for:', business.name);
        <button 
            // Dispatch event to update visited businesses list
          onClick={exitAppMode}
            window.dispatchEvent(new CustomEvent('visited-businesses-updated'));
          className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-auto px-4 py-2 bg-white bg-opacity-80 rounded-full shadow-lg flex items-center justify-center border border-neutral-100"
          }
          aria-label="Exit search mode"
        })
        >
        .catch(error => {
          <Icons.LogOut className="h-4 w-4 mr-2 text-neutral-600" />
          console.error('❌ Error recording business visit:', error);
          <span className="font-poppins text-sm text-neutral-600">Exit Search</span>
        });
        </button>
    }
      )}
    
      
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`;
      {geoError && ( // Display geolocation error
    window.open(mapsUrl, '_blank');
        <div className="max-w-md mx-auto mt-4 bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
  };
          <div className="flex items-start">

            <div className="flex-shrink-0">
  const handleSignup = () => {
              <Icons.AlertCircle className="h-5 w-5 text-red-500" />
    console.log('Opening signup modal from AISearchHero');
            </div>
    setShowSignupPrompt(false); // Close the signup prompt first
            <div className="ml-3">
    trackEvent('signup_prompt_clicked', { source: 'search_hero' });
              <h3 className="font-poppins text-sm font-semibold text-red-800">
    
                Location Error
    // Force signup mode
              </h3>
    const event = new CustomEvent('open-auth-modal', { 
              <p className="font-lora text-xs text-red-700 mt-1">
      detail: { 
                {geoError}
        mode: 'signup',
              </p>
        forceMode: true 
              <p className="font-lora text-xs text-red-700 mt-1">
      } 
                Search results might be less relevant without your precise location.
    });
              </p>
    document.dispatchEvent(event);
            </div>
  };
            <button
  
              onClick={() => { /* Optionally clear error or provide retry */ }}
  const handleLogin = () => {
              className="ml-auto flex-shrink-0 text-red-500 hover:text-red-700"
    console.log('Opening login modal');
            >
    // Trigger the auth modal to open in login mode
              <Icons.X className="h-4 w-4" />
    trackEvent('login_prompt_clicked', { source: 'search_hero' });
            </button>
    setShowSignupPrompt(false); // Close the signup prompt first
          </div>
    const event = new CustomEvent('open-auth-modal', { 
        </div>
      detail: { 
      )}
        mode: 'login',

        forceMode: true 
      {showCreditWarning && (
      } 
        <div className="max-w-md mx-auto mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 animate-in slide-in-from-top-4 duration-300">
    });
          <div className="flex items-start">
    document.dispatchEvent(event);
            <div className="flex-shrink-0">
  };
              <Icons.AlertCircle className="h-5 w-5 text-yellow-500" />

            </div>
  useEffect(() => {
            <div className="ml-3">
    const handleKeyPress = (e) => {
              <h3 className="font-poppins text-sm font-semibold text-yellow-800">
      if (e.key === 'Enter' && searchInputRef.current === document.activeElement) {
                {userCredits < (usedAI ? 10 : 1) ? 'Not enough credits' : 'Search temporarily unavailable'}
        handleSearch();
              </h3>
      }
              <p className="font-lora text-xs text-yellow-700 mt-1">
    };
                {userCredits < (usedAI ? 10 : 1) 

                  ? `You need ${usedAI ? '10 credits' : '1 credit'} for this search. Purchase more credits to continue searching.`
    window.addEventListener('keypress', handleKeyPress);
                  : 'AI search is temporarily unavailable. Please try again in a moment.'
    return () => window.removeEventListener('keypress', handleKeyPress);
                }
  }, [searchQuery]);
              </p>

              <div className="mt-2">
  useEffect(() => {
                {userCredits < (usedAI ? 10 : 1) ? (
    // Results will be populated when search is performed
                  <button
  }, [showResults, results.length]);
                    onClick={() => {

                      // Navigate to credits page
  const platformBusinesses = results.filter(b => b.isPlatformBusiness);
                      window.location.href = '/account';
  const aiBusinesses = results.filter(b => !b.isPlatformBusiness);
                    }}
  
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
  return (
                  >
    <div 
                    Get More Credits
      className={`relative flex flex-col h-screen ${isAppModeActive ? 'overflow-hidden' : ''}`}
                  </button>
    >
                ) : (
      {/* Blurred Background Layer */}
                  <button
      <div 
                    onClick={() => setShowCreditWarning(false)}
        className="absolute inset-0"
                    className="font-poppins text-xs font-semibold text-yellow-800 hover:text-yellow-900 underline"
        style={{
                  >
          backgroundImage: 'url("/ChatGPT Image Jul 12, 2025, 05_41_06 AM.png")',
                    Try Again
          backgroundSize: 'cover',
                  </button>
          backgroundPosition: 'center',
                )}
          filter: 'blur(2px)'
              </div>
        }}
            </div>
      ></div>
            <button
      
              onClick={() => setShowCreditWarning(false)}
      {/* Dark overlay for text readability */}
              className="ml-auto flex-shrink-0 text-yellow-500 hover:text-yellow-700"
      <div className="absolute inset-0 bg-black/50"></div>
            >
      
              <Icons.X className="h-4 w-4" />
      {!showResults && (
            </button>
        <div className="flex flex-col justify-center items-center flex-grow z-10 px-4 sm:px-6 lg:px-8">
          </div>
          {/* Centered Hero Content Container */}
        </div>
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
      )}
            {/* Title and Subtitle */}

            <div className="mb-8">
      {showSignupPrompt && (
              <h1 className="font-cinzel text-4xl md:text-7xl lg:text-8xl font-bold text-neutral-900 mb-6 mx-auto">
        <div className="max-w-md mx-auto mt-4 animate-in slide-in-from-top-4 duration-300">
                <span className="text-white drop-shadow-lg">Discover what matters</span>
          <SignupPrompt 
              </h1>
            onClose={() => setShowSignupPrompt(false)}
              <p className="font-lora text-xl md:text-3xl text-neutral-600 mb-4 max-w-2xl mx-auto">
            onSignup={handleSignup}
                <span className="text-white drop-shadow-md">
            onLogin={handleLogin}
                Find places with a vibe, a feeling, or just a word.
          />
                </span>
        </div>
              </p>
      )}
            </div>

            
      <div
            {/* Search Bar */}
        ref={resultsRef} 
            <div className="w-full max-w-2xl mx-auto mb-6">
        className={`transition-all duration-500 z-10 w-full ${isAppModeActive ? 'pt-20' : ''} ${
              <div 
          showResults && results.length > 0 ? 'opacity-100 mt-0 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'
                ref={searchRef}
        }`}
                className="relative w-full"
        style={{
              >
          height: isAppModeActive ? 'calc(100vh - 60px)' : 'auto',
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur opacity-20"></div>
          maxHeight: isAppModeActive ? 'calc(100vh - 60px)' : showResults ? '800px' : '0'
                <div className="relative bg-white rounded-xl shadow-md border border-neutral-200 p-2 w-full">
        }}
                  <form onSubmit={(e) => {e.preventDefault(); handleSearch();}} className="flex items-center w-full">
      >
                    <Icons.Sparkles className="h-5 w-5 text-primary-500 ml-1 sm:ml-4 mr-1 sm:mr-3 flex-shrink-0" />
        <div className="max-w-7xl mx-auto px-4 relative z-20">
                    <input
          {results.length > 0 && showResults && (
                      ref={searchInputRef}
            <div className="relative">
                      type="text"
              {/* Vertical scrollable layout */}
                      value={searchQuery}
              <div
                      onChange={(e) => setSearchQuery(e.target.value)}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-8"
                      placeholder="peaceful brunch spot, vibe-y wine bar, cozy coffee for work..."
              >
                      className="flex-1 py-2 sm:py-3 px-1 text-base font-lora text-neutral-700 placeholder-neutral-400 bg-transparent border-none outline-none min-w-0"
                {results.map((business, businessIndex) => (
                    />
                  <div key={`${business.id}-${businessIndex}`} className={business.isPlatformBusiness ? "sm:col-span-2 lg:col-span-2 flex flex-col h-full" : ""}>
                    <button
                    {business.isPlatformBusiness ? (
                      onClick={startVoiceRecognition}
                      <PlatformBusinessCard
                      className={`p-1 rounded-full ${isListening ? 'bg-primary-100 text-primary-600 animate-pulse' : 'text-neutral-400 hover:text-primary-500 hover:bg-primary-50'} transition-colors duration-200 flex-shrink-0`}
                        business={business}
                      aria-label="Voice search"
                        onRecommend={handleRecommend}
                      type="button"
                        onTakeMeThere={handleTakeMeThere}
                    >
                      />
                      <Icons.Mic className="h-5 w-5" />
                    ) : (
                    </button>
                      <AIBusinessCard
                    
                        business={business}
                    {/* Credit display for logged-in users */}
                        onRecommend={handleRecommend}
                   {isAuthenticated && userCredits > 0 && (
                      />
                      <div className="hidden sm:flex items-center mr-2 bg-primary-50 px-2 py-1 rounded-lg">
                    )}
                        {semanticSearchAvailable && useSemanticSearch ? (
                  </div>
                          <Icons.Brain className="h-3 w-3 text-purple-500 mr-1" />
                ))}
                        ) : (
              </div>
                          <Icons.Zap className="h-3 w-3 text-primary-500 mr-1" />
            </div>
                        )}
          )}
                        <span className="font-poppins text-xs font-semibold text-primary-700">
          
                          {userCredits} credits
          {showResults && results.length === 0 && !isSearching && (
                        </span>
            <div className="text-center py-12">
                      </div>
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    )}
                <Icons.Search className="h-8 w-8 text-neutral-400" />
                    
              </div>
                    {/* Free trial credits for non-logged-in users */}
              <h3 className="font-poppins text-lg font-semibold text-neutral-700 mb-2">
                    <button
                No businesses found
                      type="submit"
              </h3>
                      disabled={isSearching || geoLoading} // Disable search if geolocation is loading
              <p className="font-lora text-neutral-600 mb-4">
                      className="bg-gradient-to-r from-primary-500 to-accent-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg font-poppins font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex-shrink-0"
                We couldn't find any businesses matching "{searchQuery}" in your area.
                      aria-label="Search"
              </p>
                    >
              <button
                      {isSearching ? (
                onClick={() => {
                        <span className="flex items-center">
                  setSearchQuery('');
                          <Icons.Loader2 className="h-5 w-5 animate-spin sm:mr-2" />
                  setShowResults(false);
                          <span className="hidden sm:inline">Thinking...</span>
                  setIsAppModeActive(false);
                        </span>
                }}
                      ) : geoLoading ? ( // Show loading state for geolocation
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200"
                        <span className="flex items-center">
              >
                          <Icons.MapPin className="h-5 w-5 animate-pulse sm:mr-2" />
                Try Another Search
                          <span className="hidden sm:inline">Locating...</span>
              </button>
                        </span>
            </div>
                      ) : (
          )}
                        <span className="flex items-center">
        </div>
                          <Icons.Search className="h-5 w-5 sm:mr-2" />
      </div>
                          <span className="hidden sm:inline">Search</span>

                        </span>
    </div>
                      )}
  );
                    </button>
};
                  </form>

                </div>
export default AISearchHero;