import jwt from "jsonwebtoken";

import {
  env,
} from "../config/env.js";

import {
  fail,
} from "../lib/response.js";


export function authenticate(
  req,
  res,
  next
) {

  const authorization =
    req.headers.authorization;


  if (
    !authorization?.startsWith("Bearer ")
  ) {

    return fail(
      res,
      "Authentication required",
      401
    );

  }


  try {

    const token =
      authorization.slice(7);


    req.user =
      jwt.verify(
        token,
        env.jwtAccessSecret
      );


    return next();

  } catch {

    return fail(
      res,
      "Invalid or expired token",
      401
    );

  }

}


export function authorize(
  ...roles
) {

  return (
    req,
    res,
    next
  ) => {

    if (
      !req.user
    ) {

      return fail(
        res,
        "Authentication required",
        401
      );

    }


    if (
      !roles.includes(
        req.user.role
      )
    ) {

      return fail(
        res,
        "Forbidden",
        403
      );

    }


    return next();

  };

}
