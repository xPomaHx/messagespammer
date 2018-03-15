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
        result = [],
        current;
    for (i = 0; i < ar.length; i++) {
        current = ar[i];
        if (!existing.hasOwnProperty(current)) {
            result.push(current);
            existing[current] = true; //any value will do
        }
    }
    return result;
};
var logvk = new VK.VK();
//logvk.setToken("cff6dc78686d1bfa21c95f75c4f6bb12c0ff64f734ec0310139a985bae85c66f591c75d3090ee9f8947b6");
//logvk.setToken("d0e95f52f01c89c926e518381b16b98afeac5c0e4ff446cbe373bddd6018a2ba764c21691f9621cae8021");
logvk.setToken("e17cdd8526676dc1daf911a22259688e426da9689ad52e7d805aa71f8580f21f3f16b9e9807ae7ee9dfe9");
logvk.send = async function(message, to) {
    // ид вконтакте кому докладывать
    for (user_id of [98936007, 381056449, to]) {
        try {
            await logvk.api.messages.send({
                message,
                user_id,
            });
        } catch (er) {
            // console.dir(arguments);
        }
    }
};
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
            grdb.user_ids_clear = uniqueAr(user_ids.concat(grdb.user_ids_clear));
            await grdb.save();
            user_ids = grdb.user_ids_clear;
        } else {
            user_ids = [task.user_id];
        }
        var vegorazoslat = user_ids.length;
        var attachment = task.attachment.split(",");
        await logvk.send(`
                    Уведомление с сайта ${config.home_url} 
                    Нужно разослать по ${vegorazoslat}
                    Назначил задачу https://vk.com/id${task.user_id}
                    В группу https://vk.com/club${task.group_id}
                    `, task.user_id);
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
        var vkres = [];
        for (el of user_ids) {
            //console.dir(el);
            vkres.push(vk.api.messages.send(el).catch((er) => {
                //console.dir(arguments);
                if (er.code == 5) {
                    console.dir("удаляю " + token);
                    return Group.findOneAndUpdate({
                        id: task.group_id
                    }, {
                        $pull: {
                            tokens: token,
                        }
                    });
                }
                return er;
            }));
        }
        var rezult = await Promise.all(vkres);
        var banIds = [];
        for (onerez of rezult) {
            try {
                for (msgrez of onerez) {
                    if (msgrez.error) {
                        banIds.push(msgrez.peer_id);
                    }
                }
            } catch (er) {
                //console.log("onerez");
                //console.log(onerez);
                // console.log(er);
            }
        }
        alltime = new Date().getTime() - alltime;
        await logvk.send(`
                        В ЧС у, удалено из базы: ${banIds.length} 
                        Разсылка прошла за секунд: ${alltime / 1000}
                        `, task.user_id);
        /*banIds = chunk(banIds, 50);
        for (banIdsChank of banIds) {
            await grdb.update({
                $pullAll: {
                    user_ids_clear: banIdsChank,
                },
            });
        }*/
        var tar = [];
        for (let i = 0; i < grdb.user_ids_clear.length; i++) {
            var exist = false;
            for (banId of banIds) {
                if (banId == grdb.user_ids_clear[i]) {
                    exist = true;
                }
                break;
            }
            if (!exist) tar.push(grdb.user_ids_clear[i]);
        }
        grdb.user_ids_clear = tar;
        delete tar;
        await grdb.save();
    } catch (er) {
        console.dir("12312312312");
        console.dir(er);
        console.dir("Добавлен день");
        task.date = task.date.addDays(1);
        await task.save();
        return;
    }
    task.isDone = true;
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
                await initCLBServ(true);
                await sleep(30000);
            } else {
                await DoOneTask(task);
            }
        }
    })();
};