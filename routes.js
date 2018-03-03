const VK = require('vk-io');
const axios = require('axios');
const User = require(appRoot + '/models/User.js');
const Task = require(appRoot + '/models/Task.js');
const querystring = require('querystring');
const config = require(appRoot + '/config');
const chunk = require(appRoot + '/helpers/chunk');
const uuidv4 = require('uuid/v4');
//reqend 
module.exports = function(app) {
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

        (async () => {
            var renderdata = {};
            if (req.user) {
                var userdb = await User.findOne({
                    id: req.user.id
                });
                renderdata.user = req.user;
                res.debug.push("авторизован");
            } else {
                res.debug.push("не авторизован");
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
                banedGroups = banedGroups - groups.length;
                res.debug.push("Групп з`абанено или отключены сообщения, или недостаточно прав для получения токена " + banedGroups);
                res.debug.push("Всего токенов в базе " + userdb.communitiesToken.length);
                res.debug.push("Всего групп с админ правами " + groups.length);
                if (!userdb.communitiesToken || userdb.communitiesToken.length != groups.length) {
                    var vkurlautoriz = 'https://oauth.vk.com/authorize?' + querystring.stringify({
                        client_id: config.VK_APP_ID,
                        group_ids: groups.map((el) => {
                            return el.id
                        }).join(","),
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
                res.logout();
                res.redirect("/auth/vk");
                return;
            }
            res.render('index', {
                renderdata,
                debug: res.debug,
            });
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
            var user = await User.findOne({
                id: req.user.id,
            });
            var token = (await user.communitiesToken.find((el) => {
                return el.id == group_id;
            })).token;
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
    app.get('/auth/vk', function(req, res) {
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
                                new: true,
                                setDefaultsOnInsert: true
                            };
                        user = await User.findOneAndUpdate({
                            id: query.id
                        }, update, options, function(error, result) {
                            console.dir(error);
                        });
                        await res.refreshTokens(user);
                        res.redirect("/");
                    } else {
                        var ta = [];
                        for (key in vktoken) {
                            var act = "access_token_";
                            if (key.indexOf(act) != -1) {
                                var id = key.replace(act, "");
                                var token = vktoken[key];
                                ta.push({
                                    id,
                                    token,
                                });
                            }
                        }
                        var query = {
                                id: req.user.id,
                                communitiesToken: ta,
                            },
                            update = query,
                            options = {
                                upsert: true,
                                //new: true,
                                //setDefaultsOnInsert: true
                            };
                        User.findOneAndUpdate({
                            id: query.id
                        }, update, options, function(error, result) {
                            console.dir(error);
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
        res.redirect('/');
    });
}