const Task = require(appRoot + "/models/Task.js");
const chunk = require(appRoot + "/helpers/chunk");
const Group = require(appRoot + '/models/Group.js');
const VK = require("vk-io");
const config = require(appRoot + "/config");
var fs = require("fs");
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
var DoOneTask = async function() {
    var task = await Task.findOne({
        isDone: false,
        date: {
            $lt: Date.now(),
        }
    }).sort({
        date: -1
    }).limit(1).exec();
    if (!task) {
        //console.dir("нет задач");
        return;
    }
    //await task.save();
    var grdb = (await Group.findOne({
        id: task.group_id
    }));
    if (!grdb || !grdb.tokens || grdb.tokens == [] || grdb.tokens.length == 0) {
        task.date = task.date.addDays(1);
        await task.save();
        return;
    }
    var token = grdb.tokens[0];
    try {
        var vk = new VK.VK({
            apiTimeout: 600000,
            apiMode: "sequential",
            apiLimit: 20,
            apiExecuteCount: 1,
        });
        vk.setToken(token);
        if (!task.test) {
            var msg = (await vk.collect.messages.getDialogs());
            var user_ids = msg.map((el) => {
                return el.message.user_id;
            });
        } else {
            user_ids = [task.user_id];
        }
        var vegorazoslat = user_ids.length;
        var attachment = task.attachment.split(",");
        await logvk.send(`
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
            vkres.push(vk.api.messages.send(el).then(() => {}).catch((er) => {
                //console.dir(er);
                if (er.code == 5) {
                    throw (er);
                }
                return;
            }));
        }
        await Promise.all(vkres);
        alltime = new Date().getTime() - alltime;
        await logvk.send(`
                        Разсылка прошла за секунд: ${alltime / 1000}
                        `, task.user_id);
    } catch (er) {
        console.dir(123);
        console.dir(er);
        console.dir("удаляю " + token);
        await Group.findOneAndUpdate({
            id: task.group_id
        }, {
            $pull: {
                tokens: token,
            }
        });
    }
    task.isDone = true;
    await task.save();
}
module.exports = function(app) {
    (async () => {
        while (true) {
            await DoOneTask();
            await sleep(1000);
        }
    })();
};