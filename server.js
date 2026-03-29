const express = require('express');
const mongoose = require('mongoose');
const Diet = require('./models/Diet'); // Ye line 'Diet is not defined' error khatam kar degi
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

dotenv.config();

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- DATABASE ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dietDash')
    .then(() => console.log("✅ DB Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// --- USER SCHEMA ---
const User = mongoose.model('User', new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String
}));

// --- ROUTES (PAGES) ---
app.get('/', (req, res) => {console.log("Hooray! Home page request aayi."); res.sendFile(path.join(__dirname,'signup.html'));});
app.get('/login', (req, res) => {res.sendFile(path.join(__dirname, 'login.html'));});
app.get('/dashboard', (req, res) => {res.sendFile(path.join(__dirname, 'dashboard.html'));});
app.get('/signup', (req, res) => {res.sendFile(path.join(__dirname,'signup.html'));});
// --- SIGNUP ---
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        res.json({ message: "Signup successful" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Signup error" });
    }
});

// --- LOGIN ---
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            res.json({ message: "Success", userName: user.name });
        } else {
            res.status(400).json({ message: "Wrong password" });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Login error" });
    }
});

// --- 🥗 AI DIET GENERATOR (WORKING) ---
app.post('/generate-diet', async (req, res) => {
    try {
        const { age, goal } = req.body;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `Act as a professional Indian Nutritionist. 
Create a highly detailed 1-day Indian diet plan for a ${age} year old. 
Goal: ${goal}.

Please format the response strictly as follows:
1. **Breakfast** (8:00 AM): [Dish name + 1 line benefit]
2. **Mid-Day Snack** (11:00 AM): [Healthy option]
3. **Lunch** (1:30 PM): [Balanced Indian meal]
4. **Evening Snack** (5:00 PM): [Low calorie/protein rich]
5. **Dinner** (8:30 PM): [Light & easy to digest]

Important: Use emojis like 🥗, 🍳, 🍎 to make it look aesthetic. Keep it practical for someone living in India.`

                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log("🔥 GEMINI FULL:", JSON.stringify(data, null, 2));

        // 👇 SAFE EXTRACTION
        let text = "No response";

        if (data.candidates && data.candidates.length > 0) {
            text = data.candidates[0]?.content?.parts?.[0]?.text;
        }
        // 1. AI ka plan milne ke baad, usey DB mein save karo
const nayaDietPlan = new Diet({
    userId: req.body.userId || "Mehak_User", // Agar login system hai toh user ID dalo
    age: age,
    goal: goal,
    plan: text,
    createdAt: new Date()
});

await nayaDietPlan.save(); // Ye line MongoDB mein data bhej degi
console.log("✅ Diet Plan MongoDB mein save ho gaya!");

        res.json({ plan: text });

    } catch (error) {
        console.error("❌ GEMINI ERROR:", error);
        res.json({ plan: "Error 😢" });
    }
});
app.get('/get-history', async (req, res) => {
    try {
        // Diet.find() matlab saara data nikal lo. 
        // .sort({ createdAt: -1 }) matlab naya wala sabse upar dikhao.
        const history = await Diet.find().sort({ createdAt: -1 }); 
        res.json(history); 
    } catch (error) {
        res.status(500).json({ message: "History nahi mil payi" });
    }
});
// server.js mein add karo
app.delete('/delete-diet/:id', async (req, res) => {
    try {
        const id = req.params.id;
        await Diet.findByIdAndDelete(id); // MongoDB se delete karega
        res.json({ message: "Plan uda diya gaya! 🗑️" });
    } catch (error) {
        res.status(500).json({ message: "Delete nahi ho paya" });
    }
});

// --- SERVER ---
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});