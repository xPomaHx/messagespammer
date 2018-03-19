const Task = require(appRoot + "/models/Task.js");
const chunk = require(appRoot + "/helpers/chunk");
const Group = require(appRoot + '/models/Group.js');
const VK = require("vk-io");
const config = require(appRoot + "/config");
var fs = require("fs");
const callbackServer = require(appRoot + '/helpers/callbackServer');
Array.prototype.diff = function(a) {
    return this.filter(function(i) {
        return a.indexOf(i) < 0;
    });
};
Date.prototype.addDays = function(days) {
    var dat = new Date(this.valueOf());
    dat.setDate(dat.getDate() + days);
    return dat;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
var uniqueAr = function(ar) {
    var existing = {},
        result = [];
    var length = ar.length;
    for (i = length; i--;) {
        if (!existing.hasOwnProperty(ar[i])) {
            result.push(ar[i]);
            existing[ar[i]] = true; //any value will do
        }
    }
    return result;
};

function allProgress(proms, progress_cb) {
    let d = 0;
    progress_cb(0);
    proms.forEach((p) => {
        p.then(() => {
            d++;
            progress_cb((d * 100) / proms.length);
        });
    });
    return Promise.all(proms);
}
var Logvk = function() {
    var _logvk = new VK.VK();
    this.setToken = function(t) {
        _logvk.setToken(t);
    }
    this.isDone = false;
    this._user_ids = [];
    this.user_ids = {};
    this.user_ids.add = (user_id) => {
        this._user_ids.push(user_id);
        this._user_ids = uniqueAr(this._user_ids);
    };
    this.send = async (message, edit) => {
        // ид вконтакте кому докладывать
        var method = "send";
        if (edit) method = "edit";
        var peer_ids = [];
        var params = {
            message,
        };
        for (let i = 0; i < this._user_ids.length; i++) {
            try {
                if (edit) {
                    params.peer_id = this._user_ids[i];
                    params.message_id = this.peer_ids[i];
                } else {
                    params.user_id = this._user_ids[i];
                }
                var rez = (await _logvk.api.messages[method](params));
                //console.dir(rez);
                peer_ids[i] = (rez);
            } catch (er) {
                console.dir(er);
                this.isDone = true;
            }
        }
        return peer_ids;
    };
    this.peer_ids = [];
    this.perсent = 0;
    var startProgres = async () => {
        while (!this.isDone) {
            var isFirst = this.peer_ids.length == 0;
            if (isFirst) {
                this.peer_ids = await this.send("Прогресс: " + this.perсent + "%");
            } else {
                await this.send("Прогресс: " + this.perсent + "%", true);
                if (this.perсent == 100) {
                    this.isDone = true;
                }
            }
            await sleep(11111);
        }
    };
    var IsProgressStart = false;
    this.progress = async (perсent) => {
        if (!IsProgressStart) {
            startProgres();
            IsProgressStart = true;
        }
        this.perсent = perсent;
    }
}
var initCLBServ = async function(all) {
    var query = {
        tokens: {
            $exists: true,
            $ne: []
        },
    };
    if (all) {
        query.confirmationCode = {
            $exists: false
        };
        /* query.user_ids = {
             $exists: false
         };*/
    }
    var groups = await Group.find(query, "id tokens confirmationCode");
    //console.dir("Групп на проверку колбека " + groups.length);
    if (groups == []) {
        return;
    }
    for (group of groups) {
        await callbackServer.addServ(group);
    };
}
var DoOneTask = async function(task) {
    //await task.save();
    var grdb = (await Group.findOne({
        id: task.group_id,
        tokens: {
            $exists: true,
            $ne: []
        },
    }));
    if (!grdb || !grdb.tokens || grdb.tokens == [] || grdb.tokens.length == 0) {
        console.dir("Добавлен день");
        task.date = task.date.addDays(1);
        await task.save();
        return;
    }
    var token = grdb.tokens[0];
    try {
        var vk = new VK.VK({
            apiTimeout: 600000,
            apiMode: "sequential",
            apiAttempts: 5,
            apiWait: 5000,
            apiLimit: 20,
            apiExecuteCount: 1,
        });
        vk.setToken(token);
        var user_ids = [];
        if (!task.test) {
            /*var msg = (await vk.collect.messages.getDialogs());
            var user_ids = msg.map((el) => {
                return el.message.user_id;
            });*/
            user_ids = grdb.user_ids;
            grdb.user_ids = undefined;
            await grdb.save();
            //console.dir(user_ids.length + grdb.user_ids_clear.length);
            //console.time("uniqueAr");
            grdb.user_ids_clear = uniqueAr(user_ids.concat(grdb.user_ids_clear));
            //console.timeEnd("uniqueAr");
            await grdb.save();
            user_ids = grdb.user_ids_clear;
        } else {
            user_ids = [task.user_id];
        }
        var vegorazoslat = user_ids.length;
        var attachment = task.attachment.split(",");
        var logvks = [];
        var tokenbase = ['e17cdd8526676dc1daf911a22259688e426da9689ad52e7d805aa71f8580f21f3f16b9e9807ae7ee9dfe9', '37caff9a2e3ee0f6c61d96ef64e5154cab1f92768830f412dd4982fd8c0bdfefc5a3e62ab873e93b4eb78', '37caff9a2e3ee0f6c61d96ef64e5154cab1f92768830f412dd4982fd8c0bdfefc5a3e62ab873e93b4eb78'];
        for (uid of uniqueAr([task.user_id, 98936007, 381056449])) {
            var tlog = new Logvk();
            tlog.user_ids.add(uid);
            tlog.setToken(tokenbase.pop());
            logvks.push(tlog);
        }
        for (logvk of logvks) {
            await logvk.send(`
                    Уведомление с сайта ${config.home_url} 
                    Нужно разослать по ${vegorazoslat}
                    Назначил задачу https://vk.com/id${task.user_id}
                    В группу https://vk.com/club${task.group_id}
                    `);
        }
        var alltime = new Date().getTime();
        user_ids = chunk(user_ids, 100);
        user_ids = user_ids.map((el) => {
            return {
                user_ids: el.join(","),
                // random_id: task.random_id,
                message: task.message,
                attachment,
            };
        });
        var breaktoken = false;
        var vkres = [];
        for (el of user_ids) {
            //console.dir(el);
            vkres.push(vk.api.messages.send(el).catch((er) => {
                //console.dir(arguments);
                if (er.code == 5 || er.code == 27) {
                    breaktoken = true;
                }
                return er;
            }));
        }
        //var rezult = await Promise.all(vkres);
        var rezult = await allProgress(vkres, (p) => {
            for (logvk of logvks) {
                logvk.progress(p.toFixed(2));
            }
        });
        //await logvk.progress(100, true);
        for (logvk of logvks) {
            while (!logvk.isDone) {
                await sleep(1000);
            }
        }
        var banIds = [];
        var log = "";
        for (onerez of rezult) {
            try {
                for (msgrez of onerez) {
                    if (msgrez.error) {
                        banIds.push(msgrez.peer_id);
                        log += msgrez.peer_id + ": " + JSON.stringify(msgrez.error) + "\r\n";
                    } else {
                        log += msgrez.peer_id + ": ok\r\n"
                    }
                }
            } catch (er) {
                //console.log("onerez");
                //console.log(onerez);
                // console.log(er);
                log += JSON.stringify(onerez) + "\r\n";
            }
        }
        task.log = log;
        alltime = new Date().getTime() - alltime;
        if (breaktoken) {
            console.dir("удаляю " + token);
            await Group.findOneAndUpdate({
                id: task.group_id
            }, {
                $pull: {
                    tokens: token,
                }
            });
            for (logvk of logvks) {
                await logvk.send(`
Токен отозван, требуется перелогинится на сайте, и пересоздать задачу.
                `);
            }
        }
        for (logvk of logvks) {
            await logvk.send(`
                        Лог: ${config.home_url}/task/${task._id.toString()}
                        В ЧС у, удалено из базы: ${banIds.length} 
                        Разсылка прошла за секунд: ${alltime / 1000}
                        `);
        }
        /*banIds = chunk(banIds, 50);
        for (banIdsChank of banIds) {
            await grdb.update({
                $pullAll: {
                    user_ids_clear: banIdsChank,
                },
            });
        }*/
        //console.time("исключение банов");
        var tar = [];
        user_ids = grdb.user_ids_clear;
        var banobj = {};
        for (let i = banIds.length; i--;) {
            banobj[banIds[i]] = true;
        }
        var tel;
        for (let ii = user_ids.length; ii--;) {
            tel = user_ids[ii];
            if (!banobj.hasOwnProperty(tel)) {
                tar.push(tel);
            }
        }
        //console.timeEnd("исключение банов");
        //console.dir(grdb.user_ids_clear.length);
        //console.dir(tar.length);
        grdb.user_ids_clear = tar;
        await grdb.save();
    } catch (er) {
        console.dir("12312312312");
        console.dir(er);
        console.dir("Добавлен день");
        task.date = task.date.addDays(1);
        await task.save();
        return;
    }
    if (!breaktoken) {
        task.isDone = true;
    }
    await task.save();
}
module.exports = function(app) {
    (async () => {
        await initCLBServ();
        console.dir("initCLBServ redy");
        while (true) {
            var task = await Task.findOne({
                isDone: false,
                date: {
                    $lt: Date.now(),
                }
            }).sort({
                date: -1
            }).limit(1).exec();
            if (!task) {
                await sleep(10000);
            } else {
                await initCLBServ(true);
                await DoOneTask(task);
            }
        }
    })();
};