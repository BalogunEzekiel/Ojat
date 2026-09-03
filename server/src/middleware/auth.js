import jwt from 'jsonwebtoken'; import { env } from '../config/env.js'; import { fail } from '../lib/response.js';
export function authenticate(req,res,next){const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return fail(res,'Authentication required',401);try{req.user=jwt.verify(h.slice(7),env.jwtAccessSecret);next()}catch{return fail(res,'Invalid or expired token',401)}}
export function authorize(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():fail(res,'Forbidden',403)}
