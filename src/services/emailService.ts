// Email service for PDF delivery
export class EmailService {
  // ConvertKit integration
  static async sendToConvertKit(email: string, pdfData: {
    pdfUrl: string;
    pdfTitle: string;
    leadMagnet: string;
  }) {
    const CONVERTKIT_API_KEY = import.meta.env.VITE_CONVERTKIT_API_KEY;
    const CONVERTKIT_FORM_ID = import.meta.env.VITE_CONVERTKIT_FORM_ID;

    try {
      const response = await fetch(`https://api.convertkit.com/v3/forms/${CONVERTKIT_FORM_ID}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: CONVERTKIT_API_KEY,
          email: email,
          tags: ['clean-eats-guide', 'pdf-download'],
          fields: {
            pdf_title: pdfData.pdfTitle,
            lead_magnet: pdfData.leadMagnet,
            download_url: pdfData.pdfUrl
          }
        }),
      });

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Mailchimp integration
  static async sendToMailchimp(email: string, pdfData: {
    pdfUrl: string;
    pdfTitle: string;
    leadMagnet: string;
  }) {
    const MAILCHIMP_API_KEY = import.meta.env.VITE_MAILCHIMP_API_KEY;
    const MAILCHIMP_LIST_ID = import.meta.env.VITE_MAILCHIMP_LIST_ID;
    const MAILCHIMP_SERVER = import.meta.env.VITE_MAILCHIMP_SERVER; // e.g., 'us1'

    try {
      const response = await fetch(`https://${MAILCHIMP_SERVER}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAILCHIMP_API_KEY}`,
        },
        body: JSON.stringify({
          email_address: email,
          status: 'subscribed',
          tags: ['clean-eats-guide', 'pdf-download'],
          merge_fields: {
            PDF_TITLE: pdfData.pdfTitle,
            LEAD_MAGNET: pdfData.leadMagnet,
            DOWNLOAD_URL: pdfData.pdfUrl
          }
        }),
      });

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  // Generic webhook for other services
  static async sendToWebhook(email: string, pdfData: {
    pdfUrl: string;
    pdfTitle: string;
    leadMagnet: string;
  }) {
    const WEBHOOK_URL = import.meta.env.VITE_EMAIL_WEBHOOK_URL;

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          ...pdfData,
          timestamp: new Date().toISOString(),
          source: 'verified-and-reviewed'
        }),
      });

      return await response.json();
    } catch (error) {
      throw error;
    }
  }
}