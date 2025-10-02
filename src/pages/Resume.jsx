// src/pages/Resume.jsx
import { useEffect } from "react";

export default function Resume() {
  useEffect(() => { document.title = "Resume | Kyle Deng"; }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Resume</h1>

      <div className="w-full border border-white/10 rounded-xl bg-black/20 shadow">
        <iframe
          title="Resume"
          src="/resume.pdf#zoom=100&toolbar=1&navpanes=0&view=FitH"
          className="w-full h-[88vh] rounded-xl"
          allow="fullscreen"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <a href="/resume.pdf" download className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          Download PDF
        </a>
      </div>
    </main>
  );
}
