const passport = require('passport');
const VK = require('vk-io');
const axios = require('axios');
const User = require(__dirname + '/models/User.js');
const Task = require(__dirname + '/models/Task.js');
const querystring = require('querystring');
const config = require('./config');
const chunk = require('./helpers/chunk');
//reqend 
module.exports = function(app) {
    app.get('/profile', function(req, res) {
        User.findOne({
            id: req.user.id
        }, function(er, rez) {
            console.dir(arguments);
            res.render("profile", {
                renderdata: {
                    money: rez.money,
                    user: req.user
                }
            });
        });
    })
    app.get('/', function(req, res) {
        (async () => {
            var renderdata = {};
            var debug = [];
            if (req.user) {
                var userdb = await User.findOne({
                    id: req.user.id
                });
                renderdata.user = req.user;
                debug.push("авторизован");
                //console.dir(debug);
            } else {
                debug.push("не авторизован");
                //console.dir(debug);
            }
            var vk = new VK.VK(config.VKio);
            if (userdb) {
                debug.push("Есть в базе");
                //console.dir(debug);
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
                groups = (await vk.collect.executes('groups.getById', groups)).map(el => {
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
                //console.dir(banedGroups);
                debug.push("Групп забанено или отключены сообщения, или недостаточно прав для получения токена " + banedGroups);
                debug.push("Всего токенов в базе " + userdb.communitiesToken.length);
                debug.push("Всего групп с админ правами " + groups.length);
                //console.dir(debug);
                if (!userdb.communitiesToken || userdb.communitiesToken.length != groups.length) {
                    var vkurlautoriz = 'https://oauth.vk.com/authorize?' + querystring.stringify({
                        client_id: config.VK_APP_ID,
                        group_ids: groups.map((el) => {
                            return el.id
                        }).join(","),
                        redirect_uri: config.VK_callbackURLcommunities,
                        scope: "manage,messages,photos,docs",
                        response_type: "code",
                    });
                    res.redirect(vkurlautoriz);
                    return;
                }
                renderdata.groups = groups;
            } else {
                debug.push("нет в базе");
            }
            res.render('index', {
                renderdata,
                debug,
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
    app.get('/auth/vk', passport.authenticate('vkontakte'), function(req, res) {});
    app.get('/auth/vkcommunities', function(req, res) {
        (async () => {
            try {
                if (req.query.code) {
                    var url = "https://oauth.vk.com/access_token?" + querystring.stringify({
                        client_id: config.VK_APP_ID,
                        client_secret: config.VK_APP_SECRET,
                        redirect_uri: config.VK_callbackURLcommunities,
                        code: req.query.code,
                    })
                    var vktoken = (await axios.get(url)).data;
                }
                var ta = [];
                for (key in vktoken) {
                    var act = "access_token_";
                    if (key.indexOf(act) != -1) {
                        var id = key.replace(act, "");
                        var token = vktoken[key];
                        ta.push({
                            id,
                            token
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
                    //console.dir(result);
                    res.redirect("/");
                });
            } catch (er) {
                console.dir(er);
            }
        })()
    });
    app.get('/auth/vk/callback', passport.authenticate('vkontakte', {
        failureRedirect: '/login'
    }), function(req, res) {
        res.redirect('/');
    });
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });
}