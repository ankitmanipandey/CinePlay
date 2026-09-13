const { withAndroidManifest, withProjectBuildGradle } = require('@expo/config-plugins');

function withNotifeeManifest(config) {
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
}

function withNotifeeMavenRepo(config) {
    return withProjectBuildGradle(config, (config) => {
        const repoLine = 'maven { url("$rootDir/../node_modules/@notifee/react-native/android/libs") }';

        if (config.modResults.language === 'groovy') {
            if (!config.modResults.contents.includes('@notifee/react-native/android/libs')) {
                // Insert into the allprojects { repositories { ... } } block
                config.modResults.contents = config.modResults.contents.replace(
                    /allprojects\s*{\s*repositories\s*{/,
                    (match) => `${match}\n        ${repoLine}`
                );
            }
        } else {
            throw new Error(
                'withNotifeeMavenRepo: Cannot add Notifee maven repo — project build.gradle is not in Groovy format.'
            );
        }

        return config;
    });
}

module.exports = function withNotifeeForegroundService(config) {
    config = withNotifeeManifest(config);
    config = withNotifeeMavenRepo(config);
    return config;
};