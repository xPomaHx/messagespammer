const Task = require(__dirname + "/models/Task.js");
const User = require(__dirname + "/models/User.js");
const chunk = require("./helpers/chunk");
const VK = require("vk-io");
const config = require("./config");
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
module.exports = function(app) {
    (async () => {
        var logvk = new VK.VK();
        logvk.setToken("532868e5bb56b0a9551ca9288948ab9a2213ad2e77aae86abbe0a9ce9bf12747d2d83267f3a80646dd193");
        while (true) {
            var task = await Task.findOne({
                isDone: false,
                date: {
                    $lt: Date.now(),
                }
            }).sort({
                date: -1
            }).limit(1).exec();
            if (task) {
                await task.save();
                var user = await User.findOne({
                    id: task.user_id,
                });
                
                var token = user.communitiesToken.find((el) => {
                    return el.id == task.group_id
                });
                
                
                try {
                    if (!token || !token.token) {
                        task.date = task.date.addDays(1);
                        await task.save();
                        throw ("skip without token");
                    }
                    token = token.token;
                    var vk = new VK.VK({
                        apiTimeout: 600000,
                        //apiMode: "parallel",
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
                    var attachment = task.attachment.split(",").map((el) => {
                        return el + "_" + token;
                    });
                    var vegorazoslat = user_ids.length;
                    await logvk.api.messages.send({
                        message: "Нужно разослать по " + vegorazoslat + "\r\n Назначил задачу https://vk.com/id" + user.id + "\r\n В группу https://vk.com/club" + task.group_id,
                        user_id: 381056449,
                    });
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
                        var vkresfinaly = function() {
                            var to = { in : el,
                                out: arguments,
                            };
                            return to;
                        };
                        vkres.push(vk.api.messages.send(el).then(vkresfinaly).catch(vkresfinaly));
                    }
                    vkres = await Promise.all(vkres);
                    var tarray = [];
                    var errorCount = 0;
                    var goodCount = 0;
                    vkres.forEach(function(a) {
                        for (b in a.out) {
                            a.out[b].forEach(function(c) {
                                tarray.push(c);
                                if (c.error) {
                                    errorCount++;
                                }
                            });
                        };
                    });
                    alltime = new Date().getTime() - alltime;
                    await logvk.api.messages.send({
                        message: "(а)Разсылка прошла за секунд: " + alltime / 1000 + "\r\n доставленно: " + vegorazoslat + "\r\n ошибок: " + errorCount,
                        user_id: 381056449,
                    });
                    task.isDone = true;
                    await task.save();
                } catch (er) {
                    console.dir(er);
                    user.communitiesToken = [];
                    await user.save();
                }
            } else {
                //console.dir("Список задач пуст");
            }
            await sleep(1000);
        }
    })()
}