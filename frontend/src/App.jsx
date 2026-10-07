import { useEffect, useRef, useState } from "react";
import socket from "./socket";
import {
  createPeerConnection,
  addIceCandidateSafely,
  flushPendingIceCandidates,
} from "./webrtc";

function App() {
  const [showCreate, setShowCreate] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const [classroom, setClassroom] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [activeClassroom, setActiveClassroom] = useState(null);
  

  const [showJoin, setShowJoin] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinedClassroom, setJoinedClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsByRoom, setStudentsByRoom] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [resourcesByRoom, setResourcesByRoom] = useState({});
  const [receivedResources, setReceivedResources] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");



  const [detailsByRoom, setDetailsByRoom] = useState({});

  const classroomRef = useRef(null);
  const joinedClassroomRef = useRef(null);

  const peerConnections = useRef(new Map());
  const dataChannels = useRef(new Map());
  const fileTransfers = useRef(new Map());

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to DataLynk server:", socket.id);
    });

    socket.on("student-joined", async (student) => {
      const currentRoomCode = student.roomCode;

      console.log(
        "Student joined classroom:",
        currentRoomCode
      );

    console.log("Student joined:", student);

    setStudents((currentStudents) => {
      const exists = currentStudents.some(
        (item) =>
          item.id === student.id &&
          item.roomCode === student.roomCode
      );

      if (exists) return currentStudents;

      return [...currentStudents, student];
    });


    setStudentsByRoom((current) => {
      const roomStudents = current[student.roomCode] || [];

      const exists = roomStudents.some(
        (item) => item.id === student.id
      );

      if (exists) return current;

      return {
        ...current,
        [student.roomCode]: [...roomStudents, student],
      };
    });

    // Create WebRTC connection with the student
    const peer = await createPeerConnection({
      targetId: student.id,
      socket,
      roomCode: student.roomCode,
      onDataChannel: (channel) => {
        console.log("DataChannel ready with:", student.name);

        channel.onopen = () => {
          console.log("DataChannel OPEN with:", student.name);
        };

        channel.onclose = () => {
          console.log("DataChannel CLOSED with:", student.name);
        };
      },
      onConnectionStateChange: (state) => {
        console.log(
          `Connection with ${student.name}:`,
          state
        );
      },
    });

    // Store the connection using classroom + student ID
    const peerKey = `${student.roomCode}:${student.id}`;
    peerConnections.current.set(peerKey, peer);

    // Create DataChannel
    const channel = peer.createDataChannel("datalynk");

    const channelKey = `${student.roomCode}:${student.id}`;

    dataChannels.current.set(channelKey, channel);

    channel.onopen = () => {
    console.log(
      "Teacher DataChannel OPEN with:",
      student.name
    );

    channel.send(
      JSON.stringify({
        type: "test",
        message: "Hello from DataLynk Teacher!",
      })
    );
  };

    channel.onclose = () => {
      console.log(
        "Teacher DataChannel CLOSED with:",
        student.name
      );
    };

    // Create WebRTC offer
    const offer = await peer.createOffer();

    await peer.setLocalDescription(offer);

    // Send offer through Socket.IO
    socket.emit("webrtc-offer", {
      target: student.id,
      offer: peer.localDescription,
      roomCode: student.roomCode,
    });

    console.log(
      "WebRTC offer sent to:",
      student.name
    );
  });




  // STUDENT: RECEIVE WEBRTC OFFER
  socket.on("webrtc-offer", async ({ sender, offer, roomCode }) => {
    console.log("WebRTC offer received from teacher:", sender);

    const peer = await createPeerConnection({
      targetId: sender,
      socket,
      roomCode: roomCode,

      onDataChannel: (channel) => {
        console.log("DataChannel received from teacher");

        channel.onopen = () => {
          console.log("Student DataChannel OPEN");
        };

        channel.binaryType = "arraybuffer";

        channel.onmessage = (event) => {
          // Text message
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data);

            console.log("Message received from teacher:", data);

            if (data.type === "file-metadata") {
              console.log("File metadata received:", data);

              fileTransfers.current.set(data.name, {
                name: data.name,
                size: data.size,
                mimeType: data.mimeType,
                subject: data.subject,
                className: data.className,
                topic: data.topic,
                chunks: [],
                receivedBytes: 0,
              });
            }

            return;
          }

          // Binary file chunk
          const chunk = event.data;

          

          // Get the current file transfer
          const transfers = Array.from(fileTransfers.current.values());

          if (transfers.length === 0) {
            console.warn("Received chunk but no file transfer exists.");
            return;
          }

          const transfer = transfers[transfers.length - 1];

          transfer.chunks.push(chunk);
          transfer.receivedBytes += chunk.byteLength;


          // File completely received
          if (transfer.receivedBytes >= transfer.size) {
            const blob = new Blob(transfer.chunks, {
              type: transfer.mimeType,
            });

            const url = URL.createObjectURL(blob);
            setReceivedResources((currentResources) => [
              ...currentResources,
              {
                name: transfer.name,
                size: transfer.size,
                mimeType: transfer.mimeType,
                subject: transfer.subject,
                className: transfer.className,
                topic: transfer.topic,
                url: url,
              },
            ]);

            console.log("FILE RECEIVED SUCCESSFULLY:", transfer.name);
            console.log("Download URL:", url);

            // URL.revokeObjectURL(url);

            fileTransfers.current.delete(transfer.name);
          }
        };

        channel.onclose = () => {
          console.log("Student DataChannel CLOSED");
        };
      },

      onConnectionStateChange: (state) => {
        console.log("Student WebRTC connection:", state);
      },
    });

    const peerKey = `${roomCode}:${sender}`;
    peerConnections.current.set(peerKey, peer);

    await peer.setRemoteDescription(offer);
    await flushPendingIceCandidates(peer);

    const answer = await peer.createAnswer();

    await peer.setLocalDescription(answer);

    socket.emit("webrtc-answer", {
      target: sender,
      answer: peer.localDescription,
      roomCode: roomCode,
    });

    console.log("WebRTC answer sent to teacher");
  });

  // RECEIVE WEBRTC ANSWER
  socket.on("webrtc-answer", async ({ sender, answer, roomCode }) => {
    const peerKey = `${roomCode}:${sender}`;
    const peer = peerConnections.current.get(peerKey);

    if (!peer) {
      console.error("Peer connection not found for:", sender);
      return;
    }

    await peer.setRemoteDescription(answer);
    await flushPendingIceCandidates(peer);

    console.log("WebRTC answer received from:", sender);
  });

  // RECEIVE ICE CANDIDATES
  socket.on(
    "webrtc-ice-candidate",
    async ({ sender, candidate, roomCode }) => {
    const peerKey = `${roomCode}:${sender}`;
    const peer = peerConnections.current.get(peerKey);

    if (!roomCode) {
      console.warn("ICE candidate missing classroom code.");
      return;
    }

    if (!peer) {
      console.warn("Peer not ready for ICE candidate:", sender);
      return;
    }

    try {
      await addIceCandidateSafely(peer, candidate);
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  });

    socket.on("student-left", (student) => {
      console.log("Student left:", student);

      setStudents((currentStudents) =>
        currentStudents.filter(
          (existingStudent) =>
            !(
              existingStudent.id === student.id &&
              existingStudent.roomCode === student.roomCode
            )
        )
      );

      setStudentsByRoom((current) => ({
        ...current,
        [student.roomCode]: (current[student.roomCode] || []).filter(
          (item) => item.id !== student.id
        ),
      }));
    });

    return () => {
      socket.off("connect");
      socket.off("student-joined");
      socket.off("student-left");

      socket.off("webrtc-offer");
      socket.off("webrtc-answer");
      socket.off("webrtc-ice-candidate");
    };
  }, []);

  const createClassroom = () => {
    if (!teacherName.trim()) {
      alert("Please enter your name");
      return;
    }

    socket.emit(
      "create-classroom",
      { name: teacherName },
      (response) => {
        if (response.success) {
          setClassrooms((currentClassrooms) => {
            if (
              currentClassrooms.some(
                (item) => item.roomCode === response.roomCode
              )
            ) {
              return currentClassrooms;
            }

            return [...currentClassrooms, response];
          });

          setActiveClassroom(response);
          setClassroom(response);
          classroomRef.current = response;
          setShowCreate(false);

          console.log("Classroom created:", response.roomCode);
          console.log("Role:", response.role);
        }
      }
    );
  };

  const joinClassroom = () => {
    if (!studentName.trim()) {
      alert("Please enter your name");
      return;
    }

    if (roomCode.trim().length !== 6) {
      alert("Please enter a valid 6-character classroom code");
      return;
    }

    socket.emit(
      "join-classroom",
      {
        roomCode: roomCode.toUpperCase(),
        name: studentName,
      },
      (response) => {
        if (response.success) {
          setJoinedClassroom(response);
          joinedClassroomRef.current = response;

          setShowJoin(false);

          console.log("Joined classroom:", response.roomCode);
          console.log("Role:", response.role);
        }
      }
    );
  };

  const handleFileSelect = async (event) => {
    if (!activeClassroom) {
      alert("Only the classroom teacher can share resources.");
      return;
    }
    const files = Array.from(event.target.files);

    if (files.length === 0) {
      return;
    }

    setSelectedFiles(files);

    if (activeClassroom) {
      setResourcesByRoom((current) => ({
        ...current,
        [activeClassroom.roomCode]: [
          ...(current[activeClassroom.roomCode] || []),
          ...files,
        ],
      }));
    }

    console.log("Selected files:");

    files.forEach((file) => {
      console.log(file.name, file.size, file.type);
    });

    // Send files one by one
    for (const file of files) {
      for (const [channelKey, channel] of dataChannels.current) {

        const [channelRoomCode, studentId] =
          channelKey.split(":");

        // Only send to students in the ACTIVE classroom
        if (channelRoomCode !== activeClassroom.roomCode) {
          continue;
        }

        if (channel.readyState !== "open") {
          console.warn("DataChannel not open:", studentId);
          continue;
        }

        console.log(
          `Starting file transfer: ${file.name} → ${studentId}`
        );

        // Send metadata for THIS file
        const metadata = {
          type: "file-metadata",
          name: file.name,
          size: file.size,
          mimeType: file.type,
          subject: detailsByRoom[activeClassroom.roomCode]?.subject || "",
          className: detailsByRoom[activeClassroom.roomCode]?.className || "",
          topic: detailsByRoom[activeClassroom.roomCode]?.topic || "",
        };

        channel.send(JSON.stringify(metadata));

        console.log(
          `File metadata sent to student: ${studentId}`,
          metadata
        );

        // Send THIS file
        const chunkSize = 64 * 1024;
        let offset = 0;

        while (offset < file.size) {
          const chunk = await file
            .slice(offset, offset + chunkSize)
            .arrayBuffer();

          channel.send(chunk);

          offset += chunk.byteLength;

          // Prevent DataChannel buffer from becoming too large
          if (channel.bufferedAmount > 1024 * 1024) {
            await new Promise((resolve) => {
              channel.bufferedAmountLowThreshold = 256 * 1024;

              const checkBuffer = () => {
                if (channel.bufferedAmount <= 256 * 1024) {
                  channel.removeEventListener(
                    "bufferedamountlow",
                    checkBuffer
                  );
                  resolve();
                }
              };

              channel.addEventListener(
                "bufferedamountlow",
                checkBuffer
              );

              checkBuffer();
            });
          }
        }

        console.log(
          `FILE SENT SUCCESSFULLY: ${file.name} → ${studentId}`
        );
      }
    }

    // Allow selecting the same files again
    event.target.value = "";
  };


  return (
    <div className="min-h-screen overflow-hidden bg-[#050816] text-white">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-[-200px] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute right-[-150px] top-1/3 h-[450px] w-[450px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="relative z-10 border-b border-white/5 bg-[#050816]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-[#050816] shadow-lg shadow-cyan-400/20">
              D
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Data<span className="text-cyan-400">Lynk</span>
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                Connect • Share • Transfer
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              P2P Network Online
            </span>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-7xl px-6">

        <section className="grid min-h-[calc(85vh-81px)] items-center gap-16 py-12 lg:grid-cols-2">

          {/* LEFT */}
          <div>

            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Classroom P2P Sharing
            </div>

            <h2 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Your classroom.
              <br />
              <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Connected.
              </span>
            </h2>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
              Share notes, documents, code and resources directly between
              teachers and students — without the CR forwarding everything.
            </p>

            {/* Actions */}
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">

              <button
                onClick={() => setShowCreate(true)}
                className="group flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-7 py-4 font-bold text-[#041017] shadow-xl shadow-cyan-400/10 transition hover:-translate-y-1 hover:bg-cyan-300"
              >
                <span className="text-xl">＋</span>
                Create Classroom
                <span className="transition group-hover:translate-x-1">→</span>
              </button>

              <button
                onClick={() => setShowJoin(true)}
                className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 font-bold text-white backdrop-blur-xl transition hover:border-cyan-400/40 hover:bg-white/[0.06]"
              >
                <span>↗</span>
                Join Classroom
              </button>

            </div>

            {/* Small stats */}
            <div className="mt-12 flex flex-wrap gap-8 border-t border-white/5 pt-8">

              <div>
                <p className="text-2xl font-bold">P2P</p>
                <p className="mt-1 text-xs text-slate-500">Direct transfer</p>
              </div>

              <div>
                <p className="text-2xl font-bold">WebRTC</p>
                <p className="mt-1 text-xs text-slate-500">Real-time connection</p>
              </div>

              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="mt-1 text-xs text-slate-500">Central file storage</p>
              </div>

            </div>

          </div>

          {/* RIGHT NETWORK CARD */}
          <div className="relative">

            <div className="absolute -inset-8 rounded-[40px] bg-cyan-400/5 blur-3xl" />

            <div className="relative rounded-[32px] border border-white/10 bg-white/[0.035] p-6 shadow-2xl backdrop-blur-xl">

              {/* Card header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-5">
                <div>
                  <p className="text-sm font-semibold">Classroom Network</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Peer connections
                  </p>
                </div>

                <span className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-400">
                  Ready
                </span>
              </div>

              {/* Network visualization */}
              <div className="relative my-8 h-[300px]">

                {/* Connection lines */}
                <div className="absolute left-1/2 top-1/2 h-[2px] w-[65%] -translate-x-1/2 -translate-y-1/2 rotate-[25deg] bg-gradient-to-r from-cyan-400/60 to-transparent" />

                <div className="absolute left-1/2 top-1/2 h-[2px] w-[65%] -translate-x-1/2 -translate-y-1/2 rotate-[-25deg] bg-gradient-to-r from-cyan-400/60 to-transparent" />

                <div className="absolute left-1/2 top-1/2 h-[2px] w-[65%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-cyan-400/60 to-transparent" />

                {/* Teacher */}
                <div className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border border-cyan-300/30 bg-cyan-400/10 shadow-2xl shadow-cyan-400/20">
                  <div className="text-center">
                    <div className="text-3xl">👨‍🏫</div>
                    <p className="mt-1 text-[10px] font-bold text-cyan-300">
                      ADMIN
                    </p>
                  </div>
                </div>

                {/* Students */}
                <div className="absolute left-2 top-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
                  👨‍🎓
                </div>

                <div className="absolute right-2 top-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
                  👩‍🎓
                </div>

                <div className="absolute bottom-6 left-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
                  👨‍💻
                </div>

                <div className="absolute bottom-6 right-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-900">
                  👩‍💻
                </div>

              </div>

            

            </div>

          </div>

        </section>

        {/* Bottom feature strip */}
        <section className="grid gap-4 pb-8 md:grid-cols-3">

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
              ⚡
            </div>
            <h3 className="font-bold">Direct Transfer</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Resources move directly between connected peers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400">
              🔐
            </div>
            <h3 className="font-bold">Teacher Controlled</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Only the classroom admin can publish resources.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/10 text-purple-400">
              📡
            </div>
            <h3 className="font-bold">Real-Time Network</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Students connect to the classroom in real time.
            </p>
          </div>

        </section>

            

        {/* How DataLynk Works */}
        <section className="mt-20 pb-16">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Simple Workflow
            </p>

            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
              How DataLynk Works
            </h2>

            <p className="mt-3 text-slate-400">
              Share classroom resources in just three simple steps.
            </p>
          </div>

          <div className="relative grid gap-6 md:grid-cols-3">
            <div className="pointer-events-none absolute left-[32%] right-[32%] top-[50%] hidden h-px bg-gradient-to-r from-cyan-400/20 via-cyan-400/60 to-cyan-400/20 md:block" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-400 ring-1 ring-cyan-400/20">
                01
              </div>
              <h3 className="mt-3 text-xl font-semibold text-white">
                Create Classroom
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Teacher creates a temporary classroom and gets a unique room code.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-400 ring-1 ring-cyan-400/20">
                02
              </div>
              <h3 className="mt-3 text-xl font-semibold text-white">
                Students Join
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Students join using the room code or QR code.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/30 hover:bg-white/[0.05]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-400 ring-1 ring-cyan-400/20">
                03
              </div>
              <h3 className="mt-3 text-xl font-semibold text-white">
                Share Directly
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Teacher shares resources directly with connected students.
              </p>
            </div>
          </div>
        </section>
        

      

      </main>
      <footer className="border-t border-white/5 py-8 text-center">
        <p className="text-sm text-slate-500">
          © 2026 Data<span className="text-cyan-400">Lynk</span> •
          Connect • Share • Transfer
        </p>
      </footer>
      

      {showCreate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1124] p-8 shadow-2xl">

            <h2 className="text-2xl font-bold">
              Create Classroom
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Enter your name to create a classroom.
            </p>

            <input
              type="text"
              placeholder="Teacher name"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 font-semibold text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>

              <button
                onClick={createClassroom}
                className="flex-1 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-[#041017] hover:bg-cyan-300"
              >
                Create
              </button>
            </div>

          </div>
        </div>
      )}

      {classroom && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050816]">

          {/* Header */}
          <header className="border-b border-white/5 bg-[#050816]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-[#050816]">
                  D
                </div>

                <div>
                  <h1 className="text-xl font-bold">
                    Data<span className="text-cyan-400">Lynk</span>
                  </h1>

                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                    Teacher Dashboard
                  </p>
                </div>
              </div>

              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs text-cyan-300">
                👨‍🏫 ADMIN
              </span>

              <button
                type="button"
                onClick={() => {
                  setClassroom(null);
                  setActiveClassroom(null);
                }}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
              >
                ← Home
              </button>

            </div>
          </header>

          {/* Dashboard */}
          <main className="mx-auto max-w-7xl px-6 py-10">

            {/* Classroom Header */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 backdrop-blur-xl">

              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <p className="text-sm text-slate-500">
                    Welcome, {teacherName}
                  </p>

                  <h2 className="mt-2 text-4xl font-black">
                    Your Classroom
                  </h2>

                  <p className="mt-2 text-slate-400">
                    Share resources directly with your students.
                  </p>
                </div>

                {/* Room Code */}
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-8 py-5 text-center">
                  <p className="text-xs text-slate-500">
                    CLASSROOM CODE
                  </p>

                  <p className="mt-2 text-3xl font-black tracking-[0.25em] text-cyan-300">
                    {activeClassroom?.roomCode}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Share this code with students
                  </p>
                </div>

              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="relative z-[100] cursor-pointer rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-[#041017] hover:bg-cyan-300"
              >
                ＋ Create Another Classroom
              </button>
            </div>

            <div className="mt-6 flex overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
              {classrooms.map((item, index) => (
                <button
                  key={item.roomCode}
                  type="button"
                  onClick={() => {
                    setActiveClassroom(item);
                    setClassroom(item);
                    setSelectedFiles(resourcesByRoom[item.roomCode] || []);
                    setStudents(studentsByRoom[item.roomCode] || []);
                  }}
                  className={`min-w-[150px] px-6 py-4 text-sm font-semibold transition ${
                    activeClassroom?.roomCode === item.roomCode
                      ? "bg-cyan-400 text-[#041017]"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  Classroom {index + 1}
                </button>
              ))}
            </div>

            {/* Dashboard Grid */}
            <div className="mt-8 grid gap-6 lg:grid-cols-3">

              {/* Share Resources */}
              <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.035] p-8">

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      Share Resources
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Only you can share resources with this classroom.
                    </p>
                  </div>

                  <span className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400">
                    TEACHER CONTROLLED
                  </span>
                </div>

                {/* Upload Area */}
                <div className="mt-8 rounded-2xl border border-dashed border-cyan-400/20 bg-cyan-400/[0.02] p-12 text-center">

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-3xl">
                    📁
                  </div>

                  <h4 className="mt-5 text-lg font-bold">
                    Select Resources
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    PDF, PPT, DOCX, ZIP, images, videos and source code
                  </p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Subject"
                      value={detailsByRoom[activeClassroom?.roomCode]?.subject || ""}
                      onChange={(e) => {
                        const value = e.target.value;

                        setDetailsByRoom((current) => ({
                          ...current,
                          [activeClassroom.roomCode]: {
                            ...(current[activeClassroom.roomCode] || {}),
                            subject: value,
                          },
                        }));
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
                    />

                    <input
                      type="text"
                      placeholder="Class"
                      value={detailsByRoom[activeClassroom?.roomCode]?.className || ""}
                      onChange={(e) => {
                        const value = e.target.value;

                        setDetailsByRoom((current) => ({
                          ...current,
                          [activeClassroom.roomCode]: {
                            ...(current[activeClassroom.roomCode] || {}),
                            className: value,
                          },
                        }));
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
                    />

                    <input
                      type="text"
                      placeholder="Topic"
                      value={detailsByRoom[activeClassroom?.roomCode]?.topic || ""}
                      onChange={(e) => {
                        const value = e.target.value;

                        setDetailsByRoom((current) => ({
                          ...current,
                          [activeClassroom.roomCode]: {
                            ...(current[activeClassroom.roomCode] || {}),
                            topic: value,
                          },
                        }));
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
                    />
                  </div>

                  <label
                    htmlFor="resource-files"
                    className="mt-6 inline-block cursor-pointer rounded-xl bg-cyan-400 px-6 py-3 font-bold text-[#041017] transition hover:bg-cyan-300"
                  >
                    Select Files
                  </label>

                  <input
                    id="resource-files"
                    type="file"
                    multiple
                    accept=".pdf,.ppt,.pptx,.doc,.docx,.txt,.zip,.rar,.png,.jpg,.jpeg,.gif,.mp4,.webm,.js,.jsx,.ts,.tsx,.java,.py,.c,.cpp,.html,.css"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                </div>

              </div>

              {/* Connected Students */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8">

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">
                      Students
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Connected to classroom
                    </p>
                  </div>

                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-sm font-bold text-cyan-300">
                    {students.filter(
                      (student) => student.roomCode === activeClassroom?.roomCode
                    ).length}
                  </span>
                </div>

                {/* Empty State */}
                {students.filter(
                  (student) => student.roomCode === activeClassroom?.roomCode
                ).length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-white/5 bg-black/10 py-12 text-center">

                    <div className="text-4xl">
                      👨‍🎓
                    </div>

                    <p className="mt-4 font-semibold">
                      Waiting for students
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Share the classroom code to let students join.
                    </p>

                  </div>
                ) : (
                  <div className="mt-6 space-y-3">

                    {students
                      .filter((student) => student.roomCode === activeClassroom?.roomCode)
                      .map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-4"
                      >

                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
                          👨‍🎓
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {student.name}
                          </p>

                          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Connected
                          </p>
                        </div>

                      </div>
                    ))}

                  </div>
                )}

              </div>

            </div>

            {/* Resources List */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-8">

              <div>
                <h3 className="text-xl font-bold">
                  Shared Resources
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Resources shared with this classroom. Only the teacher can upload resources.
                </p>
              </div>

              {selectedFiles.length === 0 ? (
                <>
                  <div className="text-4xl">
                    📚
                  </div>

                  <p className="mt-4 font-semibold">
                    No resources shared yet
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Select files above to share them with your students.
                  </p>
                </>
              ) : (
                <div className="space-y-3 px-4">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10">
                          📄
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {file.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>

                      <span className="ml-4 shrink-0 rounded-lg bg-emerald-400/10 px-3 py-1 text-xs text-emerald-400">
                        READY
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>

          </main>

        </div>
      )}



     {showJoin && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6 backdrop-blur-md">
              <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b1124] p-8 shadow-2xl">

                <h2 className="text-2xl font-bold">
                  Join Classroom
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Enter your name and classroom code.
                </p>

                <input
                  type="text"
                  placeholder="Your name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="mt-6 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                />

                <input
                  type="text"
                  placeholder="Classroom code"
                  maxLength={6}
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase())
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 uppercase tracking-[0.3em] text-white outline-none placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-400/50"
                />

                <div className="mt-6 flex gap-3">

                  <button
                    onClick={() => setShowJoin(false)}
                    className="flex-1 rounded-xl border border-white/10 px-4 py-3 font-semibold text-slate-300 hover:bg-white/5"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={joinClassroom}
                    className="flex-1 rounded-xl bg-cyan-400 px-4 py-3 font-bold text-[#041017] hover:bg-cyan-300"
                  >
                    Join
                  </button>

                </div>

              </div>
            </div>
          )}
        {joinedClassroom && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050816]">
              
              {/* Header */}
              <header className="border-b border-white/5 bg-[#050816]/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
                  
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 font-black text-[#050816]">
                      D
                    </div>

                    <div>
                      <h1 className="text-xl font-bold">
                        Data<span className="text-cyan-400">Lynk</span>
                      </h1>

                      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        Student Classroom
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-xs text-emerald-400">
                    ● Connected
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setJoinedClassroom(null);
                      setSearchQuery("");
                    }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400/40 hover:bg-white/5"
                  >
                    ← Home
                  </button>

                </div>
              </header>

              {/* Classroom Content */}
              <main className="mx-auto max-w-5xl px-6 py-12">

                {/* Classroom Info */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 backdrop-blur-xl">

                  <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

                    <div>
                      <p className="text-sm text-slate-500">
                        Welcome, {studentName}
                      </p>

                      <h2 className="mt-2 text-3xl font-black">
                        Classroom
                      </h2>

                      <p className="mt-2 text-slate-400">
                        Teacher: {joinedClassroom.adminName}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-8 py-5 text-center">
                      <p className="text-xs text-slate-500">
                        CLASSROOM CODE
                      </p>

                      <p className="mt-2 text-3xl font-black tracking-[0.25em] text-cyan-300">
                        {joinedClassroom.roomCode}
                      </p>
                    </div>

                  </div>
                </div>


                {/* Resources */}
                <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-8">

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold">
                        Classroom Resources
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Resources shared by your teacher will appear here.
                      </p>
                    </div>

                    <span className="rounded-lg bg-cyan-400/10 px-3 py-2 text-xs text-cyan-300">
                      STUDENT
                    </span>
                  </div>
                  <div className="mb-6">
                    <input
                      type="text"
                      placeholder="Search resources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
                    />
                  </div>

                  {/* Empty State */}
                  {receivedResources.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-dashed border-white/10 py-16 text-center">
                      <div className="text-5xl">📂</div>

                      <h4 className="mt-4 text-lg font-bold">
                        No resources yet
                      </h4>

                      <p className="mt-2 text-sm text-slate-500">
                        Waiting for the teacher to share resources...
                      </p>
                    </div>
                  ) : (
                    <div className="mt-8 space-y-4">
                      {receivedResources
                        .filter((resource) => {
                          const query = searchQuery.toLowerCase().trim();

                          if (!query) return true;

                          return (
                            resource.name?.toLowerCase().includes(query) ||
                            resource.subject?.toLowerCase().includes(query) ||
                            resource.className?.toLowerCase().includes(query) ||
                            resource.topic?.toLowerCase().includes(query)
                          );
                        })
                        .map((resource, index) => (
                        <div
                          key={`${resource.name}-${index}`}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-2xl">
                              📄
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {resource.name}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                Subject: {resource.subject}
                              </p>

                              <p className="text-xs text-slate-400">
                                Class: {resource.className}
                              </p>

                              <p className="text-xs text-slate-400">
                                Topic: {resource.topic}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {(resource.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>

                          <a
                            href={resource.url}
                            download={resource.name}
                            className="ml-4 shrink-0 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-[#041017] hover:bg-cyan-300"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </main>
            </div>
          )}

    </div>
  );
}

export default App;