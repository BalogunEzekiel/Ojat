import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { ok } from "../lib/response.js";

const r = Router();

r.use(authenticate);

/*
 * GET PRODUCTS
 *
 * Platform admin:
 *   sees products across all businesses.
 *
 * Business user:
 *   sees only products belonging to their business.
 */
r.get("/", async (req, res, next) => {
  try {
    const isPlatformAdmin =
      req.user.role === "PLATFORM_ADMIN";

    const items =
      await prisma.product.findMany({
        where: isPlatformAdmin
          ? undefined
          : {
              businessId: req.user.businessId,
            },

        include: {
          inventory: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return ok(res, items);
  } catch (error) {
    next(error);
  }
});


/*
 * CREATE PRODUCT
 *
 * Platform admins must explicitly provide
 * the target businessId.
 *
 * Business users automatically use their
 * own businessId.
 */
r.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      businessId: z.string().optional(),

      name: z
        .string()
        .min(2),

      sku: z
        .string()
        .min(1),

      sellingPrice:
        z.coerce
          .number()
          .positive(),

      minStock:
        z.coerce
          .number()
          .int()
          .nonnegative()
          .default(0),

      quantity:
        z.coerce
          .number()
          .int()
          .nonnegative()
          .default(0),
    }).parse(req.body);

    const isPlatformAdmin =
      req.user.role === "PLATFORM_ADMIN";

    const businessId =
      isPlatformAdmin
        ? body.businessId
        : req.user.businessId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message:
          "businessId is required when creating a platform-level product",
      });
    }

    /*
     * Verify that the target business exists.
     */
    const business =
      await prisma.business.findUnique({
        where: {
          id: businessId,
        },
        select: {
          id: true,
        },
      });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const product =
      await prisma.$transaction(
        async (tx) => {
          const product =
            await tx.product.create({
              data: {
                businessId,

                name: body.name,

                sku: body.sku,

                sellingPrice:
                  body.sellingPrice,

                minStock:
                  body.minStock,
              },
            });

          await tx.inventory.create({
            data: {
              businessId,

              productId:
                product.id,

              quantity:
                body.quantity,
            },
          });

          return product;
        }
      );

    return ok(
      res,
      product,
      "Product created",
      201
    );
  } catch (error) {
    next(error);
  }
});

export default r;
