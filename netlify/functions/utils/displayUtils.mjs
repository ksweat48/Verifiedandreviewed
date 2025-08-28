// Display utilities for Netlify functions
// This is a Node.js compatible version of the frontend displayUtils

// Helper function to determine if business is currently open
export const isBusinessOpen = (business) => {
  if (!business.hours) return false;
  
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute; // Convert to minutes
  
  // Check if today is a closed day
  if (business.days_closed) {
    const closedDays = business.days_closed.toLowerCase();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[currentDay];
    
    if (closedDays.includes(todayName) || closedDays.includes('daily')) {
      return false;
    }
  }
  
  // Parse business hours (simplified parsing for common formats)
  const hours = business.hours.toLowerCase();
  
  // Handle "24/7" or "24 hours"
  if (hours.includes('24') && (hours.includes('7') || hours.includes('hour'))) {
    return true;
  }
  
  // Handle "closed" status
  if (hours.includes('closed')) {
    return false;
  }
  
  // Try to parse time ranges like "9AM - 5PM" or "Monday - Friday 9AM - 5PM"
  const timeMatch = hours.match(/(\d{1,2}):?(\d{0,2})\s*(am|pm)?\s*-\s*(\d{1,2}):?(\d{0,2})\s*(am|pm)/i);
  
  if (timeMatch) {
    const [, startHour, startMin = '0', startPeriod, endHour, endMin = '0', endPeriod] = timeMatch;
    
    // Convert to 24-hour format
    let openHour = parseInt(startHour);
    let closeHour = parseInt(endHour);
    
    if (startPeriod && startPeriod.toLowerCase() === 'pm' && openHour !== 12) {
      openHour += 12;
    }
    if (startPeriod && startPeriod.toLowerCase() === 'am' && openHour === 12) {
      openHour = 0;
    }
    
    if (endPeriod && endPeriod.toLowerCase() === 'pm' && closeHour !== 12) {
      closeHour += 12;
    }
    if (endPeriod && endPeriod.toLowerCase() === 'am' && closeHour === 12) {
      closeHour = 0;
    }
    
    const openTime = openHour * 60 + parseInt(startMin);
    const closeTime = closeHour * 60 + parseInt(endMin);
    
    // Handle overnight hours (e.g., 10PM - 2AM)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    } else {
      return currentTime >= openTime && currentTime <= closeTime;
    }
  }
  
  // Default to closed if we can't parse the hours
  return false;
};