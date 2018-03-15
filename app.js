"use strict";
process.setMaxListeners(0);
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
global.appRoot = __dirname;
const express = require('express');
const mongoose = require('mongoose');
mongoose.connect("mongodb://localhost/vkspammer", {
    keepAlive: 360000,
    connectTimeoutMS: 360000,
    socketTimeoutMS: 360000
});
mongoose.connection.on('error', function() {
    console.dir("dberror");
    console.dir(arguments);
});
//mongoose.set("debug",true);
const app = express();
require('./middleware')(app);
require('./routes')(app);
require('./taskworker')();
app.listen(9999, () => {
    console.dir("ready!");
});