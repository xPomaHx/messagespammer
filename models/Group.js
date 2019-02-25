const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const groupSchema = new Schema({
    id: {
        type: Number,
        unique: true,
        index: true,
    },
    confirmationCode: String,
    tokens: Array,
    user_ids: Array,
    user_ids_clear: Array,
});
module.exports = mongoose.model('Group', groupSchema);