const dotengine = require("express-dot-engine");
const express = require("express");
const path = require("path");
const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
var User = require(__dirname + "/models/User.js");
const uuidv4 = require('uuid/v4');
const config = require("./config");
var jwt = require('jsonwebtoken');
//reqend
module.exports = function(app) {
    app.use(cookieParser());
    app.use(express.static(__dirname + "/public"));
    app.set("views", __dirname + "/views");
    app.engine("html", dotengine.__express);
    app.set("views", path.join(__dirname, "./views"));
    app.set("view engine", "html");
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(function(req, res, next) {
        (async () => {
            if (req.cookies.accessToken) {
                try {
                    req.user = jwt.verify(req.cookies.accessToken, config.privateKey);
                } catch (er) {
                    var error = er;
                }
                if (error) {
                    error = undefined;
                    try {
                        jwt.verify(req.cookies.refreshToken, config.privateKey);
                        var user = await User.findOne({
                            refreshToken: req.cookies.refreshToken,
                        });
                    } catch (er) {
                        error = er;
                    }
                    console.dir(error);
                    if (user && !error) {
                        var accessToken = jwt.sign(user.dataToJWT, config.privateKey, {
                            expiresIn: "30m",
                        });
                        var refreshToken = jwt.sign({
                            rand: uuidv4()
                        }, config.privateKey, {
                            expiresIn: "30d",
                        });
                        user.refreshToken = refreshToken;
                        res.cookie("accessToken", accessToken);
                        res.cookie("refreshToken", refreshToken);
                        req.user = user.dataToJWT;
                        await user.save();
                    } else {
                        res.clearCookie("accessToken");
                        res.clearCookie("refreshToken");
                        res.redirect("/auth/vk");
                        return;
                    }
                }
            }
            next();
        })();
    });
}