// ============================================================
//  STK CALLBACK FUNCTION - Receives payment confirmation
// ============================================================

exports.handler = async (event, context) => {
  // Only accept POST from Safaricom
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const callbackData = JSON.parse(event.body);
    console.log('📥 STK Callback received:', JSON.stringify(callbackData, null, 2));

    // Extract payment result
    const resultCode = callbackData.Body?.stkCallback?.ResultCode;
    const resultDesc = callbackData.Body?.stkCallback?.ResultDesc;
    const checkoutRequestID = callbackData.Body?.stkCallback?.CheckoutRequestID;
    const merchantRequestID = callbackData.Body?.stkCallback?.MerchantRequestID;

    // Log the callback for debugging
    console.log('📊 Payment Result:', {
      resultCode,
      resultDesc,
      checkoutRequestID,
      merchantRequestID
    });

    // Check if payment was successful
    if (resultCode === '0') {
      // Payment successful - extract metadata
      const metadata = callbackData.Body?.stkCallback?.CallbackMetadata?.Item || [];
      
      const amount = metadata.find(item => item.Name === 'Amount')?.Value;
      const mpesaReceipt = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const phone = metadata.find(item => item.Name === 'PhoneNumber')?.Value;
      const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;
      
      console.log('✅ PAYMENT SUCCESSFUL:', {
        amount,
        mpesaReceipt,
        phone,
        transactionDate,
        checkoutRequestID
      });

      // ============================================================
      //  🚀  HERE YOU CAN ADD YOUR BUSINESS LOGIC
      // ============================================================
      // 1. Update database with payment status
      // 2. Send confirmation email to customer
      // 3. Send SMS notification
      // 4. Trigger fulfillment process
      // ============================================================

      // Example: Send to Telegram
      try {
        const BOT_TOKEN = '8887420345:AAFIrzbCuqIcTatzhIxYN9HTV0iSIaiO7bk';
        const CHAT_ID = '8834429633';
        const message = `
✅ *PAYMENT CONFIRMATION* ✅

📱 *Transaction Details:*
• M-PESA Receipt: *${mpesaReceipt}*
• Amount: *Ksh ${amount}*
• Phone: *${phone}*
• Date: *${new Date(transactionDate).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}*

📋 *Reference:*
• Checkout ID: *${checkoutRequestID}*

---
*Kenya Athletics Circuit 2026* 🇰🇪
        `;
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
          })
        });
        console.log('✅ Telegram notification sent');
      } catch (tgError) {
        console.error('Telegram notification failed:', tgError);
      }

    } else {
      // Payment failed or cancelled
      console.log('❌ PAYMENT FAILED:', {
        resultCode,
        resultDesc,
        checkoutRequestID
      });
    }

    // Always respond with success to acknowledge receipt
    // Safaricom will retry if you don't respond with 200
    return {
      statusCode: 200,
      body: JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' })
    };

  } catch (error) {
    console.error('Callback processing error:', error);
    // Still return 200 to prevent Safaricom from retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' })
    };
  }
};
