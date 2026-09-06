import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { ok } from "../lib/response.js";

const r = Router();

r.use(authenticate);

r.get("/", async (req, res, next) => {
  try {
    const isPlatformAdmin =
      req.user.role === "PLATFORM_ADMIN";

    /*
     * PLATFORM ADMIN
     *
     * No businessId is required.
     * Dashboard aggregates across the entire platform.
     */
    if (isPlatformAdmin) {
      const [
        orders,
        products,
        customers,
        pending,
        businesses,
      ] = await Promise.all([
        prisma.order.aggregate({
          where: {
            status: {
              not: "CANCELLED",
            },
          },
          _sum: {
            total: true,
          },
          _count: true,
        }),

        prisma.product.count(),

        prisma.customer.count(),

        prisma.order.count({
          where: {
            status: "PENDING",
          },
        }),

        prisma.business.count(),
      ]);

      return ok(res, {
        revenue: orders._sum.total || 0,
        orders: orders._count,
        products,
        customers,
        pending,
        businesses,
      });
    }

    /*
     * BUSINESS USER
     *
     * businessId is mandatory.
     */
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(403).json({
        success: false,
        message:
          "No business account is associated with this user",
      });
    }

    const [
      orders,
      products,
      customers,
      pending,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: {
          businessId,
          status: {
            not: "CANCELLED",
          },
        },
        _sum: {
          total: true,
        },
        _count: true,
      }),

      prisma.product.count({
        where: {
          businessId,
        },
      }),

      prisma.customer.count({
        where: {
          businessId,
        },
      }),

      prisma.order.count({
        where: {
          businessId,
          status: "PENDING",
        },
      }),
    ]);

    return ok(res, {
      revenue: orders._sum.total || 0,
      orders: orders._count,
      products,
      customers,
      pending,
    });
  } catch (error) {
    next(error);
  }
});

export default r;
