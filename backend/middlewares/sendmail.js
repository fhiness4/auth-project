const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
    service: 'gmail',
    auth:{
        user: process.env.node_code_sending_address,
        pass:process.env.node_code_sending
    }
})

module.exports = {transport}