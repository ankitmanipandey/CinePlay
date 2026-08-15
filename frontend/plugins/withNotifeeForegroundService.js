const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNotifeeForegroundService(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;
        const app = androidManifest.manifest.application[0];

        if (!app.service) {
            app.service = [];
        }

        const serviceName = 'app.notifee.core.ForegroundService';

        // Find the Notifee service if it already exists
        let notifeeService = app.service.find(
            (s) => s.$['android:name'] === serviceName
        );

        // If it doesn't exist, create it
        if (!notifeeService) {
            notifeeService = {
                $: {
                    'android:name': serviceName,
                }
            };
            app.service.push(notifeeService);
        }

        // Explicitly add the dataSync foreground service type
        notifeeService.$['android:foregroundServiceType'] = 'dataSync';

        return config;
    });
};