import { NavLink } from "react-router-dom";

export default function Navbar() {
    const linkClass = ({ isActive }) => `hover:text-pink-400 ${isActive ? "text-pink-400" : ""}`;

    return (
        <header className="w-full border-b border-white/10 bg-gray-900/60 backdrop-blur">
            <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
                <NavLink to="/" className="font-semibold">kyle deng</NavLink>
                <div className="flex gap-4 text-sm">
                    <NavLink to="/" className={linkClass}>Home</NavLink>
                    <NavLink to="/projects" className={linkClass}>Projects</NavLink>
                    <NavLink to="/resume" className={linkClass}>Resume</NavLink>
                    <NavLink to="/chat" className={linkClass}>Chat</NavLink>
                </div>
            </nav>
        </header>
    );
}