const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Set to true if using SSL/TLS
    auth: {
        user: '17yashvarshney@gmail.com',
        pass: 'fcI5rm6Gk02aZ3dB',
    },
});

module.exports = transporter;