// ============================================================
//  STK PUSH FUNCTION - Netlify Serverless
// ============================================================
const axios = require('axios');

// ============================================================
//  CONFIGURATION - Environment Variables
// ============================================================
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const PASSKEY = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const ENVIRONMENT = process.env.MPESA_ENVIRONMENT || 'sandbox';
const BASE_URL = ENVIRONMENT === 'sandbox' 
  ? 'https://sandbox.safaricom.co.ke' 
  : 'https://api.safaricom.co.ke';

// ============================================================
//  GET ACCESS TOKEN
// ============================================================
async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Token generation error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with M-PESA');
  }
}

// ============================================================
//  INITIATE STK PUSH
// ============================================================
async function initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc, callbackUrl) {
  const token = await getAccessToken();
  
  // Format phone number (remove 0 or + if present)
  let phone = phoneNumber.replace(/^0+/, '').replace(/^\+/, '');
  if (!phone.startsWith('254')) {
    phone = '254' + phone;
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

  const requestData = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(amount),
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference || 'SPONSORSHIP',
    TransactionDesc: transactionDesc || 'Registration Fee'
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.ResponseCode === '0') {
      return {
        success: true,
        message: 'STK Push sent successfully',
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID,
        responseCode: response.data.ResponseCode
      };
    } else {
      throw new Error(response.data.ResponseDescription || 'STK Push initiation failed');
    }
  } catch (error) {
    console.error('STK Push API error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.errorMessage || error.response?.data?.ResponseDescription || 'Failed to initiate payment');
  }
}

// ============================================================
//  NETLIFY FUNCTION HANDLER
// ============================================================
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { phoneNumber, amount, accountReference, transactionDesc } = JSON.parse(event.body);

    // Validate inputs
    if (!phoneNumber || !amount) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Phone number and amount are required' 
        })
      };
    }

    // Get callback URL from environment or use default
    const callbackUrl = process.env.MPESA_CALLBACK_URL || 
      `${process.env.URL || 'https://your-site.netlify.app'}/.netlify/functions/stk-callback`;

    // Initiate STK Push
    const result = await initiateSTKPush(
      phoneNumber,
      amount,
      accountReference || 'SPONSORSHIP',
      transactionDesc || 'Registration Fee',
      callbackUrl
    );

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('STK Push handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Payment processing failed' 
      })
    };
  }
};
