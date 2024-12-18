import { Request, Response } from "express";
import Restaurant from "../models/restaurant";
import cloudinary from "cloudinary"
import mongoose from "mongoose";
import Order from "../models/order";

const createMyRestaurant = async (req: Request, res: Response) => {
    try {
        //Find will return an array -> Cause bug
        //Fix this to findOne
        const exsitingRestaurant = await Restaurant.findOne(
            { user: req.userId }
        )
        if (exsitingRestaurant) {
            return res.status(409).json({ message: "User restaurant already exists" })
        }

        const imageUrl = await uploadImage(req.file as Express.Multer.File)

        const restaurant = new Restaurant(req.body)
        restaurant.imageUrl = imageUrl
        restaurant.user = new mongoose.Types.ObjectId(req.userId)
        restaurant.lastUpdate = new Date()
        await restaurant.save()
        res.status(200).send(restaurant)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Something went wrong with CREATE Restaurant" })
    }
}

const getMyRestaurantOrders = async (req: Request, res: Response) => {
    try {
        const restaurant = await Restaurant.findOne({ user: req.userId })
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not in get order found!" })
        }
        const orders = await Order.find({ restaurant: restaurant._id }).populate("restaurant").populate("user")
        res.json(orders)

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Something went wrong with get Order" })
    }
}

const getMyRestaurant = async (req: Request, res: Response) => {
    try {
        const restaurant = await Restaurant.findOne(
            { user: req.userId }
        )
        if (!restaurant) {
            return res.status(409).json({ message: "Restaurant don't exists" })
        }
        res.json(restaurant)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Something went wrong with GET Restaurant" })
    }
}

const updateMyOrderStatus = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body
        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }
        console.log("Order co restaurant la ", order.restaurant);
        const restaurant = await Restaurant.findById(order.restaurant)
        if (restaurant?.user?._id.toString() !== req.userId) {
            return res.status(404).send()
        }
        order.status = status
        await order.save();
        res.status(200).json(order)

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Something went wrong with PATCH Order" })
    }
}

const updateMyRestaurant = async (req: Request, res: Response) => {
    try {
        const restaurant = await Restaurant.findOne(
            { user: req.userId }
        )
        if (!restaurant) {
            return res.status(409).json({ message: "Restaurant don't exists" })
        }

        restaurant.restaurantName = req.body.restaurantName
        restaurant.city = req.body.city
        restaurant.country = req.body.country
        restaurant.deliveryPrice = req.body.deliveryPrice
        restaurant.estimatedDeliveryTime = req.body.estimatedDeliveryTime
        restaurant.cuisines = req.body.cuisines
        restaurant.lastUpdate = new Date()
        // Image update logic
        // If a new file is uploaded then update 
        if (req.file) {
            const imageUrl = await uploadImage(req.file as Express.Multer.File)
            restaurant.imageUrl = imageUrl
        }

        await restaurant.save()
        res.status(200).send(restaurant)
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Something went wrong with PUT Restaurant" })
    }
}

const uploadImage = async (file: Express.Multer.File) => {
    // const image = req.file as Express.Multer.File
    const image = file
    const base64Image = Buffer.from(image.buffer).toString("base64")
    const dataURL = `data:${image.mimetype};base64,${base64Image}`

    const uploadRes = await cloudinary.v2.uploader.upload(dataURL)
    return uploadRes.url
}

export default {
    createMyRestaurant,
    getMyRestaurant,
    updateMyRestaurant,
    getMyRestaurantOrders,
    updateMyOrderStatus
}