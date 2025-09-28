import { useEffect, useState } from "react";
import { getProjects } from "../lib/api"


export default function Projects() {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        (async () => {
            try {
                // Temporary mock until API exists
                // const data = await getProjects();
                const data = [
                    { id: "1", title: "Production Testing Tool", stack: "Python, C"},
                    { id: "2", title: "Personal Website", stack: "JavaScript, AWS Lambda, DynamoDB, PyTorch"},
                ];
                setItems(data);
                setStatus("done");
            }

            catch {
                setStatus("error");
            }
        })();
    }, []);

    if (status === "loading") return <p className="text-white/60">Loading...</p>;
    if (status === "error") return <p className="text-red-400">Failed to load.</p>;

    return (
        <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Projects</h2>
            <ul className="grid gap-4 md:grid-cols-2">
                {items.map(p => (
                    <li key={p.id} className="rounded-lg border border-white/10 p-4">
                        <h3 className="font-semibold">{p.title}</h3>
                        <p className="text-sm text-white/70">{p.stack}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}