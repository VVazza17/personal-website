import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";
import Resume from "./pages/Resume";


export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-gray-900 text-white">
                <Navbar />
                <main className="mx-auto max-w-5xl px-4 py-10">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/resume" element={<Resume /> } />
                        <Route path="/chat" element={<Chat />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </BrowserRouter>
    );

}
