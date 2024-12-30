const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Stock API endpoint
app.get('/api/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { range, period1, period2 } = req.query;
        
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
        
        if (range === 'custom' && period1 && period2) {
            url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// XU100 endpoint
app.get('/api/xu100', async (req, res) => {
    try {
        const { range, period1, period2 } = req.query;
        
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&range=${range}`;
        
        if (range === 'custom' && period1 && period2) {
            url = `https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&period1=${period1}&period2=${period2}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});