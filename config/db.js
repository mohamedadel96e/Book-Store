import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export const connectDB = async () =>
{
    try
    {
        const connection = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${connection.connection.host} . #${connection.connection.port} `);
    }
    catch (error) {
        console.error(` Error: ${error.message}`);
        process.exit(1);
    }
};
