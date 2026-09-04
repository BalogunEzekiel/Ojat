import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const BCRYPT_ROUNDS = 10;

const sign = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, { expiresIn });

export async function register(input) {
  const exists = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (exists) {
    throw Object.assign(new Error("Email already exists"), {
      status: 409,
    });
  }

  const passwordHash = await bcrypt.hash(
    input.password,
    BCRYPT_ROUNDS
  );

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: input.businessName,
      slug:
        input.businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") +
        "-" +
        crypto.randomBytes(3).toString("hex"),

      members: {
        create: {
          userId: user.id,
          role: "BUSINESS_OWNER",
        },
      },
    },
  });

  return tokens(user, business.id);
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (
    !user ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    throw Object.assign(new Error("Invalid credentials"), {
      status: 401,
    });
  }

  const membership = await prisma.businessMember.findFirst({
    where: {
      userId: user.id,
    },
  });

  return tokens(
    user,
    membership?.businessId
  );
}

async function tokens(user, businessId) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    businessId,
  };

  const accessToken = sign(
    payload,
    env.jwtAccessSecret,
    env.accessExpires
  );

  const refreshToken = sign(
    payload,
    env.jwtRefreshSecret,
    env.refreshExpires
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash: crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex"),

      userId: user.id,

      expiresAt: new Date(
        Date.now() + 7 * 86400000
      ),
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      businessId,
    },
    accessToken,
    refreshToken,
  };
}
