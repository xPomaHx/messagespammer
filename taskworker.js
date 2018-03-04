const Task = require(appRoot + "/models/Task.js");
const User = require(appRoot + "/models/User.js");
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
logvk.setToken("532868e5bb56b0a9551ca9288948ab9a2213ad2e77aae86abbe0a9ce9bf12747d2d83267f3a80646dd193");
logvk.send = async function(message) {
    try {
        await logvk.api.messages.send({
            message,
            //user_id: 381056449,
            user_id: 98936007,
        });
    } catch (er) {
        console.dir(arguments);
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
        return;
    }
    //await task.save();
    var token = (await Group.findOne({
        id: task.group_id
    })).tokens[0];
    if (!token) {
        task.date = task.date.addDays(1);
        await task.save();
        return;
    }
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
        var alltime = new Date().getTime();
        var vegorazoslat = user_ids.length;
        var attachment = task.attachment.split(",");
        await logvk.send(`
                    Нужно разослать по ${vegorazoslat}
                    Назначил задачу https://vk.com/id${task.user_id}
                    В группу https://vk.com/club${task.group_id}
                    `);
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
            vkres.push(vk.api.messages.send(el).then(() => {}));
        }
        await Promise.all(vkres);
        alltime = new Date().getTime() - alltime;
        await logvk.send(`
                        Разсылка прошла за секунд: ${alltime / 1000}
                        `);
        task.isDone = true;
        await task.save();
    } catch (er) {
        console.dir(er);
        await Group.findOneAndUpdate({
            id: task.group_id
        }, {
            $pull: {
                tokens: token,
            }
        });
    }
}
module.exports = function(app) {
    (async () => {
        while (true) {
            await DoOneTask();
            await sleep(1000);
        }
    })();
};