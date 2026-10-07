const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Store active classrooms
const classrooms = new Map();

// Generate 6-character room code
function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += characters.charAt(
      Math.floor(Math.random() * characters.length)
    );
  }

  return code;
}

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "DataLynk server is running 🚀",
  });
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE CLASSROOM
  socket.on("create-classroom", ({ name }, callback) => {
    let roomCode;

    do {
      roomCode = generateRoomCode();
    } while (classrooms.has(roomCode));

    const classroom = {
      code: roomCode,
      admin: socket.id,
      adminName: name || "Teacher",
      students: [],
    };

    classrooms.set(roomCode, classroom);

    // Teacher can belong to multiple classrooms
    socket.join(roomCode);

    if (!socket.data.classrooms) {
      socket.data.classrooms = new Set();
    }

    socket.data.classrooms.add(roomCode);
    socket.data.role = "admin";
    socket.data.name = name || "Teacher";

    console.log(`Classroom created: ${roomCode}`);
    console.log(`Admin: ${socket.data.name}`);

    callback({
      success: true,
      roomCode,
      role: "admin",
      classrooms: Array.from(socket.data.classrooms),
    });
  });

  // JOIN CLASSROOM
  socket.on("join-classroom", ({ roomCode, name }, callback) => {
    const code = roomCode?.toUpperCase().trim();

    const classroom = classrooms.get(code);

    if (!classroom) {
      callback({
        success: false,
        message: "Classroom not found.",
      });

      return;
    }

    const student = {
      id: socket.id,
      name: name || "Student",
    };

    classroom.students.push(student);

    socket.join(code);

    socket.data.roomCode = code;
    socket.data.role = "student";
    socket.data.name = student.name;

    console.log(`${student.name} joined classroom ${code}`);

    callback({
      success: true,
      roomCode: code,
      role: "student",
      adminName: classroom.adminName,
      students: classroom.students,
    });

    // Only students in THIS classroom receive the event
    socket.to(code).emit("student-joined", {
      id: socket.id,
      name: student.name,
      roomCode: code,
    });
  });

  // WEBRTC OFFER
  socket.on("webrtc-offer", ({ target, offer, roomCode }) => {
    console.log(
      `WebRTC offer: ${socket.id} → ${target} | Room: ${roomCode}`
    );

    const classroom = classrooms.get(roomCode);

    if (!classroom) {
      console.warn("Invalid classroom for WebRTC offer:", roomCode);
      return;
    }

    if (classroom.admin !== socket.id) {
      console.warn("Unauthorized WebRTC offer attempt.");
      return;
    }

    const studentExists = classroom.students.some(
      (student) => student.id === target
    );

    if (!studentExists) {
      console.warn("Student does not belong to classroom:", target);
      return;
    }

    socket.to(target).emit("webrtc-offer", {
      sender: socket.id,
      offer,
      roomCode,
    });
  });

  // WEBRTC ANSWER
  socket.on("webrtc-answer", ({ target, answer, roomCode }) => {
    console.log(
      `WebRTC answer: ${socket.id} → ${target} | Room: ${roomCode}`
    );

    const classroom = classrooms.get(roomCode);

    if (!classroom) {
      console.warn("Invalid classroom for WebRTC answer:", roomCode);
      return;
    }

    const studentBelongsToRoom = classroom.students.some(
      (student) => student.id === socket.id
    );

    if (!studentBelongsToRoom || classroom.admin !== target) {
      console.warn("Unauthorized WebRTC answer attempt.");
      return;
    }

    socket.to(target).emit("webrtc-answer", {
      sender: socket.id,
      answer,
      roomCode,
    });
  });

  // WEBRTC ICE CANDIDATE
  socket.on(
    "webrtc-ice-candidate",
    ({ target, candidate, roomCode }) => {
      const classroom = classrooms.get(roomCode);

      if (!classroom) {
        console.warn("Invalid classroom for ICE candidate:", roomCode);
        return;
      }

      const socketBelongsToRoom =
        classroom.admin === socket.id ||
        classroom.students.some(
          (student) => student.id === socket.id
        );

      const targetBelongsToRoom =
        classroom.admin === target ||
        classroom.students.some(
          (student) => student.id === target
        );

      if (!socketBelongsToRoom || !targetBelongsToRoom) {
        console.warn("Blocked ICE candidate across classrooms.");
        return;
      }

      socket.to(target).emit("webrtc-ice-candidate", {
        sender: socket.id,
        candidate,
        roomCode,
      });
    }
  );

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // ADMIN LEFT → CLOSE ALL CLASSROOMS CREATED BY THIS TEACHER
    if (
      socket.data.role === "admin" &&
      socket.data.classrooms
    ) {
      for (const roomCode of socket.data.classrooms) {
        const classroom = classrooms.get(roomCode);

        if (!classroom) {
          continue;
        }

        console.log(`Admin left. Closing classroom ${roomCode}`);

        io.to(roomCode).emit("classroom-closed", {
          message: "The teacher has closed the classroom.",
        });

        classrooms.delete(roomCode);
      }

      return;
    }

    // STUDENT LEFT
    const roomCode = socket.data.roomCode;

    if (!roomCode) {
      return;
    }

    const classroom = classrooms.get(roomCode);

    if (!classroom) {
      return;
    }

    classroom.students = classroom.students.filter(
      (student) => student.id !== socket.id
    );

    socket.to(roomCode).emit("student-left", {
      id: socket.id,
      name: socket.data.name,
      roomCode: roomCode,
    });
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(
    `DataLynk server running on http://localhost:${PORT}`
  );
});