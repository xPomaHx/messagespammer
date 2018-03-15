var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
    id: {
        type: Number,
        unique: true,
        index: true,
    },
    money: {
        type: Number,
        default: 20,
    },
    ref_id: Number,
    first_name: String,
    last_name: String,
    photo_max_orig: String,
    refreshToken: String,
    token: String,
});
userSchema.virtual('dataToJWT').get(function() {
    return {
        id: this.id,
        money: this.money,
        ref_id: this.ref_id,
        first_name: this.first_name,
        last_name: this.last_name,
        photo_max_orig: this.photo_max_orig,
        token: this.token,
    };
});
module.exports = mongoose.model('User', userSchema);