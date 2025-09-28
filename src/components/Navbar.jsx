export default function Navbar() {
    return (
        <header className="w-full border-b border-white/10 bg-gray-900/60 backdrop-blur">
            <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                <a href="/" className="font-semibold">Kyle.dev</a>
                <div className="flex gap-4 text-sm">
                    <a href="/" className="hover:text-pink-400">Home</a>
                    <a href="/projects" className="hover:text-pink-400">Projects</a>
                    <a href="/chat" className="hover:text-pink-400">Chat</a>
                </div>
            </nav>
        </header>
    );
}