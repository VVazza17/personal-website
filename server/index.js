import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/projects", (_req, res) => {
    res.json([
        { id: "1", title: "Production Testing Tool", stack: "Python, C"},
        { id: "2", title: "Personal Website", stack: "JavaScript, AWS Lambda, DynamoDB, PyTorch"},
    ]);
});

app.post("/chat", (req, res) => {
    const { message } = req.body || {};
    //later call Lambda/SageMaker but for now
    res.json({ 
        id: Date.now().toString(),
        reply: `You said: ${message}. (Mock reply)`,
        timestamp: new Date().toISOString()
    });
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
    console.log(`Mock API running on https://localhost:${port}`);
});