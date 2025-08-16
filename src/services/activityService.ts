// Activity Service for tracking user interactions
export interface ActivityEvent {
  userId: string;
  eventType: 'page_view' | 'login' | 'search' | 'review_submit' | 'business_view' | 'signup' | 'logout';
  eventDetails?: {
    page_path?: string;
    search_query?: string;
    business_id?: string;
    business_name?: string;
    search_type?: 'platform' | 'ai' | 'semantic';
    [key: string]: any;
  };
}

export class ActivityService {
  private static isEnabled = true;
  private static queue: ActivityEvent[] = [];
  private static isProcessing = false;

  // Log an activity event
  static async logActivity(event: ActivityEvent): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      // Add to queue for batch processing
      this.queue.push(event);
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }

      return true;
    } catch (error) {
      console.error('Error queueing activity:', error);
      return false;
    }
  }

  // Process the activity queue
  private static async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    try {
      // Process events in batches
      while (this.queue.length > 0) {
        const event = this.queue.shift();
        if (event) {
          await this.sendActivity(event);
        }
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error processing activity queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Send activity to the Netlify function
  private static async sendActivity(event: ActivityEvent): Promise<void> {
    try {
      const response = await fetch('/.netlify/functions/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: event.userId,
          eventType: event.eventType,
          eventDetails: event.eventDetails
        })
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          console.error('Activity logging failed:', errorData);
        } catch {
          // If JSON parsing fails, the response is likely not JSON
          console.error('Activity logging failed with non-JSON response');
        }
      }
    } catch (error) {
      console.error('Error sending activity:', error);
    }
  }

  // Convenience methods for common activities
  static logPageView(userId: string, pagePath: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'page_view',
      eventDetails: { page_path: pagePath }
    });
  }

  static logLogin(userId: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'login'
    });
  }

  static logSignup(userId: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'signup'
    });
  }

  static logLogout(userId: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'logout'
    });
  }

  static logSearch(userId: string, searchQuery: string, searchType: 'platform' | 'ai' | 'semantic'): Promise<boolean> {
  }
  static logSearch(userId: string, searchQuery: string, searchType: 'platform' | 'ai' | 'semantic' | 'unified' | 'intelligent'): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'search',
      eventDetails: { 
        search_query: searchQuery,
        search_type: searchType
      }
    });
  }

  static logBusinessView(userId: string, businessId: string, businessName: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'business_view',
      eventDetails: { 
        business_id: businessId,
        business_name: businessName
      }
    });
  }

  static logReviewSubmit(userId: string, businessId: string, businessName: string): Promise<boolean> {
    return this.logActivity({
      userId,
      eventType: 'review_submit',
      eventDetails: { 
        business_id: businessId,
        business_name: businessName
      }
    });
  }

  // Disable activity tracking (for testing or privacy)
  static disable(): void {
    this.isEnabled = false;
  }

  // Enable activity tracking
  static enable(): void {
    this.isEnabled = true;
  }
}