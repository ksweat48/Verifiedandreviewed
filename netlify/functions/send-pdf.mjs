// Netlify Function for PDF delivery
import sgMail from '@sendgrid/mail';

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, pdfUrl, pdfTitle, leadMagnet } = JSON.parse(event.body);

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // Set up SendGrid
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: {
          email: 'hello@verifiedandreviewed.com',
          name: 'Verified & Reviewed'
        },
        subject: `Your ${pdfTitle} is ready for download! 📋`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your ${pdfTitle} is Ready!</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #f76c5e 0%, #7b449b 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Your ${pdfTitle} is Ready!</h1>
                <p style="color: white; margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Thank you for joining Verified & Reviewed</p>
              </div>

              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">
                  Welcome to the Verified & Reviewed community! Your comprehensive guide to clean eating is ready for download.
                </p>

                <!-- Download Button -->
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${pdfUrl}" style="display: inline-block; background-color: #f76c5e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    📥 Download Your Guide Now
                  </a>
                </div>

                <!-- What's Included -->
                <div style="background-color: #f8f9fa; padding: 25px; border-radius: 10px; margin: 25px 0; border-left: 4px solid #f76c5e;">
                  <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">What's included in your guide:</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                    <li>✅ Top 50 verified clean restaurants</li>
                    <li>✅ Health score database and ratings</li>
                    <li>✅ Printable checklists for dining out</li>
                    <li>✅ Exclusive photos and detailed reviews</li>
                    <li>✅ Travel-friendly mobile format</li>
                  </ul>
                </div>

                <!-- Next Steps -->
                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 25px 0;">
                  <h4 style="color: #2d5a2d; margin: 0 0 10px 0;">What's next?</h4>
                  <p style="color: #2d5a2d; margin: 0; font-size: 14px; line-height: 1.6;">
                    You'll receive our weekly newsletter every Sunday with new reviews, exclusive content, and insider tips for finding the cleanest restaurants and services.
                  </p>
                </div>

                <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 25px;">
                  Happy dining and safe travels!<br>
                  <strong>The Verified & Reviewed Team</strong>
                </p>
              </div>

              <!-- Footer -->
              <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="margin: 0; font-size: 12px; color: #666;">
                  You're receiving this because you downloaded our Clean Eats Guide.<br>
                  <a href="#" style="color: #f76c5e; text-decoration: none;">Unsubscribe</a> | 
                  <a href="https://verifiedandreviewed.com" style="color: #f76c5e; text-decoration: none;">Visit our website</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await sgMail.send(msg);
    }

    // Also add to ConvertKit for newsletter
    if (process.env.CONVERTKIT_API_KEY) {
      await fetch(`https://api.convertkit.com/v3/forms/${process.env.CONVERTKIT_FORM_ID}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.CONVERTKIT_API_KEY,
          email: email,
          tags: ['clean-eats-guide', 'pdf-download'],
          fields: {
            pdf_title: pdfTitle,
            lead_magnet: leadMagnet
          }
        }),
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'PDF sent successfully' 
      })
    };

  } catch (error) {
    console.error('Error sending PDF:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify({ 
        error: 'Failed to send PDF',
        message: error.message 
      })
    };
  }
};