const Task = require(__dirname + '/models/Task.js');
const User = require(__dirname + '/models/User.js');
const chunk = require('./helpers/chunk');
const VK = require('vk-io');
const config = require('./config');
var fs = require('fs');
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
                /*if (!task.random_id) {
                    task.random_id = Math.floor(Math.random() * (161531216 - 0)) + 0
                }*/
                await task.save();
                var user = await User.findOne({
                    id: task.user_id,
                });
                var token = user.communitiesToken.find((el) => {
                    return el.id == task.group_id
                }).token;
                try {
                    if (!token) {
                        throw ("skip");
                    }
                    var vk = new VK.VK({
                        apiTimeout: 600000,
                        apiMode: "parallel",
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
                    var log = [];
                    var logname = (new Date().getTime()) + ".json";
                    var alltime = new Date().getTime();
                    var attachment = task.attachment.split(',').map((el) => {
                        return el + "_" + token;
                    })
                    try {
                        await logvk.api.messages.send({
                            message: "Нужно разослать по " + user_ids.length,
                            user_id: 381056449,
                        });
                        console.log("Нужно разослать по " + user_ids.length);
                        user_ids = chunk(user_ids, 100);
                        user_ids = user_ids.map((el) => {
                            return {
                                user_ids: el.join(","),
                                // random_id: task.random_id,
                                message: task.message,
                                attachment,
                            };
                        });
                        log.push("Итерация");
                        for (el of user_ids) {
                            var time = new Date().getTime();
                            log.push(el);
                            var vkres = [];
                            //var stime = new Date().getTime() - time;
                            vkres.push(vk.api.messages.send(el).then(function() {
                                return {
                                    //startTime: stime / 1000,
                                    endTime: (new Date().getTime() - time) / 1000,
                                    in : el,
                                    out: arguments,
                                };
                            }).catch(function() {
                                return {
                                    //startTime: stime / 1000,
                                    endTime: (new Date().getTime() - time) / 1000,
                                    in : el,
                                    out: arguments,
                                };
                            }));
                            /*time = new Date().getTime() - time;
                            if (time <= 51) {
                                await sleep(51 - time);
                            }*/
                        }
                        vkres = await Promise.all(vkres)
                        log.push(vkres);
                        /*log.push(user_ids);
                        console.log("Задач " + user_ids.length);
                        var vkres = await vk.collect.executes('messages.send', user_ids);
                        log.push(vkres);
                        vkres.forEach(el => {
                            aftids = aftids.concat(el.response);
                        });*/
                        //console.log("отправленно " + aftids.length);
                        user_ids = 0;
                    } catch (er) {
                        console.dir(er);
                    } finally {
                        fs.writeFile("log/" + logname, JSON.stringify(log), function() {
                            //console.dir(arguments);
                        });
                    }
                    alltime = new Date().getTime() - alltime;
                    await logvk.api.messages.send({
                        message: "Разсылка прошла за секунд" + alltime / 1000,
                        user_id: 381056449,
                    });
                    console.dir("Разсылка прошла за секунд" + alltime / 1000);
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