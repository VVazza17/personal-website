export default function Footer() {
    return (
        <footer className="mt-12 border-t border-white/10 py-6 text-center text-sm text-white/60">
            <div className="mt-2 flex justify-center gap-4">
                <a
                    href="https://linkedin.com/in/kyle-deng"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-pink-400 transition"
                >
                    Linkedin
                </a>

                <a
                    href="https://github.com/VVazza17"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-pink-400 transition"
                >
                    GitHub
                </a>
            </div>
        </footer>
    );
}