const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const chatSchema = Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  username: {
    type: String,
  },
  profile_image: {
    type: String,
  },
  type: {
    type: String,
    required: true,
    default: "text",
  },
  message: {
    type: String,
  },
  url: {
    type: String,
  },
  reply_to: {
    type: Object,
  },
  createdAt: {
    type: Date,
    required: true,
  },
});

const roomSchema = Schema({
  room_admin: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  chats: [chatSchema],
});

const LiveRoom = mongoose.model("LiveRoom", roomSchema);
module.exports = LiveRoom;
