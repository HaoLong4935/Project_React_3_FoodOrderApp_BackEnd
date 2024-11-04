import express, { Request, Response } from "express"
import cors from "cors"
import "dotenv/config";
import mongoose from "mongoose";
import myUserRoutes from './routes/MyUserRoutes'
import { v2 as cloudinary } from 'cloudinary'
import myRestaurantRoute from "./routes/MyRestaurantRoute"
import restaurantRoute from "./routes/RestaurantRoute"
mongoose
    .connect(process.env.MONGODB_URL_CONNECTION as string)
    .then(() => console.log("Connected to database!"))

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

const app = express();
app.use(express.json())
app.use(cors())

app.get("/health", async (req: Request, res: Response) => {
    res.send({ message: "Health OK" })
})

app.use("/api/my/user", myUserRoutes)
app.use("/api/my/restaurant", myRestaurantRoute)
app.use("/api/restaurant", restaurantRoute)
app.listen(7000, () => {
    console.log("Server is running on port 7000");
})