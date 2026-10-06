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

    socket.join(roomCode);

    socket.data.roomCode = roomCode;
    socket.data.role = "admin";
    socket.data.name = name || "Teacher";

    console.log(`Classroom created: ${roomCode}`);
    console.log(`Admin: ${socket.data.name}`);

    callback({
      success: true,
      roomCode,
      role: "admin",
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

    // Tell the new student their classroom information
    callback({
      success: true,
      roomCode: code,
      role: "student",
      adminName: classroom.adminName,
      students: classroom.students,
    });

    // Tell everyone else that a new student joined
    socket.to(code).emit("student-joined", {
      id: socket.id,
      name: student.name,
    });
  });
    // WEBRTC OFFER
    socket.on("webrtc-offer", ({ target, offer }) => {
        console.log(`WebRTC offer: ${socket.id} → ${target}`);

        socket.to(target).emit("webrtc-offer", {
        sender: socket.id,
        offer,
        });
    });

    // WEBRTC ANSWER
    socket.on("webrtc-answer", ({ target, answer }) => {
        console.log(`WebRTC answer: ${socket.id} → ${target}`);

        socket.to(target).emit("webrtc-answer", {
        sender: socket.id,
        answer,
        });
    });

    // WEBRTC ICE CANDIDATE
    socket.on("webrtc-ice-candidate", ({ target, candidate }) => {
        socket.to(target).emit("webrtc-ice-candidate", {
        sender: socket.id,
        candidate,
        });
    });

  // DISCONNECT
  socket.on("disconnect", () => {
    const roomCode = socket.data.roomCode;

    console.log("User disconnected:", socket.id);

    if (!roomCode) {
      return;
    }

    const classroom = classrooms.get(roomCode);

    if (!classroom) {
      return;
    }

    // ADMIN LEFT → CLOSE CLASSROOM
    if (socket.data.role === "admin") {
      console.log(`Admin left. Closing classroom ${roomCode}`);

      io.to(roomCode).emit("classroom-closed", {
        message: "The teacher has closed the classroom.",
      });

      classrooms.delete(roomCode);

      return;
    }

    // STUDENT LEFT
    classroom.students = classroom.students.filter(
      (student) => student.id !== socket.id
    );

    socket.to(roomCode).emit("student-left", {
      id: socket.id,
      name: socket.data.name,
    });
  });
});

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`DataLynk server running on http://localhost:${PORT}`);
});