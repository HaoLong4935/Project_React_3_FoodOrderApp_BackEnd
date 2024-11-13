import Stripe from "stripe";
import { Request, Response } from "express";
import Restaurant, { MenuItemType } from "../models/restaurant";
import Order from "../models/order";

//Tao mot ket noi tu third party stripe voi backend
const STRIPE = new Stripe(process.env.STRIPE_API_KEY as string)
const FRONTEND_URL = process.env.FRONTEND_URL as string
const STRIPE_ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string
type CheckoutSessionRequest = {
    cartItems: {
        menuItemId: string;
        name: string;
        quantity: string;
    }[];
    deliveryDetails: {
        email: string,
        name: string,
        addressLine1: string;
        city: string;
    }
    restaurantId: string
}

const stripeWebhookHandler = async (req: Request, res: Response) => {
    let event;
    try {
        const sig = req.headers["stripe-signature"];
        event = STRIPE.webhooks.constructEvent(
            req.body,
            sig as string,
            STRIPE_ENDPOINT_SECRET
        )
    } catch (error: any) {
        console.log(error);
        //Luu y: Neu khong return thi khi gap loi va chay vao catch, no se van chay tiep xuong cau dieu kien if o duoi
        return res.status(400).send(`Webhook error: ${error.message}`)
    }

    if (event.type === "checkout.session.completed") {
        const order = await Order.findById(event.data.object.metadata?.orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found!" })
        }
        order.totalAmount = event.data.object.amount_total;
        order.status = "paid"
        await order.save()
    }
    res.status(200).send()
}

const createCheckoutSession = async (req: Request, res: Response) => {
    try {
        const checkoutSessionRequest: CheckoutSessionRequest = req.body
        //Kiem tra restaurant do co ton tai khong
        const restaurant = await Restaurant.findById(checkoutSessionRequest.restaurantId)
        if (!restaurant) {
            throw new Error("Restaurant not found")
        }
        //Truoc khi thuc hien cac logic cua checkout thi can ghi lai giao dich vao databases
        const newOrder = new Order({
            restaurant: restaurant,
            user: req.userId,
            status: "placed",
            deliveryDetails: checkoutSessionRequest.deliveryDetails,
            cartItems: checkoutSessionRequest.cartItems,
            createdAt: new Date(),
        })

        const lineItems = createLineItems(checkoutSessionRequest, restaurant.menuItems)

        const session = await createSession(lineItems, newOrder._id.toString(), restaurant.deliveryPrice, restaurant._id.toString())
        if (!session.url) {
            return res.status(500).json({ message: "Error creating stripe session" })
        }

        //Luu vao database
        await newOrder.save()
        res.json({ url: session.url })

    } catch (error: any) {
        console.log(error)
        res.status(500).json({ message: error.raw.message })
    }
}
//Luu y menuItems khong co price lay tu front end ma lay tu backend dua vao menuItemId de 
//dam bao tinh bao mat va chinh xac hon 
const createLineItems = (checkoutSessionRequest: CheckoutSessionRequest, menuItems: MenuItemType[]) => {
    //1. Trong CheckoutSessionRequest .Voi moi cartItem , lay sub object menuITem tu restaurant
    //(de co the lay duoc gia tien cua item do)
    //2. Voi moi cartItem , chuyen doi no thanh mot lineItems o dong 32
    //3. Tra ve data la mot line item array
    const lineItems = checkoutSessionRequest.cartItems.map((cartItem) => {
        //Boi vi _id la doi tuong cua mongoDb nen can phai chuyen ve chuoi
        const menuItem = menuItems.find((item) => item._id.toString() === cartItem.menuItemId.toString())
        if (!menuItem) {
            throw new Error(`Menu item not found:${cartItem.menuItemId}`)
        }

        const line_item: Stripe.Checkout.SessionCreateParams.LineItem = {
            price_data: {
                currency: "gbp",
                unit_amount: menuItem.price,
                product_data: {
                    name: menuItem.name
                }
            },
            quantity: parseInt(cartItem.quantity),
        };

        return line_item
    })

    return lineItems;
}

const createSession = async (
    lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
    orderId: string,
    delieryPrice: number,
    restaurantId: string) => {
    console.log("Data cua bo may dau , restaurantId DAU CMM", restaurantId);
    console.log("Data cua bo may dau , orderId DAU CMM", orderId);
    const sessionData = await STRIPE.checkout.sessions.create({
        line_items: lineItems,
        shipping_options: [
            {
                shipping_rate_data: {
                    display_name: "Delivery",
                    type: "fixed_amount",
                    fixed_amount: {
                        amount: delieryPrice,
                        currency: "gbp"
                    }
                }
            }
        ],
        mode: "payment",
        metadata: {
            orderId: orderId.toString(),
            restaurantId: restaurantId.toString(),
        },
        success_url: `${FRONTEND_URL}/order-status?success=true`,
        cancel_url: `${FRONTEND_URL}/detail/${restaurantId}?cancelled=true`,
    })
    //Gio ta se nhan duoc mot object stripe ma chua day du data ve giao dich
    return sessionData;
}

export default {
    createCheckoutSession,
    stripeWebhookHandler
}