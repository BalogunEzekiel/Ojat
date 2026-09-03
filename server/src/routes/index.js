import {
  Router,
} from "express";

import auth
  from "./auth.routes.js";

import products
  from "./products.routes.js";

import dashboard
  from "./dashboard.routes.js";

import ai
  from "./ai.routes.js";

import webhooks
  from "./webhooks.routes.js";

import payments
  from "./payment.routes.js";

import aiOrders
  from "./ai-orders.routes.js";


const r =
  Router();


r.use(
  "/auth",
  auth
);


r.use(
  "/products",
  products
);


r.use(
  "/dashboard",
  dashboard
);


r.use(
  "/ai",
  ai
);


r.use(
  "/payments",
  payments
);

r.use(
  "/ai-orders",
  aiOrders
);


r.use(
  "/webhooks",
  webhooks
);


export default r;