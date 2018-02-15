const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const taskSchema = new Schema({
    group_id: {
        type: Number,
    },
    date: {
        type: Date
    },
    user_id: Number,
    message: String,
    attachment: String,
    random_id: Number,
    isDone: {
        type: Boolean,
        default: false,
    },
    test: {
        type: Boolean,
        default: false,
    }
});
module.exports = mongoose.model('Task', taskSchema);