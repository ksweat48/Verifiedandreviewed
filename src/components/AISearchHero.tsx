              ```jsx
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