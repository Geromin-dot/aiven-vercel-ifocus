export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { model } = req.query;
    if (!model) {
        return res.status(400).json({ error: 'Model parameter is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    try {
        const fetchRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        });

        const data = await fetchRes.json();
        res.status(fetchRes.status).json(data);
    } catch (error) {
        console.error('Error in generateContent proxy:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
