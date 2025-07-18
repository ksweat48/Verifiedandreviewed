// Updated Google Business Profile API integration
import { GoogleAuth } from "google-auth-library";

export const handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { locationId, accountId } = event.queryStringParameters || {};

    if (!locationId || !accountId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          error: "Missing locationId or accountId parameters",
          usage:
            "Add ?accountId=YOUR_ACCOUNT_ID&locationId=YOUR_LOCATION_ID to the URL",
        }),
      };
    }

    // Check if required environment variables are present
    const requiredEnvVars = [
      "GOOGLE_PROJECT_ID",
      "GOOGLE_PRIVATE_KEY_ID",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_CLIENT_EMAIL",
      "GOOGLE_CLIENT_ID",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingVars.length > 0) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          error: "Missing required environment variables",
          missingVariables: missingVars,
          message: `Please set these environment variables in your Netlify dashboard: ${missingVars.join(
            ", "
          )}`,
          instructions: {
            step1: "Go to your Netlify dashboard",
            step2: "Navigate to Site settings → Environment variables",
            step3: "Add the missing Google Cloud service account variables",
            step4: "Redeploy your site for changes to take effect",
          },
        }),
      };
    }

    // Enhanced private key cleaning and formatting
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      console.log("🔧 Processing private key...");

      // Remove any surrounding quotes
      privateKey = privateKey.replace(/^["']|["']$/g, "");

      // Handle different newline formats
      privateKey = privateKey.replace(/\\n/g, "\n");
      privateKey = privateKey.replace(/\\\\/g, "\\");

      // Ensure proper line breaks around the key markers
      privateKey = privateKey.replace(
        /-----BEGIN PRIVATE KEY-----\s*/g,
        "-----BEGIN PRIVATE KEY-----\n"
      );
      privateKey = privateKey.replace(
        /\s*-----END PRIVATE KEY-----/g,
        "\n-----END PRIVATE KEY-----"
      );

      // Remove any extra whitespace but preserve necessary line breaks
      privateKey = privateKey.replace(/\n\s+/g, "\n");
      privateKey = privateKey.replace(/\s+\n/g, "\n");

      // Validate the key format
      if (
        !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
        !privateKey.includes("-----END PRIVATE KEY-----")
      ) {
        throw new Error(
          "Invalid private key format. Must contain BEGIN and END markers."
        );
      }

      console.log("✅ Private key formatted successfully");
    }

    console.log("🔐 Initializing Google Auth...");
    console.log("📧 Service account email:", process.env.GOOGLE_CLIENT_EMAIL);
    console.log("🆔 Project ID:", process.env.GOOGLE_PROJECT_ID);

    // Initialize Google Auth with enhanced error handling
    const auth = new GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: privateKey,
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
          process.env.GOOGLE_CLIENT_EMAIL
        )}`,
      },
      // Updated scopes for the new API
      scopes: [
        "https://www.googleapis.com/auth/business.manage",
        "https://www.googleapis.com/auth/businessprofileapi",
      ],
    });

    console.log("🔑 Getting auth client...");
    const authClient = await auth.getClient();
    console.log("✅ Auth client obtained successfully");

    console.log("📡 Making API request...");

    // UPDATED: Use the new Google Business Profile API endpoint
    // Note: The new API uses a different structure
    const locationName = `accounts/${accountId}/locations/${locationId}`;

    const response = await authClient.request({
      url: `https://businessprofileapi.googleapis.com/v1/${locationName}/reviews`,
      method: "GET",
    });

    console.log("✅ API request successful");
    const reviews = response.data.reviews || [];

    // Transform reviews to our format
    const formattedReviews = reviews.map((review) => ({
      reviewId: review.name ? review.name.split("/").pop() : "unknown",
      reviewer: {
        displayName: review.reviewer?.displayName || "Anonymous",
        profilePhotoUrl: review.reviewer?.profilePhotoUrl,
      },
      starRating: review.starRating || 5,
      comment: review.comment || "",
      createTime: review.createTime,
      updateTime: review.updateTime,
      reviewReply: review.reviewReply,
      name: review.name,
    }));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        reviews: formattedReviews,
        total: formattedReviews.length,
        accountId: accountId,
        locationId: locationId,
        apiVersion: "Business Profile API v1",
      }),
    };
  } catch (error) {
    console.error("🚨 Google Reviews API Error:", error);

    // Enhanced error handling with specific solutions
    let errorMessage = error.message;
    let troubleshooting = [];
    let solution = "";

    if (
      error.message.includes("API has not been used") ||
      error.message.includes("disabled")
    ) {
      errorMessage = "Google Business Profile API not enabled";
      solution =
        "You need to enable the Google Business Profile API in your Google Cloud Console.";
      troubleshooting = [
        "1. Go to Google Cloud Console → APIs & Services → Library",
        '2. Search for "Google Business Profile API"',
        '3. Click on it and press "Enable"',
        '4. Also enable "My Business API" for legacy support',
        "5. Wait 2-3 minutes for propagation",
        "6. Try your request again",
      ];
    } else if (
      error.message.includes("1E08010C") ||
      error.message.includes("DECODER")
    ) {
      errorMessage = "Private Key Format Error";
      solution =
        "The private key from your Google Cloud service account JSON is not properly formatted.";
      troubleshooting = [
        "1. Go to Google Cloud Console → IAM & Admin → Service Accounts",
        '2. Find your service account and click "Manage Keys"',
        "3. Create a new JSON key (delete the old one)",
        "4. Open the downloaded JSON file",
        '5. Copy the ENTIRE "private_key" value (including quotes)',
        "6. In Netlify, set GOOGLE_PRIVATE_KEY to this exact value",
        "7. Make sure to include the quotes and \\n characters as-is",
        "8. Redeploy your site",
      ];
    } else if (error.message.includes("invalid_grant")) {
      errorMessage = "Invalid service account credentials";
      solution = "The service account credentials are incorrect or expired.";
      troubleshooting = [
        "Verify the service account email is correct",
        "Check that the private key matches the service account",
        "Ensure the service account has the correct permissions",
        "Try regenerating the service account key",
      ];
    } else if (error.message.includes("403")) {
      errorMessage = "Access denied - insufficient permissions";
      solution =
        "The service account needs to be added as a manager to your Google Business Profile.";
      troubleshooting = [
        "Go to https://business.google.com",
        "Select your business",
        "Go to Settings → Business Profile settings → Managers",
        `Add this email as a manager: ${process.env.GOOGLE_CLIENT_EMAIL}`,
        "Wait a few minutes and try again",
      ];
    }

    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: false,
        error: "Failed to fetch Google reviews",
        message: errorMessage,
        solution: solution,
        troubleshooting: troubleshooting,
        originalError: error.message,
        // Return mock data for development
        reviews: [
          {
            reviewId: "mock-1",
            reviewer: { displayName: "Sarah Johnson" },
            starRating: 5,
            comment:
              "Amazing fresh ingredients and spotless facilities. The quinoa bowl was perfect and the staff was incredibly knowledgeable about allergens.",
            createTime: new Date().toISOString(),
            businessName: "Green Garden Cafe",
            location: "Downtown Seattle",
            category: "Healthy Restaurant",
          },
          {
            reviewId: "mock-2",
            reviewer: { displayName: "Mike Chen" },
            starRating: 4,
            comment:
              "Great selection of organic produce and local products. Clean, well-organized store with helpful staff.",
            createTime: new Date().toISOString(),
            businessName: "Fresh Market Co-op",
            location: "Portland, OR",
            category: "Retail & Grocery",
          },
        ],
        note: "This is mock data because the Google API call failed. Follow the troubleshooting steps above to fix the issue.",
      }),
    };
  }
};
