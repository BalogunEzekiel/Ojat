import crypto from "crypto";

import { prisma } from "../lib/prisma.js";


/* =========================================================
   HELPERS
========================================================= */

function createSlug(name) {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return `${base}-${crypto
    .randomBytes(3)
    .toString("hex")}`;
}


/* =========================================================
   GET BUSINESS
========================================================= */

export async function getBusiness(
  businessId,
  userId
) {
  const membership =
    await prisma.businessMember.findFirst({
      where: {
        businessId,
        userId,
      },

      include: {
        business: true,
      },
    });


  if (!membership) {
    throw Object.assign(
      new Error(
        "You do not have access to this business"
      ),
      {
        status: 403,
      }
    );
  }


  return membership.business;
}


/* =========================================================
   UPDATE BUSINESS PROFILE
========================================================= */

export async function updateBusiness(
  businessId,
  userId,
  input
) {
  const membership =
    await prisma.businessMember.findFirst({
      where: {
        businessId,
        userId,
      },
    });


  if (!membership) {
    throw Object.assign(
      new Error(
        "You do not have access to this business"
      ),
      {
        status: 403,
      }
    );
  }


  /*
    Only privileged business roles should
    modify business settings.
  */

  const allowedRoles = [
    "BUSINESS_OWNER",
    "BUSINESS_MANAGER",
  ];


  if (
    !allowedRoles.includes(
      membership.role
    )
  ) {
    throw Object.assign(
      new Error(
        "You do not have permission to update this business"
      ),
      {
        status: 403,
      }
    );
  }


  const data = {};


  if (input.name !== undefined) {
    data.name =
      input.name.trim();
  }


  if (input.currency !== undefined) {
    data.currency =
      input.currency;
  }


  return prisma.business.update({
    where: {
      id: businessId,
    },

    data,
  });
}


/* =========================================================
   CREATE ADDITIONAL BUSINESS

   Useful later for users managing multiple businesses.
========================================================= */

export async function createBusiness(
  userId,
  input
) {
  const businessName =
    input.name.trim();


  const business =
    await prisma.$transaction(
      async tx => {

        const newBusiness =
          await tx.business.create({
            data: {
              name:
                businessName,

              slug:
                createSlug(
                  businessName
                ),

              currency:
                input.currency ||
                "NGN",
            },
          });


        await tx.businessMember.create({
          data: {
            businessId:
              newBusiness.id,

            userId,

            role:
              "BUSINESS_OWNER",
          },
        });


        return newBusiness;
      }
    );


  return business;
}


/* =========================================================
   LIST USER BUSINESSES
========================================================= */

export async function listUserBusinesses(
  userId
) {
  const memberships =
    await prisma.businessMember.findMany({
      where: {
        userId,
      },

      include: {
        business: true,
      },

      orderBy: {
        business: {
          createdAt: "asc",
        },
      },
    });


  return memberships.map(
    membership => ({
      ...membership.business,

      membershipRole:
        membership.role,
    })
  );
}
