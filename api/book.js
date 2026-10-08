const { IncomingForm } = require('formidable');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const fs = require('fs');

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing so formidable can read the stream
  },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const data = await new Promise((resolve, reject) => {
            const form = new IncomingForm();
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        const fields = data.fields;
        const files = data.files;

        // formidable v3 returns fields as arrays
        const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
        const phone = Array.isArray(fields.phone) ? fields.phone[0] : fields.phone;
        const service = Array.isArray(fields.service) ? fields.service[0] : fields.service;
        const date = Array.isArray(fields.date) ? fields.date[0] : fields.date;
        const time = Array.isArray(fields.time) ? fields.time[0] : fields.time;
        const length = Array.isArray(fields.length) ? fields.length[0] : fields.length;
        const shape = Array.isArray(fields.shape) ? fields.shape[0] : fields.shape;
        const design = Array.isArray(fields.design) ? fields.design[0] : fields.design;
        
        let file = null;
        if (files.inspiration) {
            file = Array.isArray(files.inspiration) ? files.inspiration[0] : files.inspiration;
        }

        // 1. Send Email Notification
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        let attachments = [];
        if (file && file.filepath) {
            const fileContent = fs.readFileSync(file.filepath);
            attachments.push({
                filename: file.originalFilename || 'inspiration.jpg',
                content: fileContent
            });
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // sending email to yourself
            subject: `New Appointment Request from ${name}`,
            text: `
You have a new appointment request!

Name: ${name}
Phone: ${phone}
Service: ${service}
Date: ${date}
Time: ${time}
Length: ${length || 'Not specified'}
Shape: ${shape || 'Not specified'}
Design: ${design || 'None'}
            `,
            attachments: attachments
        };

        await transporter.sendMail(mailOptions);

        // 2. Send SMS to the user via Twilio
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            
            let formattedPhone = phone.replace(/\D/g, '');
            if (formattedPhone.length === 10) formattedPhone = '+1' + formattedPhone;
            else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) formattedPhone = '+' + formattedPhone;

            await twilioClient.messages.create({
                body: `Hi ${name}, this is Nails by Anvi! We've received your appointment request for ${service} on ${date} at ${time}. We will reach out soon to confirm!`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedPhone
            });
        }

        res.status(200).json({ message: 'Appointment requested successfully!' });

    } catch (error) {
        console.error('Error processing booking:', error);
        res.status(500).json({ error: 'There was an error processing your request. Please try again later.' });
    }
}
