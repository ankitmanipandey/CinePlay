const cron = require('node-cron');
const https = require('https');
const SERVER_URL = process.env.SERVER_URL;

const serverAwake = () => {
    cron.schedule('*/14 * * * *', () => {
        console.log(`[Keep-Awake] Pinging ${SERVER_URL} to prevent sleep...`);

        https.get(process.env.SERVER_URL, (res) => {
            if (res.statusCode === 200) {
                console.log(`[Keep-Awake] Success. Status Code: ${res.statusCode}`);
            } else {
                console.log(`[Keep-Awake] Ping failed with Status Code: ${res.statusCode}`);
            }
        }).on('error', (err) => {
            console.error(`[Keep-Awake] Error pinging server: ${err.message}`);
        });
    });
}

module.exports = serverAwake 