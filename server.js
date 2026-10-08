require('dotenv').config();
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to serve your static files (index.html, style.css, images)
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up Multer for file uploads (storing in memory so we can attach to email)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// The endpoint that handles the form submission
app.post('/api/book', upload.single('inspiration'), async (req, res) => {
    try {
        const { name, phone, service, date, time, length, shape, design } = req.body;
        const file = req.file;

        // 1. Send Email Notification
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, // e.g., akula.anvitha16@gmail.com
                pass: process.env.EMAIL_PASS  // App password from Google
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: 'akula.anvitha16@gmail.com', // Sending email to you
            subject: `New Appointment Request from ${name}`,
            text: `
You have a new appointment request!

Name: ${name}
Phone: ${phone}
Service: ${service}
Date: ${date}
Time: ${time}
Length: ${length}
Shape: ${shape}
Design: ${design}
            `,
            attachments: file ? [
                {
                    filename: file.originalname,
                    content: file.buffer
                }
            ] : []
        };

        await transporter.sendMail(mailOptions);

        // 2. Send SMS to the user via Twilio
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            
            // Format phone number (Twilio requires E.164 format, e.g., +14705056761)
            // Note: In a real app, you might want to validate/format the phone number robustly
            let formattedPhone = phone.replace(/\D/g, '');
            if (formattedPhone.length === 10) {
                formattedPhone = '+1' + formattedPhone;
            } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
                formattedPhone = '+' + formattedPhone;
            }

            await twilioClient.messages.create({
                body: `Hi ${name}, this is Nails by Anvi! We've received your appointment request for ${service} on ${date} at ${time}. We will reach out soon to confirm!`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedPhone
            });
        }

        // Send JSON response for AJAX
        res.status(200).json({ message: 'Appointment requested successfully!' });

    } catch (error) {
        console.error('Error processing booking:', error);
        res.status(500).json({ error: 'There was an error processing your request. Please try again later.' });
    }
});

app.listen(port, () => {
    console.log(\`Server running at http://localhost:\${port}\`);
});
