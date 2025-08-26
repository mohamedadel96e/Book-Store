const Category = require("../models/Category.js");

const createCategory = async (req, res) =>
{
    try
    {
        const { name, description } = req.body;

        if (!name)
        {
            return res.status(400).json({ message: "Category name is required" });
        }

        const categoryExists = await Category.findOne({ name });
        if (categoryExists)
        {
            return res.status(400).json({ message: "Category already exists" });
        }

        const category = await Category.create({
            name,
            description,
        });

        res.status(201).json(category);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { createCategory };
