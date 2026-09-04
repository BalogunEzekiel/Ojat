import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { performance } from "node:perf_hooks";

import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const sign = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, { expiresIn });

export async function register(input) {
  const exists = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (exists) {
    throw Object.assign(new Error("Email already exists"), {
      status: 409,
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

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
  const totalStart = performance.now();

  // ---------------------------------------------------------
  // 1. Find user
  // ---------------------------------------------------------

  const userStart = performance.now();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  console.log(
    `[AUTH] findUser: ${Math.round(
      performance.now() - userStart
    )}ms`
  );

  // ---------------------------------------------------------
  // 2. Verify password
  // ---------------------------------------------------------

  const bcryptStart = performance.now();

  const validPassword = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  console.log(
    `[AUTH] bcrypt.compare: ${Math.round(
      performance.now() - bcryptStart
    )}ms`
  );

  if (!user || !validPassword) {
    throw Object.assign(new Error("Invalid credentials"), {
      status: 401,
    });
  }

  // ---------------------------------------------------------
  // 3. Find business membership
  // ---------------------------------------------------------

  const membershipStart = performance.now();

  const membership = await prisma.businessMember.findFirst({
    where: { userId: user.id },
  });

  console.log(
    `[AUTH] membership: ${Math.round(
      performance.now() - membershipStart
    )}ms`
  );

  // ---------------------------------------------------------
  // 4. Generate tokens + save refresh token
  // ---------------------------------------------------------

  const tokensStart = performance.now();

  const result = await tokens(user, membership?.businessId);

  console.log(
    `[AUTH] tokens(): ${Math.round(
      performance.now() - tokensStart
    )}ms`
  );

  // ---------------------------------------------------------
  // TOTAL
  // ---------------------------------------------------------

  console.log(
    `[AUTH] TOTAL login: ${Math.round(
      performance.now() - totalStart
    )}ms`
  );

  return result;
}

async function tokens(user, businessId) {
  // ---------------------------------------------------------
  // JWT generation
  // ---------------------------------------------------------

  const jwtStart = performance.now();

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

  console.log(
    `[AUTH] JWT signing: ${Math.round(
      performance.now() - jwtStart
    )}ms`
  );

  // ---------------------------------------------------------
  // Save refresh token
  // ---------------------------------------------------------

  const refreshDbStart = performance.now();

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

  console.log(
    `[AUTH] refreshToken.create: ${Math.round(
      performance.now() - refreshDbStart
    )}ms`
  );

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
