const config = require(`./${process.argv[2]}`);
const stringifySafe = require('json-stringify-safe');
const queue = require('bull');
const vk = require('vk-io');
const fs = require('fs');
const util = require('util');
const maxConcurrency = 50;
const tasksQueue = queue(`${config.tasksQueue}`, config.redis);
logData = (stream, text) => {
    stream.write(String(text) + '\n');
    console.log(String(text));
};
tasksQueue.process((job, done) => {
    let task = job.data;
    const logStream = fs.createWriteStream(`${config.logsFolder}/${task.taskName}.log`);
    logData(logStream, `${new Date()} [${task.taskName}] Начата обработка`);
    let imageAttachment = task.image.match(/(photo-[0-9]+_[0-9]+)/);
    const VKCommunity = new vk({
        token: task.communityToken,
        call: 'execute',
        restartCount: 3,
        timeout: 600000,
        restartWait: 1500,
    });
    const getDialogs = () => {
        return new Promise((resolve, reject) => {
            let data = [];
            VKCommunity.collect.messages.getDialogs({
                maxCalls: 20,
            }).on('data', (items) => {
                logData(logStream, `${new Date()} [${task.taskName}] Получено часть (${items.length}) диалогов. Всего ${data.length}`);
                items.forEach((item) => {
                    data.push(item.message.user_id);
                });
                console.log(`last pushed id: `, data[data.length - 1]);
            }).on('end', () => {
                resolve(data);
            }).on('error', (err) => {
                reject(err);
            });
        });
    };
    getDialogs().then((dialogs) => {
        logData(logStream, `${new Date()} [${task.taskName}] Получено всего ${dialogs.length} диалогов, начинаю отправку сообщений. Внимание! Теперь не будут вестись логи о каждой отправке, но если вы видите это сообщение то рассылка идет в штатном режиме. По окончании рассылки будет добавлено сообщение об этом.`);
        let currentRequests = 0;
        let currentId = (dialogs.length - 1);
        for (let i = 0; i < maxConcurrency; i++) {
            sendPool();
        }

        function sendPool(requestFinished) {
            //            console.log(`currentRequests: `, currentRequests);
            if (requestFinished) currentRequests--;
            if (currentId < 0) {
                done();
                logData(logStream, `${new Date()} Рассылка закончена!`);
                return;
            }
            if (currentRequests <= maxConcurrency) {
                makeRequest(currentId, sendPool);
                currentRequests++;
                currentId--;
                //              console.log(currentId, ' started');
            }
        }

        function makeRequest(n, callback) {
            let uid = dialogs[n];
            VKCommunity.api.messages.send({
                peer_id: uid,
                message: task.message,
                attachment: (imageAttachment ? imageAttachment[0] : ''),
            }).then(() => {
                if (n % 1000 == 0) logData(logStream, `${new Date()} Отправлено https://vk.com/id${uid} (${dialogs.length-n}/${dialogs.length})`);
                //console.log(n, ' finished');
                callback(true);
            }).catch((error) => {
                //logData(logStream, `${new Date()} Ошибка отправки https://vk.com/id${msg.message.user_id} (${dialogs.length-n}/${dialogs.length})\n${error}`);
                //console.log(n, ' finished');
                callback(true);
            });
        }
    }).catch((error) => {
        done();
        logData(logStream, `${new Date()} Ошибка получения диалогов\n${error}`);
    });
});