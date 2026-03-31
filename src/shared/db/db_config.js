import mongoose from 'mongoose';
import { MONGO_URI } from '../config/index.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const connectDB = async () => {
    if (!MONGO_URI) {
        throw new Error('MONGO_URI is not set. Please configure it in your environment.');
    }

    // Prevent Mongoose from buffering operations when disconnected.
    mongoose.set('bufferCommands', false);

    const maxRetries = 5;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const conn = await mongoose.connect(MONGO_URI, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                family: 4,
            });

            mongoose.connection.on('error', (error) => {
                console.error('MongoDB runtime connection error:', error.message);
            });

            mongoose.connection.on('disconnected', () => {
                console.error('MongoDB disconnected.');
            });

            console.log(`Connected to DB: ${conn.connection.host}`);
            return;
        } catch (err) {
            lastError = err;
            console.error(`DB connection attempt ${attempt}/${maxRetries} failed:`, err.message);

            if (attempt < maxRetries) {
                await delay(attempt * 2000);
            }
        }
    }

    throw lastError;
};