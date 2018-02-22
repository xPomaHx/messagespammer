var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
    id: {
        type: Number,
        unique: true,
    },
    money: {
        type: Number,
        default: 20,
    },
    ref_id: Number,
    communitiesToken: [{
        id: {
            type: Number,
        },
        token: String,
    }],
    token: String,
});
module.exports = mongoose.model('User', userSchema);