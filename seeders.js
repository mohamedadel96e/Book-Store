const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
// Models
const Category = require("./models/Category");
const Book = require("./models/Book");
const User = require("./models/User");
const Plan = require("./models/Plan");

dotenv.config();
connectDB();
const categories =
[
    { name: "Drama", description: "Books that explore human emotions and conflicts in depth" },
    { name: "Action", description: "Fast-paced books with adventure, danger, and excitement" },
    { name: "Romance", description: "Stories centered around love and relationships" },
    { name: "Science Fiction", description: "Books imagining futuristic technology and outer space adventures" },
    { name: "Fantasy", description: "Magical worlds filled with mythical creatures and epic quests" },
    { name: "Mystery", description: "Books focused on solving crimes, puzzles, or uncovering secrets" },
    { name: "Horror", description: "Scary and thrilling stories meant to evoke fear and suspense" },
    { name: "History", description: "Books that explore real events and important historical periods" },
    { name: "Biography", description: "Life stories of famous or inspiring people" },
    { name: "Self-Help", description: "Books that provide guidance on improving personal and professional life" },
    { name: "Philosophy", description: "Exploring big questions about existence, morality, and knowledge" },
    { name: "Religion", description: "Books about faith, spiritual practices, and religious teachings" },
    { name: "Poetry", description: "Collections of poems that express emotions and artistic thoughts" },
    { name: "Children", description: "Stories and picture books aimed at young readers" },
    { name: "Comics", description: "Illustrated books and graphic novels with sequential art" },
];


const books = [
    {
        title: "The Silent Tears",
        author: "Layla Hassan",
        description: "A touching drama about family struggles and hidden truths",
        type: "novel",
        contentUrl: "https://storage.example.com/silent-tears.pdf",
        coverImageUrl: "https://storage.example.com/images/silent-tears.jpg",
        categories: [], // IDs from Category seeder
        isPurchasable: true,
        purchasePrice: 120,
        isBorrowable: true,
        borrowDurationDays: 14,
    },
    {
        title: "Chasing Shadows",
        author: "Omar Khaled",
        description: "An action-packed thriller about a secret agent on the run",
        type: "novel",
        contentUrl: "https://storage.example.com/chasing-shadows.pdf",
        coverImageUrl: "https://storage.example.com/images/chasing-shadows.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 150,
        isBorrowable: true,
        borrowDurationDays: 10,
    },
    {
        title: "Starlight Beyond",
        author: "Sarah Nabil",
        description: "A sci-fi adventure across galaxies to save humanity",
        type: "novel",
        contentUrl: "https://storage.example.com/starlight-beyond.pdf",
        coverImageUrl: "https://storage.example.com/images/starlight-beyond.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 200,
        isBorrowable: true,
        borrowDurationDays: 12,
    },
    {
        title: "The Forgotten Realm",
        author: "Hassan Youssef",
        description: "Epic fantasy tale of kingdoms, dragons, and destiny",
        type: "novel",
        contentUrl: "https://storage.example.com/forgotten-realm.pdf",
        coverImageUrl: "https://storage.example.com/images/forgotten-realm.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 220,
        isBorrowable: true,
        borrowDurationDays: 15,
    },
    {
        title: "The Last Letter",
        author: "Amira Salem",
        description: "Romantic drama about lost love and second chances",
        type: "novel",
        contentUrl: "https://storage.example.com/last-letter.pdf",
        coverImageUrl: "https://storage.example.com/images/last-letter.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 130,
        isBorrowable: true,
        borrowDurationDays: 7,
    },
    {
        title: "The Dark Whisper",
        author: "Youssef Mansour",
        description: "Haunting horror story set in an abandoned asylum",
        type: "novel",
        contentUrl: "https://storage.example.com/dark-whisper.pdf",
        coverImageUrl: "https://storage.example.com/images/dark-whisper.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 160,
        isBorrowable: true,
        borrowDurationDays: 10,
    },
    {
        title: "Echoes of Cairo",
        author: "Nour El Din",
        description: "Historical novel about life in Cairo during the 1800s",
        type: "novel",
        contentUrl: "https://storage.example.com/echoes-cairo.pdf",
        coverImageUrl: "https://storage.example.com/images/echoes-cairo.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 180,
        isBorrowable: true,
        borrowDurationDays: 20,
    },
    {
        title: "Wings of Tomorrow",
        author: "Mona Ibrahim",
        description: "Sci-fi story exploring the future of artificial intelligence",
        type: "short story",
        contentUrl: "https://storage.example.com/wings-tomorrow.pdf",
        coverImageUrl: "https://storage.example.com/images/wings-tomorrow.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 100,
        isBorrowable: true,
        borrowDurationDays: 5,
    },
    {
        title: "The Healing Path",
        author: "Karim Taha",
        description: "Guide to improving mental health and self-discovery",
        type: "essay",
        contentUrl: "https://storage.example.com/healing-path.pdf",
        coverImageUrl: "https://storage.example.com/images/healing-path.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 90,
        isBorrowable: false,
    },
    {
        title: "Footsteps of Faith",
        author: "Sheikh Ali",
        description: "Religious reflections on spirituality and modern life",
        type: "essay",
        contentUrl: "https://storage.example.com/footsteps-faith.pdf",
        coverImageUrl: "https://storage.example.com/images/footsteps-faith.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 110,
        isBorrowable: false,
    },
    {
        title: "The Brave Heart",
        author: "Mohamed Fathi",
        description: "Action-packed tale of a soldier in battle",
        type: "novel",
        contentUrl: "https://storage.example.com/brave-heart.pdf",
        coverImageUrl: "https://storage.example.com/images/brave-heart.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 140,
        isBorrowable: true,
        borrowDurationDays: 12,
    },
    {
        title: "The Hidden Poet",
        author: "Nadia Farouk",
        description: "A collection of poems about love and loss",
        type: "poem",
        contentUrl: "https://storage.example.com/hidden-poet.pdf",
        coverImageUrl: "https://storage.example.com/images/hidden-poet.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 80,
        isBorrowable: true,
        borrowDurationDays: 5,
    },
    {
        title: "Dreams of a Child",
        author: "Samira Ahmed",
        description: "Stories written for children full of lessons and fun",
        type: "short story",
        contentUrl: "https://storage.example.com/dreams-child.pdf",
        coverImageUrl: "https://storage.example.com/images/dreams-child.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 70,
        isBorrowable: true,
        borrowDurationDays: 7,
    },
    {
        title: "Legends of the East",
        author: "Khaled Samy",
        description: "Historical fantasy about myths and legends in the Arab world",
        type: "novel",
        contentUrl: "https://storage.example.com/legends-east.pdf",
        coverImageUrl: "https://storage.example.com/images/legends-east.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 190,
        isBorrowable: true,
        borrowDurationDays: 15,
    },
    {
        title: "The Enigma Code",
        author: "Adel Ismail",
        description: "Mystery novel about cryptography and hidden secrets",
        type: "novel",
        contentUrl: "https://storage.example.com/enigma-code.pdf",
        coverImageUrl: "https://storage.example.com/images/enigma-code.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 150,
        isBorrowable: true,
        borrowDurationDays: 10,
    },
    {
        title: "Life of a Genius",
        author: "Ola Magdy",
        description: "Biography of a world-famous scientist",
        type: "essay",
        contentUrl: "https://storage.example.com/life-genius.pdf",
        coverImageUrl: "https://storage.example.com/images/life-genius.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 170,
        isBorrowable: false,
    },
    {
        title: "The Dark Moon",
        author: "Rania Hossam",
        description: "A chilling horror novel set in a mysterious village",
        type: "novel",
        contentUrl: "https://storage.example.com/dark-moon.pdf",
        coverImageUrl: "https://storage.example.com/images/dark-moon.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 160,
        isBorrowable: true,
        borrowDurationDays: 12,
    },
    {
        title: "Whispers of the Soul",
        author: "Ahmed Saber",
        description: "Philosophical poetry collection exploring the human condition",
        type: "poem",
        contentUrl: "https://storage.example.com/whispers-soul.pdf",
        coverImageUrl: "https://storage.example.com/images/whispers-soul.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 100,
        isBorrowable: true,
        borrowDurationDays: 8,
    },
    {
        title: "The Little Adventurer",
        author: "Heba Mostafa",
        description: "Children’s adventure about a boy exploring magical lands",
        type: "short story",
        contentUrl: "https://storage.example.com/little-adventurer.pdf",
        coverImageUrl: "https://storage.example.com/images/little-adventurer.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 90,
        isBorrowable: true,
        borrowDurationDays: 10,
    },
    {
        title: "Manga Heroes",
        author: "Various Authors",
        description: "A collection of manga stories filled with action and comedy",
        type: "comic",
        contentUrl: "https://storage.example.com/manga-heroes.pdf",
        coverImageUrl: "https://storage.example.com/images/manga-heroes.jpg",
        categories: [],
        isPurchasable: true,
        purchasePrice: 200,
        isBorrowable: true,
        borrowDurationDays: 14,
    }
];

const users = [
    {
        username: "admin",
        email: "admin@example.com",
        password: "123456",
        role: "watcher  ",
    },
    {
        username: "user1",
        email: "user1@example.com",
        password: "123456",
        role: "user",
    },
];

const plans = [
    {
        type: "limited_books",
        bookLimit: 5,
        booksUsed: 0,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // شهر
        real_price: 150,
        discount_price: 100,
    },
    {
        type: "limited_books",
        bookLimit: 10,
        booksUsed: 0,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)), // 3 شهور
        real_price: 250,
        discount_price: 180,
    },
    {
        type: "limited_books",
        bookLimit: 20,
        booksUsed: 0,
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)), // 6 شهور
        real_price: 400,
        discount_price: 300,
    },

    {
        type: "category_access",
        category: null, // لازم بعدين نحط _id لكاتيجوري (مثلا Action)
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // شهر
        real_price: 200,
        discount_price: 120,
    },
    {
        type: "category_access",
        category: null, // مثلا Drama
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 3)), // 3 شهور
        real_price: 400,
        discount_price: 250,
    },
    {
        type: "category_access",
        category: null, // مثلا Fantasy
        startDate: new Date(),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 6)), // 6 شهور
        real_price: 600,
        discount_price: 400,
    },
];

const importData = async () => {
    try {
        await Category.deleteMany();
        await Book.deleteMany();
        await User.deleteMany();
        await Plan.deleteMany();

        const createdCategories = await Category.insertMany(categories);
        const createdBooks = await Book.insertMany(books);
        const createdUsers = await User.insertMany(users);
        const createdPlans = await Plan.insertMany(plans);

        console.log("Data Imported!");
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};
const destroyData = async () => {
    try {
        await Category.deleteMany();
        await Book.deleteMany();
        await User.deleteMany();
        await Plan.deleteMany();

        console.log("Data Destroyed!".red.inverse);
        process.exit();
    } catch (error) {
        console.error(`${error}`.red.inverse);
        process.exit(1);
    }
};
if (process.argv[2] === "-d") {
    destroyData();
} else {
    importData();
}
