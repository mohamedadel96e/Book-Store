const mongoose = require("mongoose");

const connectDB = async () =>
{
    try
    {
        await mongoose.connect("mongodb+srv://mohamedadel96e:VOyuZj2adZBJZUDD@cluster0.dzh96bu.mongodb.net/knowledge_vault?retryWrites=true&w=majority&appName=Cluster0");
        console.log(" MongoDB Connected to Atlas Successfully!");
    }
    catch (error)
    {
        console.error(" MongoDB Connection Error:", error.message );
        process.exit(1);
    }
};
module.exports = connectDB;
