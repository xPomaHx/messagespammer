// Config
const appName = 'deliver';
const config  = 'test.config.json';
const logs    = '~/logs/bot/';
const workers = 10;

// Util
const app = component => appName + '-' + component;
const logsPath = log => logs + appName + `-` + log;
const path = file => file;
const configPath = path(config);
const appsList = [];

// Listener
appsList.push({
    name            : app('web'),
    script          : path('web.js'),
    args            : [configPath],
    error_file      : logsPath(`error.log`),
    out_file        : logsPath(`output.log`),
    log_file        : logsPath(`merged.log`),
    merge_logs      : true,
    log_date_format : "YYYY-MM-DD HH:mm Z"
});

/**
 * Push workers
 */
for (let i = 0; i < workers; i++) {
    appsList.push({
        name            : app('worker'),
        script          : path('worker.js'),
        args            : [configPath],
        error_file      : logsPath(`error.log`),
        out_file        : logsPath(`output.log`),
        log_file        : logsPath(`merged.log`),
        merge_logs      : true,
        log_date_format : "YYYY-MM-DD HH:mm Z",
        env: {
            'token_id': i
        }
    });
}

module.exports = {
    apps: appsList
};
