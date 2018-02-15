"use strict";
process.setMaxListeners(0);
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});
const express = require('express');
const mongoose = require('mongoose');
mongoose.connect("mongodb://localhost/vkspammer");
const app = express();
require('./middleware')(app);
require('./routes')(app);
require('./taskworker')();
app.listen(9999);