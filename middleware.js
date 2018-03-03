const dotengine = require("express-dot-engine");
const express = require("express");
const path = require("path");
const cookieParser = require('cookie-parser');
const bodyParser = require("body-parser");
var User = require(appRoot + "/models/User.js");
const config = require(appRoot + "/config");
var broJWTAuth = require(appRoot + '/helpers/broJWTAuth');
//reqend
module.exports = function(app) {
    app.disable('x-powered-by');
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
        res.debug = [];
        next();
    });
    app.use(broJWTAuth);
}