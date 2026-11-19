import mongoose from '../Config/db.js';

export { User as default, User } from '../model/index.js';
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },

    email: {
        type: String,
        required: true,
        unique: true,
    },

    password: {
        type: String,
        required: true,
    },

    // Add the new fields here
});
