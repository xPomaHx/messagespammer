var jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');
const config = require(appRoot + '/config');
const User = require(appRoot + '/models/User.js');
module.exports = function(req, res, next) {
    (async () => {
        res.logout = function() {
            res.clearCookie("accessToken");
            res.clearCookie("refreshToken");
        };
        res.refreshTokens = async function(user) {
            var accessToken = jwt.sign(user.dataToJWT, config.privateKey, {
                // expiresIn: "30m",
                expiresIn: "60s",
            });
            var refreshToken = jwt.sign({
                rand: uuidv4()
            }, config.privateKey, {
                expiresIn: "30d",
            });
            user.refreshToken = refreshToken;
            var cookieConf = {
                httpOnly: true,
                //secure: true
            };
            res.cookie("accessToken", accessToken, cookieConf);
            res.cookie("refreshToken", refreshToken, cookieConf);
            req.user = user.dataToJWT;
            await user.save();
        };
        if (!req.cookies.accessToken) {
            next();
            return;
        }
        var isATerror = false;
        try {
            req.user = jwt.verify(req.cookies.accessToken, config.privateKey);
        } catch (er) {
            isATerror = true;
        }
        if (!isATerror) {
            next();
            return;
        }
        var isRTerror = false;
        try {
            jwt.verify(req.cookies.refreshToken, config.privateKey);
            var user = await User.findOne({
                refreshToken: req.cookies.refreshToken,
            });
        } catch (er) {
            isRTerror = true;
        }
        if (user && !isRTerror) {
            await res.refreshTokens(user);
        } else {
            res.logout();
            res.redirect("/auth/vk");
        }
        next();
        return;
    })();
}