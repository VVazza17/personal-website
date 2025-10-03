import { useEffect, useState } from "react";
import { getProjects } from "../lib/api"


export default function Projects() {
    const [items, setItems] = useState([]);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        (async () => {
            try {
                const data = await getProjects();
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
                        {/* Project name */}
                        <h3 className="font-semibold text-lg">{p.id}</h3>

                        {/* Tags */}
                        {p.tags?.length > 0 && (
                            <p className="text-xs text-white/50 mt-2">{p.tags.join(" · ")}</p>
                        )}

                        {/* Summary */}
                        <p className="text-sm text-white/70">{p.summary}</p>

                        {/* Date */}
                        {p.publishedAt && (
                            <p className="text-xs text-white/40 mt-1">
                                Published: {new Date(p.publishedAt).toLocaleDateString()}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}