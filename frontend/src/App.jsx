function App() {
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

        <section className="grid min-h-[calc(100vh-81px)] items-center gap-16 py-16 lg:grid-cols-2">

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

              <button className="group flex items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-7 py-4 font-bold text-[#041017] shadow-xl shadow-cyan-400/10 transition hover:-translate-y-1 hover:bg-cyan-300">
                <span className="text-xl">＋</span>
                Create Classroom
                <span className="transition group-hover:translate-x-1">→</span>
              </button>

              <button className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 font-bold text-white backdrop-blur-xl transition hover:border-cyan-400/40 hover:bg-white/[0.06]">
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

              {/* Network info */}
              <div className="grid grid-cols-3 gap-3">

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-lg font-bold">01</p>
                  <p className="mt-1 text-[11px] text-slate-500">Teacher</p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-lg font-bold">04</p>
                  <p className="mt-1 text-[11px] text-slate-500">Students</p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-lg font-bold text-emerald-400">P2P</p>
                  <p className="mt-1 text-[11px] text-slate-500">Connection</p>
                </div>

              </div>

            </div>

          </div>

        </section>

        {/* Bottom feature strip */}
        <section className="grid gap-4 pb-12 md:grid-cols-3">

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

      </main>

    </div>
  );
}

export default App;