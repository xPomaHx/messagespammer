const passport = require("passport");
const VkStrategy = require("passport-vkontakte").Strategy;
const dotengine = require("express-dot-engine");
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const expresssession = require("express-session");
const MongoStore = require("connect-mongo")(expresssession);
var User = require(__dirname + "/models/User.js");
const config = require("./config");
//reqend
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(obj, done) {
    done(null, obj);
});
passport.use(new VkStrategy({
    clientID: config.VK_APP_ID,
    clientSecret: config.VK_APP_SECRET,
    callbackURL: config.VK_callbackURL,
    scope: ["notify",
        //"friends",
        //"photos",
        //"audio",
        //"video",
        //"pages",
        //"+256",
        "status",
        //"notes",
        //"messages",
        //"wall",
        //"ads",
        "offline", "groups", "notifications", "stats", "email",
        //"market",
        //"app_widget",
        //"docs",
        "manage"
    ],
    profileFields: ["email"],
}, function verify(accessToken, refreshToken, params, profile, done) {
    
    var query = {
            id: params.user_id,
            token: params.access_token,
        },
        update = query,
        options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
    User.findOneAndUpdate({
        id: query.id
    }, update, options, function(error, result) {
        return done(null, profile);
    });
}));
module.exports = function(app) {
    app.use(express.static(__dirname + "/public"));
    app.set("views", __dirname + "/views");
    app.engine("html", dotengine.__express);
    app.set("views", path.join(__dirname, "./views"));
    app.set("view engine", "html");
    app.use(require("cookie-parser")());
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());
    app.use(expresssession({
        secret: "keyboard cat",
        resave: true,
        saveUninitialized: true,
        store: new MongoStore({
            url: "mongodb://localhost/vkspammer",
            ttl: 14 * 24 * 60 * 60 // = 14 days. Default
        })
    }));
    app.use(passport.initialize());
    app.use(passport.session());
}