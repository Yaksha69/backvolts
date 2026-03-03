const sendSms = async (req, res) => {
    console.log('📱 POST /api/v1/sms/send - Request received');
    console.log('📱 Body:', req.body);
    
    const { phone_number, message } = req.body;
    const apiToken = process.env.SMS_API_TOKEN;

    if (!apiToken) {
        console.error('❌ SMS_API_TOKEN not configured in backend');
        return res.status(500).json({ 
            error: 'SMS service not configured on server' 
        });
    }

    if (!phone_number || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: phone_number, message' 
        });
    }

    try {
        const phoneNumbers = phone_number.split(',').map(num => num.trim());
        const encodedPhoneNumbers = phoneNumbers.join('%2C');
        
        const smsUrl = `https://www.iprogsms.com/api/v1/sms_messages/send_bulk?api_token=${apiToken}&message=${encodeURIComponent(message)}&phone_number=${encodedPhoneNumbers}`;
        
        console.log('📱 Sending SMS to:', phoneNumbers);
        console.log('📱 Message:', message);
        
        const response = await fetch(smsUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_token: apiToken,
                phone_number: phone_number,
                message: message
            })
        });

        console.log('📱 SMS API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ SMS sending failed:', response.status, response.statusText, errorText);
            return res.status(response.status).json({ 
                error: 'SMS sending failed',
                details: response.statusText 
            });
        }

        const result = await response.json();
        console.log('✅ SMS sent successfully:', result);
        
        res.status(200).json({ 
            success: true,
            message: 'SMS sent successfully',
            recipients: phoneNumbers.length,
            details: result
        });

    } catch (error) {
        console.error('❌ Error sending SMS:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
};

module.exports = {
    sendSms
};
