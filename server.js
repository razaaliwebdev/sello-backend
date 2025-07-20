import { app } from "./app.js";
import connectDB from './config/db.js';

connectDB().then(() => {
    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
        console.log(`Server is running on the PORT:${PORT}`);
    });
});