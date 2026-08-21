export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    try {
        const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await fetchRes.json();
        res.status(fetchRes.status).json(data);
    } catch (error) {
        console.error('Error in models proxy:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
