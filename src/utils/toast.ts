// Global toast utility for easy access from any component
export const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  const event = new CustomEvent('show-toast', { detail: { message, type } });
  document.dispatchEvent(event);
};

export const showSuccess = (message: string) => showToast(message, 'success');
export const showError = (message: string) => showToast(message, 'error');
export const showWarning = (message: string) => showToast(message, 'warning');
export const showInfo = (message: string) => showToast(message, 'info');