const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const PORT = process.env.PORT || 4000;

const Room = require("./chat.model");
const User = require("./user.model");
const LiveRoom = require("./livechat.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.get("/", (req, res) => {
  res.send("Chat Server is Working!");
});

const uri = process.env.ATLAS_URI;
mongoose.connect(uri);

io.on("connection", (socket) => {
  let totalChats = 0; // 100
  let pageSize = 10;
  let totalPages = 0; // 10
  let currentPage = totalPages; // 10
  let skip = 0;
  let oldstart = 0;
  socket.on("joinroom", async ({ user_id, room_id }) => {
    try {
      const user = await User.findById(user_id);
      const room = await Room.findOne({ room_admin: room_id });
      totalChats = room ? room.chats.length : 0; // 100
      totalPages = Math.ceil(totalChats / pageSize) || 1; //10
      currentPage = totalPages;
      skip = Math.abs((currentPage - totalPages) * pageSize);
      // console.log("total "+ totalChats);
      // console.log("Pages "+ totalPages);
      // console.log(skip)

      let chats = [];
      oldstart = currentPage * pageSize - pageSize;
      if (room && user) {
        for (var i = oldstart; i < totalChats - skip; i++) {
          // console.log(i)
          const u = await User.findById(room.chats[i].user_id).select({
            username: 1,
            profile_image: 1,
          });
          let chattemp = {
            _id: room.chats[i]._id,
            user_id: room.chats[i].user_id,
            username: u.username,
            profile_image: u.profile_image,
            type: room.chats[i].type,
            message: room.chats[i].message,
            createdAt: room.chats[i].createdAt,
          };
          if (room.chats[i].url) {
            chattemp.url = room.chats[i].url;
          }
          if (room.chats[i].reply_to) {
            chattemp.reply_to = room.chats[i].reply_to;
          }
          chats.push(chattemp);
        }
        await socket.join(room_id);
        socket.emit("init", { chats, currentPage, totalPages });
      } else {
        const room_user = await User.findOne({ username: room_id });
        console.log("getting room user");
        if (user && room_user) {
          const withoutroom = await Room.create({
            room_admin: room_user.username,
            room_admin_userid: room_user.id,
            chats: [],
          });
          socket.emit("init", {
            chats: withoutroom.chats,
            currentPage,
            totalPages,
          });
        }
      }
    } catch (error) {
      console.log(error);
    }
  });
  socket.on("loadmore", async ({ user_id, room_id, page_no }) => {
    const user = await User.findById(user_id);
    // const room_user = await User.findOne({ username: room_id });
    const room = await Room.findOne({ room_admin: room_id });

    totalChats = room ? room.chats.length : 0; // 100
    totalPages = Math.ceil(totalChats / pageSize) || 1; //10
    currentPage = page_no; //9
    skip = Math.abs((currentPage - totalPages) * pageSize); // 10
    // console.log("total "+ totalChats);
    // console.log("Pages "+ totalPages);
    // console.log(skip)
    // console.log(oldstart);

    let chats = [];
    x = currentPage * pageSize - pageSize;
    if (x < 0) {
      x = 0;
    }

    if (room && user) {
      // console.log("X "+x)
      // console.log("oldstart "+oldstart)

      for (var i = x; i < oldstart; i++) {
        // console.log(i)
        const u = await User.findById(room.chats[i].user_id).select({
          username: 1,
          profile_image: 1,
        });

        let chattemp = {
          _id: room.chats[i]._id,
          user_id: room.chats[i].user_id,
          username: u.username,
          profile_image: u.profile_image,
          type: room.chats[i].type,
          message: room.chats[i].message,
          createdAt: room.chats[i].createdAt,
        };
        if (room.chats[i].url) {
          chattemp.url = room.chats[i].url;
        }
        if (room.chats[i].reply_to) {
          chattemp.reply_to = room.chats[i].reply_to;
        }
        chats.push(chattemp);
      }
      oldstart = x;
      // await socket.join(room_user._id.toString());
      socket.emit("getmore", { chats, totalPages, currentPage });
    }
  });
  socket.on("chatMessage", async ({ chat, room_admin }) => {
    try {
      const msgId = new mongoose.Types.ObjectId();
      let c = {
        _id: msgId,
        user_id: chat.user_id,
        type: chat.type,
        message: chat.message,
        createdAt: chat.createdAt,
      };
      if (chat.url) {
        c.url = chat.url;
      }
      if (chat.reply_to) {
        c.reply_to = chat.reply_to;
      }
      Room.findOneAndUpdate(
        { room_admin: room_admin },
        {
          $push: {
            chats: c,
          },
        },
        async function (error, success) {
          if (error) {
            console.log(error);
          } else {
            const u = await User.findById(c.user_id).select({
              username: 1,
              profile_image: 1,
            });
            c.username = u.username;
            c.profile_image = u.profile_image;
            io.to(room_admin).emit("message", c);
          }
        }
      );
    } catch (error) {
      console.log(error);
    }
  });

  // For Live Chat
  socket.on("live_joinroom", async ({ user_id, room_id }) => {
    const user = await User.findById(user_id);
    const room_user = await User.findONe({ username: room_id });
    const room = await LiveRoom.findOne({ room_admin: room_user._id });
    if (room && user) {
      await socket.join("live_" + room_user._id.toString());
      socket.emit("live_init", room.chats);
    } else if (user && room_user) {
      const withoutroom = await LiveRoom.create({
        room_admin: room_user._id,
        chats: [],
      });
      socket.emit("live_init", withoutroom.chats);
    }
  });
  socket.on("live_chatMessage", async ({ chat, room_admin }) => {
    try {
      const msgId = new mongoose.Types.ObjectId();
      let c = {
        _id: msgId,
        user_id: chat.user_id,
        username: chat.username,
        profile_image: chat.profile_image,
        type: chat.type,
        message: chat.message,
        createdAt: chat.createdAt,
      };
      if (chat.reply_to) {
        c.reply_to = chat.reply_to;
      }
      console.log(c);
      LiveRoom.findOneAndUpdate(
        { room_admin: room_admin },
        {
          $push: {
            chats: c,
          },
        },
        function (error, success) {
          if (error) {
            console.log(error);
          } else {
            console.log();
            io.to("live_" + room_admin.toString()).emit("live_message", c);
          }
        }
      );
    } catch (error) {
      console.log(error);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
