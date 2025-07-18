import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { mockAutomatedContentData } from '../data/mockData';

interface ContentGenerationStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextRun: string | null;
  postsGenerated: number;
  targetPosts: number;
  errors: string[];
}

interface GeneratedPost {
  id: string;
  title: string;
  businessName: string;
  status: 'generated' | 'published' | 'failed';
  timestamp: string;
  url?: string;
}

interface LocationFilter {
  id: string;
  type: 'city' | 'county' | 'zipcode' | 'area';
  value: string;
  displayName: string;
}

const AutomatedContentManager = () => {
  const [status, setStatus] = useState<ContentGenerationStatus>({
    isRunning: false,
    lastRun: null,
    nextRun: null,
    postsGenerated: 0,
    targetPosts: 10,
    errors: []
  });

  const [recentPosts, setRecentPosts] = useState<GeneratedPost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState({
    dailyPostCount: 10,
    publishTime: '07:00',
    autoPublish: true,
    requireApproval: false
  });

  // Location filtering state
  const [locationFilters, setLocationFilters] = useState<LocationFilter[]>([
    { id: '1', type: 'city', value: 'Seattle', displayName: 'Seattle, WA' },
    { id: '2', type: 'city', value: 'Miami', displayName: 'Miami, FL' },
    { id: '3', type: 'county', value: 'King County', displayName: 'King County, WA' }
  ]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    type: 'city' as LocationFilter['type'],
    value: '',
    displayName: ''
  });

  useEffect(() => {
    loadStatus();
    loadRecentPosts();
    loadLocationFilters();
  }, []);

  const loadStatus = () => {
    const savedStatus = localStorage.getItem('content_generation_status');
    if (savedStatus) {
      setStatus(JSON.parse(savedStatus));
    }
  };

  const loadRecentPosts = () => {
    const savedPosts = localStorage.getItem('recent_generated_posts');
    if (savedPosts) {
      setRecentPosts(JSON.parse(savedPosts));
    }
  };

  const loadLocationFilters = () => {
    const savedFilters = localStorage.getItem('ai_location_filters');
    if (savedFilters) {
      setLocationFilters(JSON.parse(savedFilters));
    }
  };

  const saveLocationFilters = (filters: LocationFilter[]) => {
    localStorage.setItem('ai_location_filters', JSON.stringify(filters));
    setLocationFilters(filters);
  };

  const handleAddLocation = () => {
    if (!newLocation.value.trim()) return;

    const filter: LocationFilter = {
      id: Date.now().toString(),
      type: newLocation.type,
      value: newLocation.value.trim(),
      displayName: newLocation.displayName.trim() || newLocation.value.trim()
    };

    const updatedFilters = [...locationFilters, filter];
    saveLocationFilters(updatedFilters);
    
    setNewLocation({ type: 'city', value: '', displayName: '' });
    setShowAddLocation(false);
  };

  const handleRemoveLocation = (id: string) => {
    const updatedFilters = locationFilters.filter(filter => filter.id !== id);
    saveLocationFilters(updatedFilters);
  };

  const handleManualGeneration = async () => {
    setIsGenerating(true);
    
    try {
      // Simulate API call with location filtering
      const response = await fetch('/.netlify/functions/daily-content-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationFilters: locationFilters,
          targetPosts: settings.dailyPostCount
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus(prev => ({
          ...prev,
          lastRun: new Date().toISOString(),
          postsGenerated: result.postsGenerated,
          errors: []
        }));

        const newPosts = result.results.map((r: any, index: number) => ({
          id: `manual-${Date.now()}-${index}`,
          title: `${r.business} Review`,
          businessName: r.business,
          status: r.success ? 'published' : 'failed',
          timestamp: new Date().toISOString(),
          url: r.postUrl
        }));

        setRecentPosts(prev => [...newPosts, ...prev].slice(0, 20));
        
        alert(`Successfully generated ${result.postsGenerated} posts from ${locationFilters.length} location(s)!`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Failed to generate content. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAutomation = () => {
    setStatus(prev => ({
      ...prev,
      isRunning: !prev.isRunning,
      nextRun: !prev.isRunning ? getNextRunTime() : null
    }));
  };

  const getNextRunTime = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(parseInt(settings.publishTime.split(':')[0]), parseInt(settings.publishTime.split(':')[1]), 0, 0);
    return tomorrow.toISOString();
  };

  const updateSettings = (newSettings: Partial<typeof settings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    localStorage.setItem('content_generation_settings', JSON.stringify({ ...settings, ...newSettings }));
  };

  const getLocationTypeIcon = (type: LocationFilter['type']) => {
    switch (type) {
      case 'city': return '🏙️';
      case 'county': return '🏞️';
      case 'zipcode': return '📮';
      case 'area': return '📍';
      default: return '📍';
    }
  };

  const getLocationTypeColor = (type: LocationFilter['type']) => {
    switch (type) {
      case 'city': return 'bg-blue-100 text-blue-700';
      case 'county': return 'bg-green-100 text-green-700';
      case 'zipcode': return 'bg-purple-100 text-purple-700';
      case 'area': return 'bg-orange-100 text-orange-700';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-4"> 
              <Icons.Bot className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-cinzel text-2xl font-bold text-neutral-900">
                Automated Content Generation
              </h2>
              <p className="font-lora text-neutral-600">
                AI-powered blog posts from Google Business reviews
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-sm font-poppins font-semibold ${
              status.isRunning 
                ? 'bg-green-100 text-green-700' 
                : 'bg-neutral-100 text-neutral-700'
            }`}>
              {status.isRunning ? 'Active' : 'Inactive'}
            </div>
            
            <button 
              onClick={toggleAutomation}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                status.isRunning
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              {status.isRunning ? <Icons.Pause className="h-5 w-5" /> : <Icons.Play className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-lora text-sm text-blue-600">Daily Target</p>
                <p className="font-poppins text-xl font-bold text-blue-900">
                  {settings.dailyPostCount}
                </p>
              </div>
              <Icons.FileText className="h-6 w-6 text-blue-500" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-lora text-sm text-green-600">Generated Today</p>
                <p className="font-poppins text-xl font-bold text-green-900">
                  {status.postsGenerated}
                </p>
              </div>
              <Icons.CheckCircle className="h-6 w-6 text-green-500" />
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-lora text-sm text-purple-600">Active Locations</p>
                <p className="font-poppins text-xl font-bold text-purple-900">
                  {locationFilters.length}
                </p>
              </div>
              <Icons.MapPin className="h-6 w-6 text-purple-500" />
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-lora text-sm text-orange-600">Next Run</p>
                <p className="font-poppins text-xs font-semibold text-orange-900">
                  {status.nextRun 
                    ? new Date(status.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Not scheduled'
                  }
                </p>
              </div>
              <Icons.Clock className="h-6 w-6 text-orange-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Location Filtering Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 flex items-center">
            <Icons.MapPin className="h-4 w-4 mr-2 text-primary-500" />
            Location Filters
          </h3>
          <button
            onClick={() => setShowAddLocation(true)}
            className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 flex items-center"
          >
            <Icons.Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        </div>

        <p className="font-lora text-neutral-600 mb-4">
          Configure which geographic areas to pull reviews from. The AI will focus on businesses in these locations.
        </p>

        {/* Current Location Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {locationFilters.map((filter) => (
            <div
              key={filter.id}
              className={`${getLocationTypeColor(filter.type)} rounded-lg p-3 flex items-center justify-between`}
            >
              <div className="flex items-center">
                <span className="text-lg mr-2">{getLocationTypeIcon(filter.type)}</span>
                <div>
                  <div className="font-poppins text-sm font-semibold">
                    {filter.displayName}
                  </div>
                  <div className="font-lora text-xs opacity-75 capitalize">
                    {filter.type}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveLocation(filter.id)}
                className="p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors duration-200"
              >
                <Icons.X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {locationFilters.length === 0 && (
          <div className="text-center py-8 bg-neutral-50 rounded-lg">
            <Icons.MapPin className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
            <p className="font-lora text-neutral-600">
              No location filters set. Add locations to focus content generation on specific areas.
            </p>
          </div>
        )}

        {/* Add Location Form */}
        {showAddLocation && (
          <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
            <h4 className="font-poppins font-semibold text-neutral-900 mb-4">Add New Location Filter</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="font-lora text-sm text-neutral-700 block mb-2">
                  Location Type
                </label>
                <select
                  value={newLocation.type}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, type: e.target.value as LocationFilter['type'] }))}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="city">City</option>
                  <option value="county">County</option>
                  <option value="zipcode">ZIP Code</option>
                  <option value="area">Area/Region</option>
                </select>
              </div>
              
              <div>
                <label className="font-lora text-sm text-neutral-700 block mb-2">
                  Location Value
                </label>
                <input
                  type="text"
                  value={newLocation.value}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="e.g., Seattle, 90210, King County"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="font-lora text-sm text-neutral-700 block mb-2">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={newLocation.displayName}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g., Seattle, WA"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleAddLocation}
                disabled={!newLocation.value.trim()}
                className="font-poppins bg-primary-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Location
              </button>
              <button
                onClick={() => {
                  setShowAddLocation(false);
                  setNewLocation({ type: 'city', value: '', displayName: '' });
                }}
                className="font-poppins border border-neutral-200 text-neutral-700 px-4 py-2 rounded-lg font-semibold hover:bg-neutral-50 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Controls */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <Icons.Zap className="h-4 w-4 mr-2 text-yellow-500" />
            Manual Generation
          </h3>
          
          <p className="font-lora text-neutral-600 mb-4">
            Generate content immediately from {locationFilters.length} configured location(s).
          </p>
          
          <button
            onClick={handleManualGeneration}
            disabled={isGenerating || locationFilters.length === 0}
            className={`w-full font-poppins py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center ${
              isGenerating || locationFilters.length === 0
                ? 'bg-neutral-300 text-neutral-600 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {isGenerating ? (
              <>
                <Icons.RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Generating Content...
              </>
            ) : (
              <>
                <Icons.Play className="h-5 w-5 mr-2" />
                Generate Now
              </>
            )}
          </button>
          
          {locationFilters.length === 0 && (
            <p className="font-lora text-xs text-red-600 mt-2 text-center">
              Add at least one location filter to generate content
            </p>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
          <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <Icons.Settings className="h-4 w-4 mr-2 text-neutral-600" />
            Generation Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="font-lora text-sm text-neutral-700 block mb-2">
                Daily Post Count
              </label>
              <input
                type="number"
                value={settings.dailyPostCount}
                onChange={(e) => updateSettings({ dailyPostCount: parseInt(e.target.value) })}
                min="1"
                max="50"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="font-lora text-sm text-neutral-700 block mb-2">
                Publish Time
              </label>
              <input
                type="time"
                value={settings.publishTime}
                onChange={(e) => updateSettings({ publishTime: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg font-lora focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-lora text-sm text-neutral-700">Auto Publish</span>
              <button
                onClick={() => updateSettings({ autoPublish: !settings.autoPublish })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.autoPublish ? 'bg-primary-500' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.autoPublish ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-neutral-200">
        <h3 className="font-poppins text-lg font-semibold text-neutral-900 mb-4">
          Recent Generated Posts
        </h3>
        
        {recentPosts.length === 0 ? (
          <div className="text-center py-8">
            <Icons.FileText className="h-10 w-10 text-neutral-300 mx-auto mb-4" />
            <p className="font-lora text-neutral-600">
              No posts generated yet. Run the generator to see results here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPosts.slice(0, 10).map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg"
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    post.status === 'published' 
                      ? 'bg-green-100' 
                      : post.status === 'failed' 
                      ? 'bg-red-100' 
                      : 'bg-yellow-100'
                  }`}>
                    {post.status === 'published' ? (
                      <Icons.CheckCircle className="h-4 w-4 text-green-600" />
                    ) : post.status === 'failed' ? (
                      <Icons.XCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <Icons.Clock className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  
                  <div>
                    <h4 className="font-poppins font-semibold text-neutral-900">
                      {post.businessName}
                    </h4>
                    <p className="font-lora text-sm text-neutral-600">
                      {new Date(post.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-poppins text-primary-500 hover:text-primary-600 text-sm font-semibold"
                  >
                    View Post →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomatedContentManager;