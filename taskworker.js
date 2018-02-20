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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
module.exports = function(app) {
    (async () => {
        var logvk = new VK.VK();
        logvk.setToken("ff3439512a0f4965d2746056c31808b3ef9df3eae1405ccef3dfdbff0fcf3063e92c87a3e83fc2e881c07");
        while (true) {
            var task = await Task.findOne({
                isDone: false,
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
                }).token;
                try {
                    if (!token) {
                        throw ("skip without token");
                    }
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
                    })
                    try {
                        await logvk.api.messages.send({
                            message: "Нужно разослать по " + user_ids.length + "\r\n Назначил задачу https://vk.com/id" + user.id + "\r\n В группу https://vk.com/club" + task.group_id,
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
                        vkres.forEach(function(a) {
                            a.out[0].forEach(function(b) {
                                tarray.push(b);
                                if (b.error) {
                                    errorCount++;
                                }
                            });
                        });
                        vkres = tarray;
                    } catch (er) {
                        console.dir(er);
                    }
                    alltime = new Date().getTime() - alltime;
                    await logvk.api.messages.send({
                        message: "Разсылка прошла за секунд: " + alltime / 1000 + "\r\n доставленно: " + vkres.length - errorCount + "\r\n ошибок: " + errorCount,
                        user_id: 381056449,
                    });
                } catch (er) {
                    console.dir(er);
                    user.communitiesToken = [];
                    await user.save();
                }
                task.isDone = true;
                await task.save();
            } else {
                //console.dir("Список задач пуст");
            }
            await sleep(1000);
        }
    })()
}