const VK = require('vk-io');
const axios = require('axios');
const User = require(appRoot + '/models/User.js');
const Task = require(appRoot + '/models/Task.js');
const Group = require(appRoot + '/models/Group.js');
const querystring = require('querystring');
const config = require(appRoot + '/config');
const chunk = require(appRoot + '/helpers/chunk');
const uuidv4 = require('uuid/v4');
//reqend 
module.exports = function(app) {
    app.use(function(req, res, next) {
        req.rawBody = '';
        req.on('data', function(chunk) {
            req.rawBody += chunk;
            console.dir(chunk + "");
        });
        next();
    });
    /*app.get("*", function(req, res) {
        res.redirect("http://botplus.ru");
    });*/
    app.get("/test", function(req, res) {
        /*(async () => {
            setTimeout(() => {
                console.dir(1231231);
            }, 9999);
        })();
        res.json(1);
        return;*/
    });
    var user_ads_cash = {
        cash: {},
        count: 0,
        timeout: !1,
        add: function(group_id, user_id) {
            if (!this.cash[group_id]) this.cash[group_id] = [];
            this.cash[group_id].push(user_id);
            this.count++;
            if (this.count >= 100) {
                this.bulkAndClear();
            }
        },
        bulkAndClear: async function() {
            var cash = this.cash;
            this.cash = {};
            //console.dir(this.count);
            this.count = 0;
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                //console.dir("with timeout");
                //console.dir(cash);
                this.bulkAndClear()
            }, 10000);
            if (Object.keys(cash).length == 0) return;
            //console.time("timeWriteNewMsgUserId");
            var bulk = Group.collection.initializeUnorderedBulkOp();
            for (id in cash) {
                var user_ids = cash[id];
                bulk.find({
                    id: +id,
                }).upsert().update({
                    $push: {
                        "user_ids": {
                            $each: user_ids,
                        },
                    }
                });
            }
            await bulk.execute({
                w: 0
            }, function(err, rez) {});
            //console.timeEnd("timeWriteNewMsgUserId");
        },
    }
    user_ads_cash.bulkAndClear();
    app.route('/callback').get(function(req, res) {
        res.send("ok");
    }).post(function(req, res) {
        (async () => {
            if (!req.body.type) {
                return;
            }
            //console.dir(req.body.type + " " + req.body.group_id);
            switch (req.body.type) {
                case 'confirmation':
                    var gr = await Group.findOne({
                        id: req.body.group_id
                    }, "confirmationCode");
                    if (gr) {
                        res.send(gr.confirmationCode);
                        return;
                    }
                    break;
                case 'message_new':
                case 'message_allow':
                    /*await Group.updateOne({
                        id: req.body.group_id
                    }, {
                        $push: {
                            user_ids: req.body.object.user_id,
                        }
                    }, {
                        upsert: true,
                    });*/
                    user_ads_cash.add(req.body.group_id, req.body.object.user_id);
                    break;
            }
            res.send("ok");
        })();
    });
    app.get('/profile', function(req, res) {
        User.findOne({
            id: req.user.id
        }, function(er, rez) {
            res.render("profile", {
                renderdata: {
                    reflink: config.home_url + "?" + querystring.stringify({
                        ref_id: req.user.id
                    }),
                    money: rez.money,
                    user: req.user
                }
            });
        });
    });
    app.use("/", (req, res, next) => {
        if (req.query.ref_id) {
            res.cookie('ref_id', req.query.ref_id, {
                expires: new Date(Date.now() + 900000),
                httpOnly: true
            });
        }
        next();
    });
    app.get('/', function(req, res) {
        var renderdata = {};
        var finalRender = function() {
            res.render('index', {
                renderdata,
                debug: res.debug,
            });
        };
        (async () => {
            if (req.user) {
                var userdb = await User.findOne({
                    id: req.user.id
                });
                renderdata.user = req.user;
                res.debug.push("авторизован");
            } else {
                res.debug.push("не авторизован");
                finalRender()
                return;
            }
            var vk = new VK.VK(config.VKio);
            if (userdb) {
                res.debug.push("Есть в базе");
                if (req.cookies.ref_id && !userdb.ref_id && userdb.id != req.cookies.ref_id) {
                    res.debug.push("Есть референс");
                    var refuser = await User.findOne({
                        id: req.cookies.ref_id,
                    });
                    if (refuser) {
                        res.debug.push("добавил денег референсу и юзеру");
                        userdb.ref_id = req.cookies.ref_id;
                        userdb.money = userdb.money + 20;
                        refuser.money = refuser.money + 20;
                    }
                    await userdb.save();
                    await refuser.save();
                };
                renderdata.money = userdb.money;
                vk.setToken(userdb.token);
                var groups = await vk.collect.groups.get({
                    filter: "admin",
                    count: 1000,
                    fields: "deactivated,ban_info",
                    extended: 1
                });
                groups = groups.map((el2) => {
                    return el2.id;
                });
                groups = chunk(groups, 500);
                groups = groups.map((el) => {
                    return {
                        group_ids: el.join(","),
                        fields: "can_message",
                    };
                });
                groups = [(await vk.collect.executes('groups.getById', groups))].map(el => {
                    return el.response[0];
                }).reduce(function(a, b) {
                    return a.concat(b);
                });
                var banedGroups = groups.length;
                groups = groups.filter((el) => {
                    if (el.admin_level == 3 && el.is_member == 1 && !el.deactivated && el.can_message == 1 && el.is_admin == 1) {
                        return true;
                    } else {
                        return false;
                    }
                });
                var group_ids = groups.map((el) => {
                    return el.id
                });
                banedGroups = banedGroups - groups.length;
                var grdb = await Group.find({
                    id: {
                        $in: group_ids
                    },
                    tokens: {
                        $exists: true,
                        $not: {
                            $size: 0
                        }
                    },
                });
                res.debug.push("Групп забанено или отключены сообщения, или недостаточно прав для получения токена " + banedGroups);
                res.debug.push("Всего токенов в базе " + grdb.length);
                res.debug.push("Всего групп с админ правами " + groups.length);
                if (!grdb || grdb.length != groups.length) {
                    var vkurlautoriz = 'https://oauth.vk.com/authorize?' + querystring.stringify({
                        client_id: config.VK_APP_ID,
                        group_ids: group_ids.join(","),
                        redirect_uri: config.VK_callbackURL,
                        scope: "manage,messages,photos,docs",
                        response_type: "code",
                    });
                    res.redirect(vkurlautoriz);
                    return;
                }
                renderdata.groups = groups;
            } else {
                res.debug.push("нет в базе");
                res.redirect("/auth/vk");
                return;
            }
            finalRender();
        })();
    });
    app.route('/community').get(function(req, res) {
        if (!req.user) {
            res.redirect("/");
        }
        res.render('community', {
            renderdata: {
                group: {
                    id: req.query.group_id
                },
                user: req.user
            }
        });
    });
    app.route('/dispatch-page').get(function(req, res) {
        if (!req.user) {
            res.redirect("/");
            return;
        }
        (async () => {
            var group_id = req.query.group_id;
            var tasks = await Task.find({
                group_id
            });
            res.render('dispatch-page', {
                renderdata: {
                    user: req.user,
                    tasks
                }
            });
        })()
    }).post(function(req, res) {
        (async () => {
            var group_id = req.query.group_id;
            var message = req.body.taskMessage;
            var attachment = req.body.attachment;
            var test = req.body.test;
            var date = new Date(+req.body.date);
            var task = new Task({
                user_id: req.user.id,
                group_id,
                attachment,
                message,
                date,
                test
            });
            await task.save();
            res.json("ok");
        })()
    });
    app.get('/task/:task_id', function(req, res) {
        try {
            Task.findOne({
                _id: req.params.task_id
            }, {
                log: 1,
                _id: -1
            }, function(er, rez) {
                if (!rez || !rez.log) {
                    res.statusCode = 404;
                    res.send();
                    return;
                }
                res.send("<pre>" + rez.log + "</pre>");
            })
        } catch (er) {
            res.statusCode = 404;
            res.send();
        }
    });
    app.get('/auth/vk', function(req, res) {
        res.logout();
        console.dir("auth");
        var vkurlautoriz = 'https://oauth.vk.com/authorize?' + querystring.stringify({
            client_id: config.VK_APP_ID,
            redirect_uri: config.VK_callbackURL,
            scope: "offline ,groups",
            response_type: "code",
        });
        res.redirect(vkurlautoriz);
    });
    app.get('/auth/vk/callback', function(req, res) {
        (async () => {
            try {
                if (req.query.code) {
                    var url = "https://oauth.vk.com/access_token?" + querystring.stringify({
                        client_id: config.VK_APP_ID,
                        client_secret: config.VK_APP_SECRET,
                        redirect_uri: config.VK_callbackURL,
                        code: req.query.code,
                    })
                    var vktoken = (await axios.get(url)).data;
                    if (vktoken.access_token) {
                        vk = new VK.VK(config.VKio);
                        vk.setToken(vktoken.access_token);
                        var user = (await vk.api.users.get({
                            user_id: vktoken.user_id,
                            fields: "photo_max_orig",
                        }))[0];
                        var query = {
                                id: vktoken.user_id,
                                token: vktoken.access_token,
                                first_name: user.first_name,
                                last_name: user.last_name,
                                photo_max_orig: user.photo_max_orig,
                            },
                            update = query,
                            options = {
                                upsert: true,
                                //new: true,
                                //setDefaultsOnInsert: true
                            };
                        var queryId = query.id;
                        delete query.id;
                        user = await User.findOneAndUpdate({
                            id: queryId,
                        }, update, options, function(error, result) {
                            console.dir(error);
                        });
                        await res.refreshTokens(user);
                        res.redirect("/");
                    } else {
                        var bulk = Group.collection.initializeUnorderedBulkOp();
                        for (key in vktoken) {
                            var act = "access_token_";
                            if (key.indexOf(act) != -1) {
                                var id = +key.replace(act, "");
                                var token = vktoken[key];
                                bulk.find({
                                    id
                                }).upsert().update({
                                    $push: {
                                        tokens: token,
                                    }
                                });
                            }
                        }
                        await bulk.execute(function(err, rez) {
                            console.dir(err);
                            res.redirect("/");
                        });
                    }
                }
            } catch (er) {
                console.dir(er);
            }
        })()
    });
    app.get('/logout', function(req, res) {
        res.logout();
        delete req.user;
        res.redirect('/');
    });
}